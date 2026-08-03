import logging

from fastapi import APIRouter, HTTPException
import openslide
import os

logger = logging.getLogger(__name__)

router = APIRouter()

# Ruta anclada al archivo, no al cwd del proceso
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CARPETA_DATA = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "data"))

@router.get("/analizar/{nombre_archivo}")
def analizar_wsi(nombre_archivo: str):
    """
    Ingesta de WSI (SVS, NDPI, MRXS) integrada al Backend.
    """
    ruta_completa = os.path.realpath(os.path.join(CARPETA_DATA, nombre_archivo))
    if not ruta_completa.startswith(os.path.realpath(CARPETA_DATA) + os.sep):
        logger.warning("Nombre de archivo inválido: %s", ruta_completa)
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")

    if not os.path.exists(ruta_completa):
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {nombre_archivo}")

    try:
        slide = openslide.OpenSlide(ruta_completa)
        
        # Extracción de metadatos
        dim = slide.dimensions
        vendor = slide.properties.get(openslide.PROPERTY_NAME_VENDOR, "generico")
        zoom = slide.properties.get(openslide.PROPERTY_NAME_OBJECTIVE_POWER, "N/A")
        
        # Generación de Thumbnail
        # (Idealmente esto se guardaría en un storage real tipo S3, pero para la PoC local va bien)
        thumb_name = f"thumb_{os.path.basename(nombre_archivo)}.jpg"
        thumb_path = os.path.join(CARPETA_DATA, thumb_name)
        slide.get_thumbnail((500, 500)).save(thumb_path)

        return {
            "status": "success",
            "file": nombre_archivo,
            "vendor": vendor,
            "metadata": {
                "width": dim[0],
                "height": dim[1],
                "magnification": zoom
            },
            "thumbnail_generated": thumb_path
        }

    except Exception as e:
        logger.exception("Error procesando WSI: %s", e)
        raise HTTPException(status_code=500, detail=str(e))