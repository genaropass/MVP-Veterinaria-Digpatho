import logging
import math
import os
import tempfile
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
import openslide
from openslide.deepzoom import DeepZoomGenerator

from google.cloud import storage

from app.utils.tiles_wsi import obtener_tile_wsi
from app.api.database import db
from app.api.image import crud

logger = logging.getLogger(__name__)

# Ajustamos la ruta para que apunte a backend/data
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "..", "data"))

# Cache local de WSIs descargados desde GCS (compartido entre metadata y tiles).
WSI_CACHE_DIR = os.path.join(tempfile.gettempdir(), "wsi_cache")
os.makedirs(WSI_CACHE_DIR, exist_ok=True)

logger.info("Tiles - DATA_DIR configurado: %s", DATA_DIR)
logger.info("Tiles - BASE_DIR: %s", BASE_DIR)
logger.info("Tiles - DATA_DIR existe: %s", os.path.exists(DATA_DIR))
logger.info("Tiles - WSI_CACHE_DIR: %s", WSI_CACHE_DIR)
if os.path.exists(DATA_DIR):
    archivos = os.listdir(DATA_DIR)
    logger.info("Tiles - Archivos en DATA_DIR: %s", archivos[:10])  # Primeros 10


def _build_metadata_from_slide(slide: "openslide.OpenSlide") -> dict:
    """
    Construye la metadata que consume OpenSeadragon a partir de un slide abierto.
    maxLevel se calcula con DeepZoomGenerator (mismo esquema que usa el tiler),
    NO con slide.level_count, para que la grilla de tiles coincida.
    """
    width, height = slide.dimensions
    dz = DeepZoomGenerator(slide, tile_size=256, overlap=0, limit_bounds=False)
    return {
        "width": width,
        "height": height,
        "tileSize": 256,
        "minLevel": 0,
        "maxLevel": dz.level_count - 1,
    }


async def _ensure_wsi_local(imagen_id: str) -> str:
    """
    Garantiza que el WSI de GCS esté en el cache local. Lo descarga una sola vez.
    Devuelve la ruta local. Reutilizado por metadata v2 y tiles v2 para no
    descargar el archivo completo en cada request de tile.
    """
    imagen = await crud.get_imagen(db, imagen_id)
    if not imagen:
        logger.warning("Imagen no encontrada en BD: %s", imagen_id)
        raise HTTPException(status_code=404, detail=f"Imagen no encontrada: {imagen_id}")

    if imagen.tipo_imagen != "wsi":
        raise HTTPException(
            status_code=400,
            detail=f"La imagen no es WSI. Tipo: {imagen.tipo_imagen}",
        )

    # Conservamos la extensión original (importa para algunos vendors de OpenSlide).
    ext = os.path.splitext(imagen.ubicacion)[1] or ".svs"
    local_path = os.path.join(WSI_CACHE_DIR, f"{imagen_id}{ext}")

    if not os.path.exists(local_path):
        logger.info("Cache miss — descargando WSI desde GCS: %s", imagen.ubicacion)
        storage_client = storage.Client()
        bucket_name = os.getenv("GCS_BUCKET_NAME", "ki67-images")
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(imagen.ubicacion)

        # Descarga atómica: bajamos a .part y renombramos al final,
        # para que requests concurrentes no lean un archivo a medio bajar.
        tmp_path = local_path + ".part"
        blob.download_to_filename(tmp_path)
        os.replace(tmp_path, local_path)
        logger.info("WSI cacheado en: %s", local_path)
    else:
        logger.debug("Cache hit: %s", local_path)

    return local_path


