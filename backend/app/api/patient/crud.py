import logging

from prisma.models import Paciente
from prisma import Prisma
from app.api.patient.models import PacienteCreate
from fastapi import HTTPException, Query
from prisma.errors import PrismaError
from typing import Optional
from datetime import datetime, timezone
from app.api.audit.auditoria import registrar_auditoria, OperacionAuditoria

logger = logging.getLogger(__name__)

async def create_paciente(db: Prisma, paciente: PacienteCreate, usuarioId: str, ip: str = None) -> Paciente | None:
    """
    Permite insertar a un nuevo paciente en la base de datos.
    Recibe: instancia de base de datos, nombre y id del medico (usuario).
    retorna un mensaje de que el paciente fue cargado con exito
    """
    try:
        existente = await db.paciente.find_unique(where={"dni": paciente.dni})
        if existente:
            raise HTTPException(status_code=409, detail=f"Ya existe un paciente registrado con el DNI {paciente.dni}")

        nuevo_paciente = await db.paciente.create(
            data={"nombre": paciente.nombre,
                  "dni": paciente.dni,
                  "sexo": paciente.sexo,
                  "fecha_de_nacimiento": paciente.fecha_de_nacimiento,
                  "usuarioId": usuarioId}
        )
        if not nuevo_paciente:
            raise HTTPException(status_code=404, detail="No se pudo crear el paciente porque no existe el usuario asociado")

        await registrar_auditoria(
            tabla=nuevo_paciente.__class__.__name__.lower(),
            operacion=OperacionAuditoria.CREAR,
            registro_id=nuevo_paciente.id,
            datos_posteriores={"nombre": paciente.nombre, "dni": paciente.dni, "sexo": paciente.sexo, "fecha_de_nacimiento": paciente.fecha_de_nacimiento},
            usuario_id=usuarioId,
            ip=ip,
        )
        return {"Paciente creado con exito"}
    except HTTPException as http_exc:
        raise http_exc
    except PrismaError as e:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")


async def get_all_pacientes(db: Prisma):
    """ 
    Obtener un objeto de pacientes.
    Retorna: lista de diccionarios
    """
    try:
        logger.debug("get_all_pacientes - Consultando base de datos...")
        pacientes = await db.paciente.find_many(where={"deleted_at": None})
        logger.debug("get_all_pacientes - Se encontraron %d pacientes", len(pacientes) if pacientes else 0)
        return pacientes
    except PrismaError as e:
        logger.error("PrismaError en get_all_pacientes: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")
    except Exception as e:
        logger.exception("Exception en get_all_pacientes: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Error al obtener pacientes: {str(e)}")


async def get_paciente_id(db: Prisma, paciente_id: str, usuario_id: str = None, ip: str = None) -> Paciente | None:
    """
    Obtiene 1 paciente segun su id.
    Recibe: instancia de base de datos, id del paciente.
    retorna al paciente o None
    """
    try:
        paciente = await db.paciente.find_unique(where={"id":paciente_id})
        if not paciente or paciente.deleted_at is not None:
            raise HTTPException(status_code=404, detail="El paciente no existe")
        await registrar_auditoria(
            tabla="paciente",
            operacion=OperacionAuditoria.LEER,
            registro_id=paciente_id,
            usuario_id=usuario_id,
            ip=ip,
        )
        return paciente
    except HTTPException as http_exc:
            raise http_exc
    except PrismaError as e:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")


async def list_paciente_por_doctor(db:Prisma, user_id:str)->list[Paciente]:
    """
    Busca todos los registros en la tabla paciente donde el campo usuarioId coincida con el valor de user_id.
    Recibe: id del usuario. 
    Retorno: La función retorna la lista de pacientes asociados al usuario proporcionado. Si no se encuentran pacientes, devuelve una lista vacía [].
    """
    try:
        lista_paciente= await db.paciente.find_many(where={"usuarioId": user_id, "deleted_at": None})
        return lista_paciente
    except PrismaError as e:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")


async def delete_paciente_id(db: Prisma, paciente_id: str, usuario_id: str = None, ip: str = None) -> Paciente | None:
    """
    Eliminar a 1 paciente segun su id.
    Recibe: instancia de base de datos, id del paciente.
    retorna al paciente o None
    """
    try:
        async with db.tx() as tx:
            now = datetime.now(timezone.utc)
            await tx.imagen.update_many(
                where={"informe": {"pacienteId": paciente_id}},
                data={"deleted_at": now},
            )
            await tx.informe.update_many(
                where={"pacienteId": paciente_id},
                data={"deleted_at": now},
            )
            paciente_eliminado = await tx.paciente.update(
                where={"id": paciente_id},
                data={"deleted_at": now},
            )

        if not paciente_eliminado:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")

        await registrar_auditoria(
            tabla=paciente_eliminado.__class__.__name__.lower(),
            operacion=OperacionAuditoria.ELIMINAR,
            registro_id=paciente_id,
            datos_previos={"nombre": paciente_eliminado.nombre, "dni": paciente_eliminado.dni, "sexo": paciente_eliminado.sexo},
            usuario_id=usuario_id,
            ip=ip,
        )
        return paciente_eliminado
    except HTTPException as http_exc:
        raise http_exc
    except PrismaError as e:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")


