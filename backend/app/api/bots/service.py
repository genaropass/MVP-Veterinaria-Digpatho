import os
import uuid
import json
from fastapi import HTTPException
from app.api.bots import crud, models
from prisma import Prisma

try:
    import vertexai
    from vertexai.generative_models import GenerativeModel
    VERTEX_AVAILABLE = True
except ImportError:
    VERTEX_AVAILABLE = False

DISCLAIMER = (
    "Soporte a la decisión clínica. No constituye diagnóstico autónomo. "
    "El patólogo conserva el control final."
)

GOOGLE_PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
GOOGLE_LOCATION = os.getenv("GOOGLE_LOCATION", "us-central1")
VERTEX_MODEL_ID = os.getenv("VERTEX_MODEL_ID", "gemini-1.5-flash")


def _init_vertex():
    if not VERTEX_AVAILABLE:
        return None
    if not GOOGLE_PROJECT_ID:
        return None
    vertexai.init(project=GOOGLE_PROJECT_ID, location=GOOGLE_LOCATION)
    return GenerativeModel(VERTEX_MODEL_ID)


_vertex_model = None


def get_vertex_model():
    global _vertex_model
    if _vertex_model is None:
        _vertex_model = _init_vertex()
    return _vertex_model


def valid_uuid(id_str: str):
    try:
        uuid.UUID(id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"ID inválido: {id_str}")


# ──────────────────────────────────────────────
#  Interconsulta — Vertex AI pipeline
# ──────────────────────────────────────────────

INTERCONSULTA_PROMPT = """Sos un asistente de patología digital. Analizá el siguiente caso clínico y proporcioná:

1. Un resumen diagnóstico fundamentado (2-3 oraciones)
2. Nivel de confianza: "alta", "media", "baja" o "no_concluyente"
3. Hasta 3 citas bibliográficas relevantes (título, fuente, año, URL si es posible)
4. Hasta 3 casos similares que podrían encontrarse en un laboratorio o PubMed

REGLAS OBLIGATORIAS:
- Si no podés fundamentar con bibliografía, el nivel de confianza DEBE ser "no_concluyente"
- No emitas diagnóstico autónomo
- Usá terminología estándar (WHO, CAP, ISUP)

Respondé EXCLUSIVAMENTE en JSON con este formato (claves en camelCase):
{{
  "summary": "texto del resumen",
  "confidence": "alta|media|baja|no_concluyente",
  "citations": [
    {{"id": "c1", "title": "...", "source": "...", "url": "...", "year": 2024}}
  ],
  "similarCases": [
    {{"id": "s1", "label": "...", "similarity": 0.85, "source": "laboratorio|pubmed"}}
  ]
}}

CASO:
Tipo de entrada: {tipo_entrada}
Especialidad: {especialidad}
Contexto clínico: {contexto_clinico}
"""


async def run_interconsulta(db: Prisma, req: models.InterconsultaRequest) -> dict:
    record = await crud.create_interconsulta(db, {
        "tipoEntrada": req.tipoEntrada,
        "imagenId": req.imagenId,
        "informeId": req.informeId,
        "pacienteId": req.pacienteId,
        "contextoClinico": req.contextoClinico,
        "especialidad": req.especialidad,
        "status": "processing",
    })

    model = get_vertex_model()

    if model:
        try:
            analysis = await _run_vertex_analysis(model, req)
        except Exception as e:
            print(f"Error Vertex AI: {e}")
            analysis = _fallback_analysis(req)
    else:
        analysis = _fallback_analysis(req)

    # Regla de negocio: sin citas bibliográficas => no concluyente
    if not analysis.get("citations"):
        analysis["confidence"] = "no_concluyente"

    update_data = {
        "status": "done",
        "summary": analysis["summary"],
        "confidence": analysis["confidence"],
        "citations": analysis["citations"],
        "similarCases": analysis["similarCases"],
        "heatmapRegions": analysis.get("heatmapRegions", []),
        "disclaimer": DISCLAIMER,
    }
    await crud.update_interconsulta_result(db, record.id, update_data)

    return {
        "id": record.id,
        "status": "done",
        "summary": analysis["summary"],
        "confidence": analysis["confidence"],
        "citations": analysis["citations"],
        "similarCases": analysis["similarCases"],
        "heatmapRegions": analysis.get("heatmapRegions", []),
        "disclaimer": DISCLAIMER,
        "imagenId": req.imagenId,
    }


def _normalize_analysis(result: dict) -> dict:
    """Acepta claves camelCase o snake_case del modelo y normaliza a camelCase."""
    return {
        "summary": result.get("summary", ""),
        "confidence": result.get("confidence", "no_concluyente"),
        "citations": result.get("citations", []),
        "similarCases": result.get("similarCases", result.get("similar_cases", [])),
        "heatmapRegions": result.get("heatmapRegions", result.get("heatmap_regions", [])),
    }


async def _run_vertex_analysis(model, req: models.InterconsultaRequest) -> dict:
    prompt = INTERCONSULTA_PROMPT.format(
        tipo_entrada=req.tipoEntrada or "texto",
        especialidad=req.especialidad or "No especificada",
        contexto_clinico=req.contextoClinico or "No proporcionado",
    )

    response = model.generate_content(prompt)
    text = response.text.strip()

    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    return _normalize_analysis(json.loads(text))


def _fallback_analysis(req: models.InterconsultaRequest) -> dict:
    especialidad = req.especialidad or "patología general"
    return {
        "summary": (
            f"Análisis preliminar para caso de {especialidad}. "
            "Se requiere correlación clínico-patológica. "
            "Consulte la bibliografía adjunta para fundamentación."
        ),
        "confidence": "no_concluyente",
        "citations": [
            {
                "id": "c1",
                "title": "WHO Classification of Tumours, 5th Edition",
                "source": "WHO / IARC",
                "url": "https://publications.iarc.who.int/",
                "year": 2020,
            }
        ],
        "similarCases": [],
        "heatmapRegions": [],
    }


# ──────────────────────────────────────────────
#  Vigilancia — PubMed placeholder
# ──────────────────────────────────────────────

async def fetch_pubmed_articles(topic: str, limit: int = 10) -> list[dict]:
    """Placeholder — reemplazar con PubMed E-utilities reales."""
    return [
        {
            "id": f"v-{topic}-{i}",
            "topic": topic,
            "title": f"Artículo reciente sobre {topic} #{i+1}",
            "source": "PubMed",
            "url": "https://pubmed.ncbi.nlm.nih.gov/",
            "publishedAt": "2025-01-01",
            "impact": "medio",
            "summary": f"Revisión actualizada sobre {topic}. Consulte fuente original.",
        }
        for i in range(min(limit, 3))
    ]
