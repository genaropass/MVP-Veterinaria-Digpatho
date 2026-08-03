from datetime import datetime, timedelta, timezone
from jose import jwt
from dotenv import load_dotenv
import os

# Cargar variables desde .env
load_dotenv()


def crear_access_token(data: dict, expiracion: int):
    """Crea un JWT firmado con expiración en segundos desde ahora.
    Usa datetime.now(timezone.utc) para garantizar que 'exp'
    esté siempre en UTC, independientemente de la zona horaria del servidor.
    Requiere SECRET_KEY y ALGORITHM en el entorno.
    """
    secret = os.getenv("SECRET_KEY")
    algorithm = os.getenv("ALGORITHM", "HS256")
    if not secret:
        raise ValueError("SECRET_KEY no está configurada en el entorno. Revisar .env o variables de entorno del servidor.")
    data["exp"] = int(datetime.now(timezone.utc).timestamp()) + int(expiracion)
    return jwt.encode(data, secret, algorithm=algorithm)
