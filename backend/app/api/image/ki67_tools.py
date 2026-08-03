import logging
import os
import asyncio
import httpx
from dotenv import load_dotenv
from pathlib import Path

logger = logging.getLogger(__name__)

# Cargar variables desde .env o .env_preprod
# Primero intentar .env_preprod (usado en preproducción), luego .env
env_preprod_path = Path.home() / ".env_preprod"
if env_preprod_path.exists():
    load_dotenv(env_preprod_path)
else:
    load_dotenv()  # Busca .env en el directorio actual

HOST = os.getenv("HOST")

# Definicion global
segmentador_model_activo = False
model_lock = asyncio.Lock()


async def if_model():
    """
    Llama a CONDASERVER para activar el modelo Ki67 si no está activo.
    Usa un Lock para evitar condiciones de carrera (dos peticiones simultáneas).
    """
    global segmentador_model_activo

    if not HOST or HOST == "None" or HOST == "":
        logger.warning("Ki67: HOST no configurado, se omite activar-modelo.")
        return

    async with model_lock:
        if not segmentador_model_activo:
            logger.info("Intentando activar modelo Ki67 en CONDASERVER (bajo Lock)...")
            try:
                ok = await activate_model()
                if ok:
                    segmentador_model_activo = True
                    logger.info("Modelo Ki67 activado correctamente.")
                else:
                    # Servidor sin endpoint activar-modelo (ej. 404): seguimos igual
                    segmentador_model_activo = True
                    logger.info("activar-modelo no disponible en este servidor, se continúa con procesar_imagen.")
            except Exception as e:
                # No fallar la tarea: este servidor puede no tener activar-modelo
                segmentador_model_activo = True
                logger.warning("activar-modelo falló (se continúa igual): %s", e)
        else:
            logger.debug("Modelo Ki67 ya marcado activo, no se vuelve a llamar activar-modelo.")


async def activate_model():
    """
    Llama a CONDASERVER (activar-modelo) para cargar el modelo Ki67.
    Si el servidor no tiene ese endpoint (404) o falla, devuelve False y no se lanza excepción:
    el flujo continúa con procesar_imagen de todas formas.
    """
    url = f"{HOST.rstrip('/')}/activar-modelo"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url)
        if response.status_code == 200:
            return True
        # 404 = este servidor no tiene activar-modelo; otros códigos = error del servidor
        logger.warning("activar-modelo respondió %d: %s", response.status_code, response.text[:200])
        return False
    except Exception as e:
        logger.warning("activar-modelo no disponible: %s", e)
        return False