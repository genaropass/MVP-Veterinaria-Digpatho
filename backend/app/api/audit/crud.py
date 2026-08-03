import logging
import os
from datetime import datetime, timedelta, timezone
from prisma import Prisma
from prisma.errors import PrismaError
from fastapi import HTTPException
from typing import Optional

logger = logging.getLogger(__name__)

async def get_all_auditorias(db: Prisma, tabla: Optional[str] = None, operacion: Optional[str] = None):
    """Obtiene todos los registros de auditoría con filtros opcionales."""
    try:
        filtros = {}
        if tabla:
            filtros["tabla"] = tabla
        if operacion:
            filtros["operacion"] = operacion

        return await db.auditoria.find_many(
            where = filtros,
            order = {"fecha": "desc"}
        )
    except PrismaError:
        logger.exception("Error de base de datos en get_all_auditorias")
        raise HTTPException(status_code=500, detail="Error en la base de datos")
    except Exception:
        logger.exception("Error interno en get_all_auditorias")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


async def get_auditoria_by_registro(db: Prisma, tabla: str, registro_id: str):
    """Obtiene el historial de un registro específico."""
    try:
        return await db.auditoria.find_many(
            where={"tabla": tabla, "registro_id": registro_id},
            order={"fecha": "desc"}
        )
    except PrismaError:
        logger.exception("Error de base de datos en get_auditoria_by_registro — tabla=%s id=%s", tabla, registro_id)
        raise HTTPException(status_code=500, detail="Error en la base de datos")
    except Exception:
        logger.exception("Error interno en get_auditoria_by_registro — tabla=%s id=%s", tabla, registro_id)
        raise HTTPException(status_code=500, detail="Error interno del servidor")


async def purgar_auditoria_antigua(db: Prisma) -> int:
    años = int(os.getenv("AUDITORIA_RETENCION_AÑOS", "6"))
    limite = datetime.now(timezone.utc) - timedelta(days=años * 365)
    try:
        eliminados = await db.auditoria.delete_many(where={"fecha": {"lt": limite}})
        if eliminados:
            logger.info("Purga auditoría: %d registros eliminados (anteriores a %s)", eliminados, limite.date())
        else:
            logger.debug("Purga auditoría: sin registros anteriores a %s", limite.date())
        return eliminados
    except PrismaError:
        logger.exception("Error de base de datos en purgar_auditoria_antigua")
        raise HTTPException(status_code=500, detail="Error de base de datos")
    except Exception:
        logger.exception("Error inesperado en purgar_auditoria_antigua")
        raise HTTPException(status_code=500, detail="Error interno del servidor")