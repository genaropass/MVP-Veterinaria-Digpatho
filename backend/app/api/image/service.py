import logging
import uuid
import json
import httpx
import requests
import os
from fastapi import HTTPException, UploadFile, Response, File
import bcrypt
from datetime import datetime, timedelta
from typing import Annotated
from PIL import Image
from io import BytesIO
from fastapi import HTTPException

logger = logging.getLogger(__name__)


def type_image(image: Annotated[UploadFile, File()]):
    """Valida que el archivo recibido sea una imagen en formato PNG o JPG
    recibe: tipo File()
    lanza: HTTPException 400 si el archivo no es del tipo PNG o JPG"""
    
    allowed_types=["image/jpeg","image/jpg", "image/png", "image/heif","image/heic","image/x-adobe-dng","image/tiff","image/bmp","image/webp"]
    try:
        if image.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail='Solo se permite imagenes del tipo .JPG , .JEPG y .PNG')
    except Exception:
        raise HTTPException(status_code=400, detail='Solo se permite imagenes del tipo .JPG, .JEPG y .PNG')

async def validate_image_content(file: UploadFile):
    """
    Valida el contenido real del archivo leyendo solo el encabezado (Header).
    Previene ataques DoS por desbordamiento de memoria RAM.
    """
    try:
        # 1. Leemos solo el primer chunk (2KB). Suficiente para ver el header.
        chunk = await file.read(2048)
        
        # 2. Intentamos verificar el formato con Pillow usando solo ese pedacito.
        # BytesIO simula que ese pedacito es un archivo completo.
        image = Image.open(BytesIO(chunk))
        image.verify() # Esto valida que la estructura del header sea de imagen

        # 3. CRÍTICO: Rebobinar el archivo.
        # Al leer 2048 bytes, el "cursor" avanzó. Si no volvemos a 0,
        # cuando subas el archivo al storage, se subirá cortado (sin el principio).
        await file.seek(0)
        
    except Exception as e:
        await file.seek(0)
        logger.warning("Validación de imagen fallida: %s", type(e).__name__)
        raise HTTPException(status_code=400, detail="El archivo está corrupto o no es una imagen válida")


def get_upload_size(file: UploadFile) -> int:
    """
    Obtiene el tamaño del archivo subido sin leerlo completo en memoria.
    """
    try:
        file.file.seek(0, os.SEEK_END)
        size = file.file.tell()
        file.file.seek(0)
        return size
    except Exception:
        raise HTTPException(status_code=400, detail="No se pudo leer el archivo subido")


def valid_uuid(value: str):
    try:
        uuid.UUID(value)

    except ValueError:
        raise HTTPException(status_code=400, detail="ID (uuid) inválido")
    

def es_wsi(filename: str, content_type: str) -> bool:
    """Detecta si un archivo es WSI (Whole Slide Image) por extensión o MIME type."""
    wsi_extensions = [".tiff", ".tif", ".svs", ".ndpi", ".mrxs", ".vms", ".vmu", ".scn", ".dzi"]
    wsi_mimetypes = ["image/tiff"]

    filename_lower = filename.lower()
    is_wsi_ext = any(filename_lower.endswith(ext) for ext in wsi_extensions)
    is_wsi_mime = content_type.lower() in wsi_mimetypes

    return is_wsi_ext or is_wsi_mime


async def generar_nombre_archivo(db, crud, informe_id: str, filename: str) -> str:
    try:
        nombrePaciente = await crud.get_paciente_by_image(db, informe_id)

        hash_bytes = bcrypt.hashpw(nombrePaciente.encode(), bcrypt.gensalt())
        hash_base64 = hash_bytes.decode()[-8:]
        hash_base64 = hash_base64.replace('/', '-')
        fecha_actual = datetime.now().strftime("%Y%m%d")

        return f"{nombrePaciente}_{hash_base64}_{fecha_actual}"
    except Exception:
        raise HTTPException(status_code=500, detail="Error al generar el nombre de archivo.")



