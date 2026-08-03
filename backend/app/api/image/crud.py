from fastapi import HTTPException
from prisma.models import Imagen
from prisma import Prisma
from datetime import datetime
from app.api.audit.auditoria import registrar_auditoria, OperacionAuditoria


async def create_imagen(db: Prisma, ubicacion: str, informe_id: str, usuario_id: str = None, ip: str = None) -> Imagen:
    """
    Permite insertar una nueva imagen en la base de datos.
    """
    try:
        imagen = await db.imagen.create(data={"ubicacion": ubicacion, "informeId": informe_id})
        await registrar_auditoria(
            tabla=imagen.__class__.__name__.lower(),
            operacion=OperacionAuditoria.CREAR,
            registro_id=imagen.id,
            datos_posteriores={"ubicacion": ubicacion, "informeId": informe_id},
            usuario_id=usuario_id,
            ip=ip,
        )
        return imagen
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al crear la imagen.")

async def create_imagen_with_type(db: Prisma, ubicacion: str, informe_id: str, tipo_imagen: str = "standard", usuario_id: str = None, ip: str = None) -> Imagen:
    """
    Permite insertar una nueva imagen en la base de datos con tipo especificado.
    tipo_imagen: "standard" para imágenes normales, "wsi" para Whole Slide Images
    """
    try:
        imagen = await db.imagen.create(
            data={
                "ubicacion": ubicacion,
                "informeId": informe_id,
                "tipo_imagen": tipo_imagen
            }
        )
        await registrar_auditoria(
            tabla=imagen.__class__.__name__.lower(),
            operacion=OperacionAuditoria.CREAR,
            registro_id=imagen.id,
            datos_posteriores={"ubicacion": ubicacion, "informeId": informe_id, "tipo_imagen": tipo_imagen},
            usuario_id=usuario_id,
            ip=ip,
        )
        return imagen
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al crear la imagen.")


async def get_ubicacion_imagen(db: Prisma, imagen_id: str) -> str | None:
    """ 
    Buscar una imagen por su ID en la base de datos (Solo si no está eliminada).
    """
    try:
        # Usamos find_first para poder filtrar por deleted_at
        imagen = await db.imagen.find_first(
            where={
                "id": imagen_id,
                "deleted_at": None  # <--- FILTRO SOFT DELETE
            }
        )
        if not imagen:
            raise HTTPException(status_code=404, detail="Imagen no encontrada")
        return imagen
    except HTTPException as http_exc:
            raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener la ubicación de la imagen.")


async def get_imagen(db: Prisma, imagen_id: str, usuario_id: str = None, ip: str = None) -> Imagen | None:
    """
    Buscar una imagen por su ID (Solo si no está eliminada).
    """
    try:
        imagen = await db.imagen.find_first(
            where={
                "id": imagen_id,
                "deleted_at": None  # <--- FILTRO SOFT DELETE
            }
        )
        if not imagen:
            raise HTTPException(status_code=404, detail="Imagen no encontrada")
        await registrar_auditoria(
            tabla="imagen",
            operacion=OperacionAuditoria.LEER,
            registro_id=imagen_id,
            usuario_id=usuario_id,
            ip=ip,
        )
        return imagen
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener la imagen.")


async def get_imagenes_by_informe(db: Prisma, informe_id: str) -> list[dict]:
    """ 
    Obtener todas las imagenes activas de un informe.
    """
    try:
        imagenes = await db.imagen.find_many(
            where={
                "informeId": informe_id,
                "deleted_at": None  # <--- FILTRO SOFT DELETE
            }
        )
        return [{"id": img.id, "ubicacion": img.ubicacion, "informeId": img.informeId} for img in imagenes]
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener las imágenes del informe.")


async def delete_imagen(db: Prisma, imagen_id: str, usuario_id: str = None, ip: str = None) -> bool:
    """
    Eliminación Lógica (Soft Deletion).
    En lugar de borrar el registro, actualiza el campo deleted_at con la fecha actual.
    """
    try:
        # Verificamos primero si existe y está activa
        imagen_existente = await db.imagen.find_first(
            where={
                "id": imagen_id,
                "deleted_at": None
            }
        )
        if not imagen_existente:
             raise HTTPException(status_code=404, detail="Imagen no encontrada o ya eliminada.")

        # Realizamos el Soft Delete (Update en vez de Delete)
        await db.imagen.update(
            where={"id": imagen_id},
            data={"deleted_at": datetime.now()} # <--- FECHA DE BORRADO
        )
        await registrar_auditoria(
            tabla=imagen_existente.__class__.__name__.lower(),
            operacion=OperacionAuditoria.ELIMINAR,
            registro_id=imagen_id,
            datos_previos={"ubicacion": imagen_existente.ubicacion, "informeId": imagen_existente.informeId},
            usuario_id=usuario_id,
            ip=ip,
        )
        return True
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar la imagen: {str(e)}")


async def get_paciente_by_image(db: Prisma, informe_id: str) -> str:
    """ 
    Obtener el nombre del paciente, asegurando que ni el informe ni el paciente estén eliminados.
    """
    try:
        # Buscamos informe activo
        informe = await db.informe.find_first(
            where={
                "id": informe_id,
                "deleted_at": None  # <--- Validamos integridad del informe
            }
        )
        if not informe:
            raise HTTPException(status_code=404, detail="Informe no encontrado o eliminado")
        
        # Buscamos paciente activo
        paciente = await db.paciente.find_first(
            where={
                "id": informe.pacienteId,
                "deleted_at": None  # <--- Validamos integridad del paciente
            }
        )
        if not paciente:
            raise HTTPException(status_code=404, detail="Paciente no encontrado o eliminado")

        return paciente.nombre
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener el paciente de la imagen.")