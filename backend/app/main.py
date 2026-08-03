import logging
import os
import io
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.core.limiter import limiter
from PIL import Image

# --- RUTAS FUTURAS ---
# from app.api.user.route import add_user_routes
# from app.api.analysis.route import add_analysis_routes

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
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["127.0.0.1"])
app.add_exception_handler(
    RateLimitExceeded,
    lambda request, exc: JSONResponse(
        status_code=429,
        content={"detail": "Demasiadas solicitudes. Intentá de nuevo más tarde."},
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Sistema"])
def read_root():
    return {"status": "ok", "message": "Digpatho Veterinaria API v1.0.0"}


@app.get("/health", tags=["Sistema"])
def health_check():
    return {"status": "healthy"}


@app.post("/api/v1/analyze-smear", tags=["Análisis"])
async def analyze_smear(
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
    # Validar que es una imagen
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen (JPG/PNG).")

    image_bytes = await file.read()
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="No se pudo leer la imagen. Asegurate de subir un JPG o PNG válido.")

    img_array = np.array(image)
    h, w = img_array.shape[:2]
    logger.info(f"Imagen recibida: {w}x{h}px | Especie: {especie} | Raza: {raza} | Edad: {edad} | Sexo: {sexo}")

    # ─────────────────────────────────────────────────────────────
    # PIPELINE DE IA (Reemplazar simulación cuando el modelo esté listo)
    # ─────────────────────────────────────────────────────────────
    # Paso 1: Cellpose → detectar y segmentar células
    # masks, flows, styles = cellpose_model.eval(img_array, diameter=None, channels=[0,0])
    # cell_crops = [crop(img_array, mask) for mask in masks]
    #
    # Paso 2: ResNet → clasificar cada recorte
    # cell_labels = [resnet_model.predict(crop) for crop in cell_crops]
    #
    # Paso 3: Construir conteos
    # counts = build_counts(cell_labels)
    # ─────────────────────────────────────────────────────────────

    # SIMULACIÓN ESTRUCTURADA (datos realistas hasta integrar el modelo)
    simulated_counts = {
        "neutro_abs": 12.5,
        "linfo_abs": 1.2,
        "mono_abs": 0.5,
        "eosino_abs": 2.1,
        "baso_abs": 0.0,
    }

    clinical_alerts = []
    if simulated_counts["eosino_abs"] > 1.25:
        clinical_alerts.append("Eosinofilia detectada: Compatible con parasitismo tisular, hipersensibilidad o síndrome eosinofílico.")
    if simulated_counts["linfo_abs"] < 1.0:
        clinical_alerts.append("Linfopenia: Compatible con estrés agudo, hipercortisolismo o infección viral.")

    return JSONResponse(content={
        "status": "success",
        "patient": {"especie": especie, "raza": raza, "edad": edad, "sexo": sexo},
        "image_info": {"width": w, "height": h},
        "counts": simulated_counts,
        "bounding_boxes": [],  # Se llenará con las máscaras de Cellpose
        "clinical_alerts": clinical_alerts,
    })
