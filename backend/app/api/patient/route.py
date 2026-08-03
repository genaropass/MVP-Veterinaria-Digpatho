import logging

from fastapi import Depends, FastAPI, HTTPException, Request
from app.api.database import db
from app.api.patient import crud
from app.api.patient.models import PacienteCreate
from app.api.user import crud as crudUser
from app.api.user.token.decodificar_token import obtener_usuario_actual
from app.api.audit.auditoria import registrar_auditoria, OperacionAuditoria
from typing import Optional

logger = logging.getLogger(__name__)

def add_paciente_routes(app: FastAPI):

    @app.post("/paciente/", tags=["Paciente"])
    async def create_paciente(paciente: PacienteCreate, request: Request):
        """
        Permite insertar a un nuevo paciente en la base de datos.
        Recibe: instancia de base de datos, nombre, sexo, fecha de nacimiento, mail del usuario
        retorna un mensaje de que el paciente fue cargado con exito
        """
        try:
            logger.info("POST /paciente/ - Creando paciente")
            IDuser = await crudUser.get_id_user(db, paciente.mail)
            logger.debug("Usuario encontrado: %s", IDuser)

            await crud.create_paciente(db, paciente, IDuser, ip=request.client.host if request.client else None)
            logger.info("Paciente creado exitosamente")

            return {"message": "Paciente creado con exito."}
        except HTTPException as e:
            logger.warning("HTTPException en create_paciente: %d - %s", e.status_code, e.detail)
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            error_msg = str(e) if e and str(e) else "Error desconocido"
            logger.error("ERROR en create_paciente — error=%s\n%s", error_msg, error_traceback)
            raise HTTPException(status_code=500, detail=f"Error desconocido al crear el paciente: {error_msg}")

    @app.get("/paciente/", tags=["Paciente"])
    async def get_all_paciente(request: Request, usuario_actual: dict = Depends(obtener_usuario_actual)):
        """
        Conseguir a un conjunto de pacientes de la base de datos.
        Retorna un objeto de pacientes.
        """
        try:
            logger.debug("GET /paciente/ - Obteniendo todos los pacientes")
            pacientes = await crud.get_all_pacientes(db)
            logger.debug("Se obtuvieron %d pacientes", len(pacientes) if pacientes else 0)
            await registrar_auditoria(
                tabla="paciente",
                operacion=OperacionAuditoria.LEER,
                registro_id="*",
                usuario_id=usuario_actual["sub"],
                ip=request.client.host if request.client else None,
            )
            return pacientes
        except HTTPException as http_exc:
            logger.warning("HTTPException en get_all_paciente: %d - %s", http_exc.status_code, http_exc.detail)
            raise http_exc
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            error_msg = str(e) if e and str(e) else "Error desconocido"
            logger.error("ERROR en get_all_paciente — error=%s\n%s", error_msg, error_traceback)
            raise HTTPException(status_code=500, detail=f"Error al obtener los pacientes: {error_msg}")

    @app.get("/paciente/{paciente_id}", tags=["Paciente"])
    async def get_id_paciente(paciente_id: str, request: Request, usuario_actual: dict = Depends(obtener_usuario_actual)):
        """
        Conseguir 1 paciente de la base de datos por medio del id.
        Recibe: id del paciente.
        Retorna el dato del paciente.
        """
        try:
            paciente = await crud.get_paciente_id(db, paciente_id, usuario_id=usuario_actual["sub"], ip=request.client.host if request.client else None)
            return paciente
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener el paciente.")

    @app.get("/paciente/user_id/{user_id}", tags=["Paciente"])
    async def list_paciente_por_doctor(user_mail: str, request: Request, usuario_actual: dict = Depends(obtener_usuario_actual)):
        """
        Conseguir 1 paciente de la base de datos por medio del mail.
        Recibe: id del usuario.
        Retorna el dato del paciente.
        """
        try:
            user_id = await crudUser.get_id_user(db, user_mail)
            pacientes = await crud.list_paciente_por_doctor(db, user_id)
            await registrar_auditoria(
                tabla="paciente",
                operacion=OperacionAuditoria.LEER,
                registro_id=user_id,
                usuario_id=usuario_actual["sub"],
                ip=request.client.host if request.client else None,
            )
            return pacientes
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener los pacientes del doctor.")

    @app.delete("/paciente/{paciente_id}", tags=["Paciente"])
    async def delete_paciente(paciente_id: str, request: Request, usuario_actual: dict = Depends(obtener_usuario_actual)):
        """
        Eliminar un paciente por su id.
        Recibe: id del paciente.
        Retorna: mensaje de confirmacion de eliminado
        """
        try:
            await crud.delete_paciente_id(db, paciente_id, usuario_id=usuario_actual["sub"], ip=request.client.host if request.client else None)
            return {"message": "Paciente eliminado"}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al eliminar el paciente.")

    @app.get("/paciente_dni_sexo", tags=["Paciente"])
    async def get_dni_paciente(
        request: Request,
        paciente_dni: str = Depends(crud.validar_dni),
        paciente_sexo: Optional[str] = Depends(crud.validar_sexo),
        paciente_fecha_de_nacimiento: Optional[str] = Depends(crud.validar_fecha_de_nacimiento),
        usuario_actual: dict = Depends(obtener_usuario_actual),
    ):
        """ 
        Conseguir 1 paciente de la base de datos por medio del dni, del sexo o la fecha de nacimiento.
        Recibe: obligatorio: dni del paciente, opcional:sexo, fecha de nacimiento.
        Retorna el datos del paciente.
        """
        try:
            # DNI es dato sensible — se loguea solo en DEBUG (deshabilitado en producción)
            logger.debug("GET /paciente_dni_sexo — sexo=%s fecha=%s", paciente_sexo, paciente_fecha_de_nacimiento)
            ip = request.client.host if request.client else None
            uid = usuario_actual["sub"]
            if paciente_sexo:
                paciente = await crud.get_paciente_dni_sexo(db, paciente_dni, paciente_sexo, usuario_id=uid, ip=ip)
            elif paciente_fecha_de_nacimiento:
                paciente = await crud.get_paciente_fecha_de_nacimiento(db, paciente_dni, paciente_sexo, paciente_fecha_de_nacimiento, usuario_id=uid, ip=ip)
            else:
                paciente = await crud.get_paciente_dni(db, paciente_dni, usuario_id=uid, ip=ip)
            logger.debug("Paciente encontrado: %d resultado(s)", len(paciente) if isinstance(paciente, list) else 1)
            return paciente

        except HTTPException as http_exc:
            logger.warning("HTTPException en get_dni_paciente: %d - %s", http_exc.status_code, http_exc.detail)
            raise http_exc
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            error_msg = str(e) if e and str(e) else "Error desconocido"
            logger.error("ERROR en get_dni_paciente — error=%s\n%s", error_msg, error_traceback)
            raise HTTPException(status_code=500, detail=f"Error al obtener el paciente: {error_msg}")

   