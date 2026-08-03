import logging

from app.api.database import db
from enum import Enum
from prisma import Json

logger = logging.getLogger(__name__)

class OperacionAuditoria(str, Enum):
    CREAR = "CREATE"
    LEER = "READ"
    ACTUALIZAR = "UPDATE"
    ELIMINAR = "DELETE"
    LOGIN = "LOGIN"
    LOGIN_FALLIDO = "LOGIN_FAILED"
    DOS_FACTORES_VALIDADO = "2FA_VALIDATED"

async def registrar_auditoria(
    tabla: str,
    operacion: OperacionAuditoria,
    registro_id: str,
    datos_previos: dict = None,
    datos_posteriores: dict = None,
    ip: str = None,
    usuario_id: str = None
):
    try:
        data = {
            "tabla": tabla,
            "operacion": operacion.value,
            "registro_id": str(registro_id),
            "usuario_id": usuario_id,
            "ip": ip,
        }
        if datos_previos is not None:
            data["datos_previos"] = Json(datos_previos)
        if datos_posteriores is not None:
            data["datos_posteriores"] = Json(datos_posteriores)
        await db.auditoria.create(data=data)
    except Exception as e:
        logger.error(
            "[AUDITORIA ERROR] %s: %s — tabla=%s, op=%s, id=%s",
            type(e).__name__, e, tabla, operacion, registro_id,
        )