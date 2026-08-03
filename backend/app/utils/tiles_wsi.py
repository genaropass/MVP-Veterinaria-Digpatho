import io
import logging
import openslide
from openslide.deepzoom import DeepZoomGenerator

logger = logging.getLogger(__name__)

TILE_SIZE = 256


def obtener_tile_wsi(
    wsi_path: str,
    nivel: int,
    x: int,
    y: int,
    tile_size: int = TILE_SIZE
):
    """
    Devuelve un tile JPEG para OpenSeadragon usando DeepZoomGenerator.

    'nivel' es el nivel DeepZoom/OpenSeadragon (0 = más alejado, maxLevel = full res).
    'x', 'y' son índices de columna y fila del tile dentro de ese nivel.
    No requiere inversión de niveles: DeepZoom ya usa la misma convención que OSD.
    """
    slide = None
    try:
        slide = openslide.OpenSlide(wsi_path)

        # overlap=0 y tile_size=256 → grilla limpia que matchea tileSize de OSD.
        # limit_bounds=False → dimensiones coinciden con slide.dimensions (metadata).
        dz = DeepZoomGenerator(
            slide,
            tile_size=tile_size,
            overlap=0,
            limit_bounds=False,
        )

        # Validar rango de nivel
        if nivel < 0 or nivel >= dz.level_count:
            logger.warning("Nivel %d fuera de rango (0-%d)", nivel, dz.level_count - 1)
            return None

        # Validar rango de tile (cols, rows) para ese nivel
        cols, rows = dz.level_tiles[nivel]
        if x < 0 or y < 0 or x >= cols or y >= rows:
            logger.warning(
                "Tile fuera de rango: x=%d (cols=%d), y=%d (rows=%d), nivel=%d",
                x, cols, y, rows, nivel,
            )
            return None

        # DeepZoom devuelve PIL.Image (RGB o RGBA según el slide)
        tile = dz.get_tile(nivel, (x, y))
        if tile.mode != "RGB":
            tile = tile.convert("RGB")

        buffer = io.BytesIO()
        tile.save(buffer, format="JPEG", quality=90)
        return buffer.getvalue()

    except openslide.OpenSlideError as e:
        error_msg = f"Error de OpenSlide al leer tile: {str(e)}"
        logger.exception(error_msg)
        raise Exception(error_msg)
    except Exception as e:
        error_msg = f"Error inesperado al obtener tile: {str(e)}"
        logger.exception(error_msg)
        raise Exception(error_msg)
    finally:
        if slide:
            slide.close()