def add_tiles_routes(app: FastAPI):
    """
    Registers all tile-related routes into the FastAPI application.
    """

    @app.get("/tiles", tags=["Tiles"])
    async def estado_tiles():
        return {"estado": "Tile server activo"}

    # ---------------------------------------------------------------- #
    #  Camino LOCAL (archivos en DATA_DIR)                              #
    # ---------------------------------------------------------------- #

    @app.get("/tiles/metadata/{nombre_wsi}", tags=["Tiles"])
    async def obtener_metadata(nombre_wsi: str):
        try:
            ruta_wsi = os.path.realpath(os.path.join(DATA_DIR, nombre_wsi))
            if not ruta_wsi.startswith(os.path.realpath(DATA_DIR) + os.sep):
                raise HTTPException(status_code=400, detail="Nombre de archivo inválido")
            logger.debug("Buscando archivo WSI: %s", ruta_wsi)

            if not os.path.exists(ruta_wsi):
                logger.warning("Archivo no encontrado: %s", ruta_wsi)
                raise HTTPException(status_code=404, detail=f"Archivo WSI no encontrado: {nombre_wsi}")

            slide = None
            try:
                slide = openslide.OpenSlide(ruta_wsi)
                metadata = _build_metadata_from_slide(slide)
                logger.debug("Metadata local: %s", metadata)
                return metadata
            finally:
                if slide:
                    slide.close()

        except openslide.OpenSlideError as e:
            error_msg = f"Error al abrir archivo WSI con OpenSlide: {str(e)}"
            logger.exception(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
        except HTTPException:
            raise
        except Exception as e:
            error_msg = f"Error inesperado al obtener metadata: {str(e)}"
            logger.exception(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

    @app.get("/tiles/{nombre_wsi}/{nivel}/{x}/{y}", tags=["Tiles"])
    async def obtener_tile(nombre_wsi: str, nivel: int, x: int, y: int):
        try:
            ruta_wsi = os.path.realpath(os.path.join(DATA_DIR, nombre_wsi))
            if not ruta_wsi.startswith(os.path.realpath(DATA_DIR) + os.sep):
                logger.warning("Nombre de archivo inválido: %s", ruta_wsi)
                raise HTTPException(status_code=400, detail="Nombre de archivo inválido")

            if not os.path.exists(ruta_wsi):
                logger.warning("Archivo no encontrado: %s", ruta_wsi)
                raise HTTPException(status_code=404, detail=f"Archivo WSI no encontrado: {nombre_wsi}")

            tile_bytes = obtener_tile_wsi(wsi_path=ruta_wsi, nivel=nivel, x=x, y=y, tile_size=256)

            if not tile_bytes:
                logger.warning("Tile vacío para nivel=%d, x=%d, y=%d", nivel, x, y)
                raise HTTPException(status_code=404, detail="Tile vacío o fuera de rango")

            return Response(content=tile_bytes, media_type="image/jpeg")

        except HTTPException:
            raise
        except Exception as e:
            error_msg = f"Error al obtener tile: {str(e)}"
            logger.exception(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

    # ---------------------------------------------------------------- #
    #  Camino V2 (archivos en GCS, vía imagen_id de BD)                 #
    # ---------------------------------------------------------------- #

    @app.get("/tiles-v2/{imagen_id}/metadata", tags=["Tiles"])
    async def obtener_metadata_v2(imagen_id: str):
        """
        Metadata real (dimensiones, niveles) para WSI alojado en GCS.
        Este es el endpoint que faltaba: sin él, el front caía al placeholder.
        """
        try:
            local_path = await _ensure_wsi_local(imagen_id)
            slide = None
            try:
                slide = openslide.OpenSlide(local_path)
                metadata = _build_metadata_from_slide(slide)
                logger.debug("Metadata v2 (%s): %s", imagen_id, metadata)
                return metadata
            finally:
                if slide:
                    slide.close()

        except HTTPException:
            raise
        except openslide.OpenSlideError as e:
            logger.exception("OpenSlide error en metadata v2")
            raise HTTPException(status_code=500, detail=f"Error de OpenSlide: {str(e)}")
        except Exception as e:
            logger.exception("Error inesperado en metadata v2")
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/tiles-v2/{imagen_id}/{nivel}/{x}/{y}", tags=["Tiles"])
    async def obtener_tile_v2(imagen_id: str, nivel: int, x: int, y: int):
        """
        Tiles para WSI en GCS. Usa el cache local (descarga una sola vez),
        en lugar de descargar el archivo completo en cada request.
        """
        try:
            local_path = await _ensure_wsi_local(imagen_id)
            tile_bytes = obtener_tile_wsi(wsi_path=local_path, nivel=nivel, x=x, y=y, tile_size=256)

            if not tile_bytes:
                logger.warning("Tile vacío para nivel=%d, x=%d, y=%d", nivel, x, y)
                raise HTTPException(status_code=404, detail="Tile vacío o fuera de rango")

            return Response(content=tile_bytes, media_type="image/jpeg")

        except HTTPException:
            raise
        except Exception as e:
            error_msg = f"Error al obtener tile V2: {str(e)}"
            logger.exception(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