def subir_archivo_gcs(file: UploadFile, key: str, bucket, user_id: str, chunk_size: int | None = None):
    """
    Sube un archivo al bucket GCS y agrega metadata con el userId del usuario que lo subió.
    bucket: google.cloud.storage.Bucket
    """
    try:
        file.file.seek(0)
        blob = bucket.blob(key)
        if chunk_size and chunk_size > 0:
            # Upload resumable/chunked para estabilizar archivos grandes.
            blob.chunk_size = chunk_size
        blob.upload_from_file(file.file, content_type=file.content_type or "application/octet-stream")
        blob.metadata = {"userid": user_id}
        blob.patch()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir archivo a GCS: {str(e)}")


def subir_archivo_gcs_local(file_path: str, key: str, bucket, user_id: str, content_type: str = "application/octet-stream"):
    """
    Sube un archivo local desde su ruta al bucket GCS y agrega metadata con el userId.
    """
    try:
        blob = bucket.blob(key)
        blob.upload_from_filename(file_path, content_type=content_type)
        blob.metadata = {"userid": user_id}
        blob.patch()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir archivo local a GCS: {str(e)}")


def subir_bytes_gcs(bucket, key: str, data: bytes, content_type: str, user_id: str):
    """Sube bytes al bucket GCS (p. ej. desde BytesIO) con metadata userId."""
    try:
        blob = bucket.blob(key)
        blob.upload_from_string(data, content_type=content_type or "application/octet-stream")
        blob.metadata = {"userid": user_id}
        blob.patch()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir archivo a GCS: {str(e)}")


def subir_json_gcs(key: str, data, bucket):
    """data: dict (se serializa con json.dumps) o str (se sube tal cual)."""
    try:
        body = json.dumps(data) if isinstance(data, dict) else data
        blob = bucket.blob(key)
        blob.upload_from_string(body, content_type="application/json")
    except Exception:
        raise HTTPException(status_code=500, detail="Error al subir json a GCS.")


def get_json_gcs(key: str, bucket) -> dict:
    """Obtiene un JSON desde GCS por key. Lanza si no existe o falla."""
    try:
        blob = bucket.blob(key)
        body = blob.download_as_text()
        return json.loads(body)
    except Exception:
        raise HTTPException(status_code=404, detail=f"JSON no encontrado en GCS: {key}")


