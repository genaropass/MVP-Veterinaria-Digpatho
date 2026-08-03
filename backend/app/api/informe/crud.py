from prisma.models import Informe
from prisma import Prisma
from datetime import datetime
from app.api.patient import crud
from fastapi import HTTPException
from app.api.informe.models import InformeCreate
from app.api.audit.auditoria import registrar_auditoria, OperacionAuditoria

async def create_informe(db: Prisma, informeCreate: InformeCreate, usuario_id: str = None, ip: str = None) -> Informe:
    """
    Crea un nuevo informe.
    Mejora T2.1: Manejo seguro de fechas usando objetos datetime en lugar de strings manuales.
    """
    try:
        # --- 1) Asegurar que el paciente exista ---
        # Nota: Asegurate de que crud.get_paciente_id también valide soft-delete en el futuro.
        await crud.get_paciente_id(db, informeCreate.paciente_id)

        # --- 2) Manejo de Fecha (Corregido según OT-BUG-DATA-T10) ---
        fecha_final = datetime.utcnow() # Por defecto usamos la actual

        if informeCreate.fecha_de_muestra:
            # Si ya viene como string, intentamos parsearla de forma flexible
            if isinstance(informeCreate.fecha_de_muestra, str):
                fecha_raw = informeCreate.fecha_de_muestra.strip()
                if fecha_raw and fecha_raw not in ["", "None", "null"]:
                    try:
                        # Intentamos el formato estándar
                        fecha_final = datetime.strptime(fecha_raw, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        try:
                            # Intento secundario para ISO format por si el front cambió
                            fecha_final = datetime.fromisoformat(fecha_raw.replace('Z', '+00:00'))
                        except ValueError:
                            raise HTTPException(
                                status_code=400,
                                detail="Formato de fecha inválido. Se espera 'YYYY-MM-DD HH:MM:SS'."
                            )
            # Si Pydantic ya lo convirtió a datetime, lo usamos directo
            elif isinstance(informeCreate.fecha_de_muestra, datetime):
                fecha_final = informeCreate.fecha_de_muestra

        # --- 3) Determinar el tipo de estudio ---
        tipo_estudio = informeCreate.tipo_estudio or "pendiente"

        # --- 4) Crear el informe ---
        informe_principal = await db.informe.create(
            data={
                "fecha_de_muestra": fecha_final, # Prisma maneja el objeto datetime
                "pacienteId": informeCreate.paciente_id,
                "tipo_estudio": tipo_estudio,
            }
        )

        await registrar_auditoria(
            tabla=informe_principal.__class__.__name__.lower(),
            operacion=OperacionAuditoria.CREAR,
            registro_id=informe_principal.id,
            datos_posteriores={"pacienteId": informeCreate.paciente_id, "tipo_estudio": tipo_estudio, "fecha_de_muestra": str(fecha_final)},
            usuario_id=usuario_id,
            ip=ip,
        )
        return {"informe": informe_principal}

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en la creación: {str(e)}")


async def get_all_informes(db: Prisma):
    """ 
    Conseguir todos los informes activos (NO ELIMINADOS).
    """
    try:
        return await db.informe.find_many(
            where={
                "deleted_at": None  # <--- FILTRO SOFT DELETE
            }
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener los informes.")


async def get_informe_id(db: Prisma, informe_id: str, usuario_id: str = None, ip: str = None) -> Informe:
    """
    Conseguir 1 informe activo por ID.
    """
    try:
        informe = await db.informe.find_first(
            where={
                "id": informe_id,
                "deleted_at": None # <--- FILTRO SOFT DELETE
            }
        )
        if not informe:
            raise HTTPException(status_code=404, detail="Informe no encontrado o eliminado")
        if usuario_id or ip:
            await registrar_auditoria(
                tabla="informe",
                operacion=OperacionAuditoria.LEER,
                registro_id=informe_id,
                usuario_id=usuario_id,
                ip=ip,
            )
        return informe
    except HTTPException as http_exc:
            raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener el informe.")


async def get_informe_id_bool(db: Prisma, informe_id: str) -> bool:
    """
    Verifica existencia de informe activo.
    """
    try:
        result = await db.informe.find_first(
            where={
                "id": informe_id,
                "deleted_at": None
            }
        )
        return result is not None
    except Exception:
        raise HTTPException(status_code=500, detail="Error al verificar la existencia del informe.")


async def list_informes_por_paciente(db: Prisma, paciente_id: str, usuario_id: str = None, ip: str = None) -> list[Informe]:
    """
    Busca informes activos de un paciente.
    """
    try:
        informes = await db.informe.find_many(
            where={
                "pacienteId": paciente_id,
                "deleted_at": None # <--- FILTRO SOFT DELETE
            }
        )
        if not informes:
            raise HTTPException(status_code=400, detail="No hay informes activos para ese paciente")
        await registrar_auditoria(
            tabla="informe",
            operacion=OperacionAuditoria.LEER,
            registro_id=paciente_id,
            usuario_id=usuario_id,
            ip=ip,
        )
        return informes
    except HTTPException as http_exc:
            raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener los informes del paciente.")


async def update_promedio(db: Prisma, id: str, promedio_rta_img: str, usuario_id: str = None, ip: str = None) -> bool:
    """
    Actualiza promedio solo si el informe existe y está activo.
    """
    try:
        informe = await db.informe.find_first(
             where={
                 "id": id,
                 "deleted_at": None
             }
        )
        if not informe:
            raise HTTPException(status_code=404, detail="No se pudo encontrar el informe para actualizar promedio")
        
        await db.informe.update(
            where={"id": id},
            data={"promedio_rta_img": promedio_rta_img}
        )
        await registrar_auditoria(
            tabla=informe.__class__.__name__.lower(),
            operacion=OperacionAuditoria.ACTUALIZAR,
            registro_id=id,
            datos_previos={"promedio_rta_img": informe.promedio_rta_img},
            datos_posteriores={"promedio_rta_img": promedio_rta_img},
            usuario_id=usuario_id,
            ip=ip,
        )
        return True
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al actualizar el informe.")


async def delete_informe_id(db: Prisma, informe_id: str, usuario_id: str = None, ip: str = None) -> Informe:
    """ 
    Eliminación Lógica (Soft Deletion) del informe.
    En lugar de db.delete, usamos db.update con deleted_at.
    """
    try:
        # Verificar que existe y no está borrado
        informe_existente = await db.informe.find_first(
            where={
                "id": informe_id,
                "deleted_at": None
            }
        )
        if not informe_existente:
             raise HTTPException(status_code=404, detail="Informe no encontrado o ya eliminado")

        # Soft Delete
        informe_eliminado = await db.informe.update(
            where={"id": informe_id},
            data={"deleted_at": datetime.now()} # <--- FECHA DE BORRADO
        )
        
        await registrar_auditoria(
            tabla=informe_existente.__class__.__name__.lower(),
            operacion=OperacionAuditoria.ELIMINAR,
            registro_id=informe_id,
            datos_previos={"pacienteId": informe_existente.pacienteId, "tipo_estudio": informe_existente.tipo_estudio},
            usuario_id=usuario_id,
            ip=ip,
        )
        return informe_eliminado
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar el informe: {str(e)}")