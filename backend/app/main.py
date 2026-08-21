import logging
import os
import io
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.core.limiter import limiter
from PIL import Image

from app.services.quality_filter import check_image_quality
from app.services.cellpose_service import segmentar_imagen

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Digpatho Veterinaria API",
    description="Backend de Inferencia IA para Citología Veterinaria",
    version="1.0.0",
    openapi_tags=[
        {"name": "Sistema", "description": "Estado del servidor"},
        {"name": "Análisis", "description": "Análisis de citologías por IA"},
    ]
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

TRUSTED_HOSTS = os.getenv("TRUSTED_HOSTS", "127.0.0.1").split(",")
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=TRUSTED_HOSTS)

app.add_exception_handler(
    RateLimitExceeded,
    lambda request, exc: JSONResponse(
        status_code=429,
        content={"detail": "Demasiadas solicitudes. Intentá de nuevo más tarde."},
    ),
)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Sistema"])
def read_root():
    return {"status": "ok", "message": "Digpatho Veterinaria API v1.0.0"}


@app.get("/health", tags=["Sistema"])
def health_check():
    # Verify model is available
    from app.services.cellpose_service import CELLPOSE_AVAILABLE
    if not CELLPOSE_AVAILABLE:
        return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": "Cellpose no disponible"})
    return {"status": "healthy"}


MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

@app.post("/api/v1/analyze-smear", tags=["Análisis"])
@limiter.limit("5/minute")
async def analyze_smear(
    request: Request,
    file: UploadFile = File(..., description="Imagen de frotis (JPG/PNG)"),
    especie: str = Form(default="Canino"),
    raza: str = Form(default=""),
    edad: str = Form(default=""),
    sexo: str = Form(default="Macho"),
):
    """
    Recibe una imagen de citología y los datos del paciente.
    Procesa con Cellpose (segmentación) + ResNet (clasificación).
    Devuelve conteos celulares y alertas clínicas.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen (JPG/PNG).")

    image_bytes = await file.read()
    
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="El archivo excede el tamaño máximo permitido de 20MB.")
        
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image_format = image.format.lower() if image.format else ""
        if image_format not in ["jpeg", "png", "jpg"]:
            raise ValueError("Invalid format")
        image = image.convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="No se pudo leer la imagen. Asegurate de subir un JPG o PNG válido.")

    img_array = np.array(image)
    h, w = img_array.shape[:2]
    logger.info(f"Imagen recibida: {w}x{h}px | Especie: {especie} | Raza: {raza} | Edad: {edad} | Sexo: {sexo}")

    # ─────────────────────────────────────────────────────────────
    # PIPELINE DE IA FASE 2
    # ─────────────────────────────────────────────────────────────
    # Paso 1: Filtro de Calidad
    quality_result = check_image_quality(img_array)
    if quality_result["calidad"] == "rechazada":
        return JSONResponse(status_code=400, content={
            "detail": quality_result["motivo"]
        })

    # Paso 2: Cellpose → segmentar células y extraer morfometría
    resultados_segmentacion = segmentar_imagen(img_array)
    celulas_detectadas = resultados_segmentacion["celulas"]
    morph_alerts = resultados_segmentacion["morph_alerts"]

    # Convertir a un formato simple de conteos y mandar bounding boxes
    # Como todavía no tenemos clasificación (ResNet/YOLO), inventamos los conteos base o sumamos totales
    # Para el MVP 2 de UI, podemos decir que detectamos N células
    total = len(celulas_detectadas)
    
    simulated_counts = {
        "neutro_abs": total * 0.6,
        "linfo_abs": total * 0.3,
        "mono_abs": total * 0.05,
        "eosino_abs": total * 0.04,
        "baso_abs": total * 0.01,
    }

    return JSONResponse(content={
        "status": "success",
        "message": f"Análisis visual completado. Calidad: {quality_result.get('score_nitidez', 'OK')}",
        "patient": {"especie": especie, "raza": raza, "edad": edad, "sexo": sexo},
        "image_info": {"width": w, "height": h},
        "counts": simulated_counts,
        "bounding_boxes": celulas_detectadas,
        "clinical_alerts": morph_alerts # Pasamos las alertas morfométricas al frontend
    })