def download_gcs_to_path(bucket, key: str, local_path: str):
    """Descarga un blob de GCS a un archivo local."""
    try:
        blob = bucket.blob(key)
        blob.download_to_filename(local_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al descargar desde GCS: {str(e)}")



async def analizar_imagen_ia_con_archivo(file_bytes: bytes, filename: str, conda_url: str) -> dict:
    """
    Analiza una imagen enviando el archivo directamente al servicio Ki67.
    Similar a HER2, pero para Ki67.
    
    Args:
        file_bytes: Bytes de la imagen
        filename: Nombre del archivo
        conda_url: URL del servicio de procesamiento de imágenes
    
    Returns:
        dict: Resultado del análisis de la IA
    """
    logger.debug("analizar_imagen_ia_con_archivo — file_size=%d bytes url=%s", len(file_bytes), conda_url)

    if not conda_url or conda_url == "None" or conda_url == "":
        error_msg = "URL del servicio de IA no está configurada. Verifica la variable HOST en el entorno."
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

    if not file_bytes or len(file_bytes) == 0:
        error_msg = "Archivo vacío."
        logger.error(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

    logger.info("Análisis IA iniciado — url=%s file_size=%d bytes", conda_url, len(file_bytes))
    
    try:
        # Verificar si debemos deshabilitar verificación SSL
        verify_ssl = os.getenv("KI67_VERIFY_SSL", "true").lower() not in ("false", "0", "no")
        
        # Configurar timeouts
        # Ki67 puede tardar hasta 3 min por imagen + margen; usamos 5 min de lectura
        timeout_config = httpx.Timeout(
            connect=10.0,
            read=300.0,   # 5 minutos (Ki67: 3 min por imagen + margen)
            write=30.0,   # subida del archivo puede ser lenta
            pool=10.0
        )
        
        async with httpx.AsyncClient(timeout=timeout_config, verify=verify_ssl) as client:
            logger.debug("Verificación SSL: %s", "habilitada" if verify_ssl else "deshabilitada")
            logger.debug("Timeout de conexión: 10s, Timeout de procesamiento: 300s (5 min)")
            files = {
                "file": (filename, file_bytes, "application/octet-stream")
            }
            response = await client.post(conda_url, files=files)

        if response.status_code != 200:
            error_text = response.text if hasattr(response, 'text') else str(response.content)
            error_preview = error_text[:500] if error_text else "Sin mensaje de error"
            logger.error(
                "Error HTTP %d del servicio Ki67 — url=%s respuesta=%s",
                response.status_code, conda_url, error_preview,
            )
            error_detail = error_preview if error_preview else f"Error {response.status_code}"
            try:
                error_json = response.json()
                if isinstance(error_json, dict):
                    error_detail = error_json.get("detail", error_json.get("error", error_json.get("message", str(error_json))))
            except:
                pass
            raise HTTPException(
                status_code=503,
                detail=f"El servicio Ki67 respondió con error {response.status_code}: {error_detail}",
            )

        body_preview = (response.text or "")[:500]
        logger.debug("Ki67 respondió 200 - body length: %d, preview: %r", len(response.text or ""), body_preview)

        try:
            result = response.json()
            if result is None:
                logger.warning("El servicio de IA respondió 200 pero con cuerpo null o vacío.")
                return {}
            if not isinstance(result, dict):
                logger.warning("El servicio de IA respondió con JSON no-dict: %s", type(result).__name__)
                return {"resultado": result}
            logger.info("Análisis completado exitosamente")
            return result
        except Exception as json_error:
            error_msg = f"Error al parsear respuesta JSON del servicio de IA: {json_error}"
            logger.error("%s — respuesta recibida: %s", error_msg, response.text[:500])
            raise HTTPException(status_code=500, detail=error_msg)

    except httpx.TimeoutException as e:
        error_str = str(e).lower()
        if "connect" in error_str or "connection" in error_str:
            error_msg = f"No se pudo conectar al servicio de IA en {conda_url} dentro de 10 segundos. Verifica que el servicio esté disponible y accesible."
        else:
            error_msg = "Timeout al analizar imagen en IA. El servicio no respondió a tiempo (300 segundos / 5 min de procesamiento)."
        logger.error("TIMEOUT analizando imagen IA — url=%s error=%s", conda_url, str(e))
        raise HTTPException(status_code=504, detail=error_msg)
    except httpx.ConnectError as e:
        error_msg = f"No se pudo conectar al servicio de IA en {conda_url}. Verifica que el servicio esté disponible y que la URL sea correcta (HTTP vs HTTPS)."
        logger.error("ERROR DE CONEXIÓN (ConnectError) analizando imagen IA — url=%s error=%s", conda_url, str(e))
        raise HTTPException(status_code=503, detail=error_msg)
    except httpx.RequestError as e:
        error_msg = f"Error de conexión con el servicio de IA: {str(e) if e else 'Error desconocido de conexión'}"
        logger.error(
            "ERROR DE CONEXIÓN (RequestError) analizando imagen IA — url=%s type=%s error=%s",
            conda_url, type(e).__name__, str(e),
        )
        raise HTTPException(status_code=503, detail=error_msg)
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e) if e and str(e) else "Error desconocido al analizar imagen"
        logger.exception(
            "ERROR ANALIZANDO IMAGEN IA — type=%s url=%s error=%s",
            type(e).__name__, conda_url, error_msg,
        )
        raise HTTPException(status_code=500, detail=f"Error al analizar imagen en IA: {error_msg}")


async def analizar_imagen_ia(file_location: str, conda_url: str) -> dict:
    """
    Analiza una imagen usando el servicio de IA.
    
    Args:
        file_location: Ubicación del archivo en GCS (blob key)
        conda_url: URL del servicio de procesamiento de imágenes
    
    Returns:
        dict: Resultado del análisis de la IA
    """
    logger.debug("FUNCIÓN analizar_imagen_ia INICIADA — file_location=%s url=%s", file_location, conda_url)

    # Validar parámetros
    if not conda_url or conda_url == "None" or conda_url == "":
        error_msg = "URL del servicio de IA no está configurada. Verifica la variable HOST en el entorno."
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

    if not file_location or file_location == "":
        error_msg = "Ubicación del archivo no especificada."
        logger.error(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

    logger.info("Iniciando análisis IA - URL: %s, File: %s", conda_url, file_location)

    try:
        # Verificar si debemos deshabilitar verificación SSL (útil para servicios internos sin certificado válido)
        verify_ssl = os.getenv("KI67_VERIFY_SSL", "true").lower() not in ("false", "0", "no")

        # Configurar timeouts: connect 10s, read 5 min (Ki67 puede tardar hasta 3 min por imagen)
        timeout_config = httpx.Timeout(
            connect=10.0,  # Timeout de conexión corto (10 segundos)
            read=300.0,    # 5 minutos (Ki67: 3 min por imagen + margen)
            write=30.0,    # subida puede ser lenta
            pool=10.0      # Timeout para obtener conexión del pool
        )

        async with httpx.AsyncClient(timeout=timeout_config, verify=verify_ssl) as client:
            logger.debug("Verificación SSL: %s", "habilitada" if verify_ssl else "deshabilitada")
            logger.debug("Timeout de conexión: 10s, Timeout de procesamiento: 300s (5 min)")
            response = await client.post(conda_url, json={"ubicacion": file_location})

        if response.status_code != 200:
            # Obtener detalles del error del servicio Ki67
            error_text = response.text if hasattr(response, 'text') else str(response.content)
            error_preview = error_text[:500] if error_text else "Sin mensaje de error"
            logger.error(
                "Error HTTP %d del servicio Ki67 — url=%s file=%s respuesta=%s",
                response.status_code, conda_url, file_location, error_preview,
            )
            # Intentar parsear JSON de error si existe
            error_detail = f"Error {response.status_code}"
            try:
                error_json = response.json()
                if isinstance(error_json, dict):
                    error_detail = error_json.get("detail", error_json.get("error", error_json.get("message", str(error_json))))
            except:
                error_detail = error_preview if error_preview else f"Error {response.status_code}"
            raise HTTPException(
                status_code=503,
                detail=f"El servicio Ki67 respondió con error {response.status_code}: {error_detail}",
            )

        # Siempre loguear qué devolvió el servicio Ki67 (para depurar respuestas vacías)
        body_preview = (response.text or "")[:500]
        logger.debug("Ki67 respondió 200 - body length: %d, preview: %r", len(response.text or ""), body_preview)

        # Intentar parsear JSON
        try:
            result = response.json()
            if result is None:
                logger.warning("El servicio de IA respondió 200 pero con cuerpo null o vacío. Body: %r", response.text[:200])
                return {}
            if not isinstance(result, dict):
                logger.warning("El servicio de IA respondió con JSON no-dict: %s", type(result).__name__)
                return {"resultado": result}
            logger.info("Análisis completado exitosamente")
            return result
        except Exception as json_error:
            error_msg = f"Error al parsear respuesta JSON del servicio de IA: {json_error}"
            logger.error("%s — respuesta recibida: %s", error_msg, response.text[:500])  # Primeros 500 caracteres
            raise HTTPException(status_code=500, detail=error_msg)

    except httpx.TimeoutException as e:
        # Determinar si fue timeout de conexión o de procesamiento
        error_str = str(e).lower()
        if "connect" in error_str or "connection" in error_str:
            error_msg = f"No se pudo conectar al servicio de IA en {conda_url} dentro de 10 segundos. Verifica que el servicio esté disponible y accesible."
        else:
            error_msg = "Timeout al analizar imagen en IA. El servicio no respondió a tiempo (300 segundos / 5 min de procesamiento)."
        logger.error("TIMEOUT analizando imagen IA — url=%s file=%s error=%s", conda_url, file_location, str(e))
        raise HTTPException(status_code=504, detail=error_msg)
    except httpx.ConnectError as e:
        error_msg = f"No se pudo conectar al servicio de IA en {conda_url}. Verifica que el servicio esté disponible y que la URL sea correcta (HTTP vs HTTPS)."
        logger.error("ERROR DE CONEXIÓN (ConnectError) analizando imagen IA — url=%s file=%s error=%s", conda_url, file_location, str(e))
        logger.info("Si el servicio usa HTTP sin SSL, cambia HOST a http:// en lugar de https://")
        logger.info("O configura KI67_VERIFY_SSL=false si el servicio tiene certificado autofirmado")
        raise HTTPException(status_code=503, detail=error_msg)
    except httpx.RequestError as e:
        error_msg = f"Error de conexión con el servicio de IA: {str(e) if e else 'Error desconocido de conexión'}"
        logger.error(
            "ERROR DE CONEXIÓN (RequestError) analizando imagen IA — url=%s file=%s type=%s error=%s",
            conda_url, file_location, type(e).__name__, str(e),
        )
        raise HTTPException(status_code=503, detail=error_msg)
    except HTTPException:
        raise
    except Exception as e:
        # logger.exception incluye el traceback completo (equivalente a traceback.print_exc())
        logger.exception("ERROR ANALIZANDO IMAGEN IA — url=%s", conda_url)
        raise HTTPException(status_code=500, detail=f"Error al analizar imagen en IA: {str(e)}")


import os

def forward_file_to_her2_model(file_obj, url: str):
    """
    Envía una imagen al servidor del modelo HER2.

    Soporta:
    - UploadFile de FastAPI (tiene .filename y .file)
    - Objetos tipo archivo (_io.BufferedReader, BytesIO, etc.) como los que
      vienen de open(local_path, "rb")
    """
    try:
        # Caso 1: viene un UploadFile de FastAPI
        if hasattr(file_obj, "filename") and hasattr(file_obj, "file"):
            filename = file_obj.filename
            stream = file_obj.file

        # Caso 2: viene un file-like (open(..., "rb"))
        else:
            filename = getattr(file_obj, "name", "her2_image.jpg")
            stream = file_obj

        files = {
            # content-type genérico, el modelo no suele necesitar más
            "file": (os.path.basename(filename), stream, "application/octet-stream")
        }

        resp = requests.post(url, files=files, timeout=120)
        resp.raise_for_status()
        return resp.json()

    except Exception as e:
        # No uso HTTPException acá para no acoplar service a FastAPI
        raise Exception(f"Error reenviando imagen al modelo HER2: {e}")

async def delete_gcs(key: str, bucket):
    try:
        blob = bucket.blob(key)
        blob.delete()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar la imagen en GCS: {str(e)}")


async def get_url_gcs(bucket, ubicacion: str):
    try:
        blob = bucket.blob(ubicacion)
        url = blob.generate_signed_url(expiration=timedelta(hours=1), method="GET")
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar url: {str(e)}")


async def download_image_gcs(bucket, ubicacion: str):
    try:
        blob = bucket.blob(ubicacion)
        contenido = blob.download_as_bytes()
        blob.reload()
        content_type = blob.content_type or "application/octet-stream"
        return Response(
            content=contenido,
            media_type=content_type,
            headers={"Content-Disposition": f"attachment; filename={ubicacion.split('/')[-1]}"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener imagen para descarga: {str(e)}")