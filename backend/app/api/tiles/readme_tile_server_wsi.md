# Tile Server WSI (Sistema Mosaicos)

## Descripción
Servicio backend para la extracción de tiles desde imágenes WSI (Whole Slide Images) utilizando **OpenSlide** y **FastAPI**. Está pensado para ser consumido por un visor web que solicite tiles por nivel y coordenadas.


## Dependencias
- Python 3.10+
- FastAPI
- OpenSlide
- Uvicorn


## Endpoints

### Verificacion de modulo
GET `/tiles`

**Respuesta esperada**
{ "estado": "Tile server activo" }

### Obtener tile WSI
GET `/tiles/{nombre_wsi}/{nivel}/{x}/{y}`

**Parámetros:**
- `nombre_wsi`: nombre del archivo WSI (ej: `CMU-1-Small-Region.svs`)
- `nivel`: nivel de zoom
- `x`: coordenada X del tile
- `y`: coordenada Y del tile

**Respuesta:**
- Imagen JPEG del tile solicitado

Ejemplo:
GET /tiles/CMU-1-Small-Region.svs/0/0/0


## Notas
- La carpeta `data/` debe existir localmente y contener las imágenes WSI.
- Los niveles y coordenadas dependen de la imagen y referencias pueden ser agregadas cuando el visor web se implemente.