#conseguir paciente por dni: get_paciente_dni
async def get_paciente_dni(db: Prisma, paciente_dni: str, usuario_id: str = None, ip: str = None) -> Paciente:
    """ Obtiene 1 paciente segun su dni.
    Recibe: instancia de base de datos, dni del paciente.
    retorna al paciente o status_code"""
    try:
        paciente = await db.paciente.find_unique(where={"dni": paciente_dni})
        if not paciente or paciente.deleted_at is not None:
            raise HTTPException(status_code=404, detail='Paciente con Dni no encontrado')
        await registrar_auditoria(
            tabla="paciente",
            operacion=OperacionAuditoria.LEER,
            registro_id=paciente.id,
            usuario_id=usuario_id,
            ip=ip,
        )
        return [paciente]
    except HTTPException as http_exc:
        raise http_exc
    except PrismaError as e:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")


# conseguir paciente segun su dni y sexo
async def get_paciente_dni_sexo(db: Prisma, paciente_dni: str, paciente_sexo: Optional[str], usuario_id: str = None, ip: str = None) -> Paciente:
    """
    Obtiene 1 paciente segun su dni y sexo.
    Recibe: instancia de base de datos, dni del paciente y sexo del paciente.
    retorna al paciente o status_code
    """
    try:
        paciente = await db.paciente.find_many(where={"dni": paciente_dni, "sexo": paciente_sexo, "deleted_at": None})
        if not paciente:
            raise HTTPException(status_code=404, detail='Paciente con Dni no encontrado')
        await registrar_auditoria(
            tabla="paciente",
            operacion=OperacionAuditoria.LEER,
            registro_id=paciente[0].id,
            usuario_id=usuario_id,
            ip=ip,
        )
        return paciente
    except HTTPException as http_exc:
        raise http_exc
    except PrismaError as e:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")


# conseguir paciente segun su fecha de nacimiento
async def get_paciente_fecha_de_nacimiento(db: Prisma, paciente_dni: str, paciente_sexo: Optional[str], paciente_fecha_de_nacimiento: str, usuario_id: str = None, ip: str = None) -> Paciente:
    """
    Obtiene 1 paciente segun su fecha de nacimiento.
    Recibe: instancia de base de datos, fecha de nacimiento del paciente.
    retorna al paciente o status_code
    """
    try:
        paciente = await db.paciente.find_many(where={"dni": paciente_dni, "sexo": paciente_sexo, "fecha_de_nacimiento": paciente_fecha_de_nacimiento, "deleted_at": None})
        if not paciente:
            raise HTTPException(status_code=404, detail='Paciente no encontrado')
        await registrar_auditoria(
            tabla="paciente",
            operacion=OperacionAuditoria.LEER,
            registro_id=paciente[0].id,
            usuario_id=usuario_id,
            ip=ip,
        )
        return paciente
    except HTTPException as http_exc:
        raise http_exc
    except PrismaError as e:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")


def validar_dni(paciente_dni: str= Query(...)) -> str: 
    """
    comprueba que el Documento tenga 7 u 8 digitos
    Recibe: documento del paciente
    Retorna: documento si esta en formato correcto
    """
    if not paciente_dni.isdigit() or (len(paciente_dni) not in(7, 8)):
        raise HTTPException(status_code=400, detail="El DNI debe tener exactamente 7 u 8 digitos numericos.")
    return paciente_dni



def validar_sexo(paciente_sexo:  Optional[str] = Query(None)) -> Optional[str]:
    """
    comprueba que el sexo sea F o M
    Recibe: sexo del paciente
    Retorna: sexo si esta en formato correcto
    """
    if paciente_sexo and paciente_sexo not in("F", "M"):
        raise HTTPException(status_code=400, detail="El SEXO debe ser 'M' para masculino o 'F' para femenino.")
    return paciente_sexo


def validar_fecha_de_nacimiento(paciente_fecha_de_nacimiento:  Optional[str] = Query(None)) -> Optional[str]:
    """
    comprueba que la fecha de nacimiento este en formato YYYY-MM-DD
    Recibe: fecha de nacimiento
    Retorna: la fecha de nacimiento si esta en formato correcto
    """
    if paciente_fecha_de_nacimiento:
        try:
            # Intenta parsear la fecha con el formato YYYY-MM-DD
            datetime.strptime(paciente_fecha_de_nacimiento, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="La fecha de nacimiento debe tener el formato 'YYYY-MM-DD'"
            )
    return paciente_fecha_de_nacimiento