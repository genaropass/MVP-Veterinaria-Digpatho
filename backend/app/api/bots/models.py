from typing import Optional
from pydantic import BaseModel


# ─── Health ───

class ModulesStatus(BaseModel):
    cientifico: bool = True
    genial: bool = True


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0"
    modules: ModulesStatus = ModulesStatus()


# ─── Interconsulta ───
# NOTA: los campos van en camelCase para coincidir EXACTO con los tipos
# del frontend (src/components/bots/mock-data.ts). El front consume la
# respuesta sin capa de traducción.

class InterconsultaRequest(BaseModel):
    tipoEntrada: str
    imagenId: Optional[str] = None
    informeId: Optional[str] = None
    pacienteId: Optional[str] = None
    contextoClinico: Optional[str] = None
    especialidad: Optional[str] = None


class Citation(BaseModel):
    id: str
    title: str
    source: str
    url: str
    year: int


class SimilarCase(BaseModel):
    id: str
    label: str
    similarity: float
    source: str  # "laboratorio" | "pubmed"


class HeatmapRegion(BaseModel):
    label: str
    x: float
    y: float
    w: float
    h: float


class InterconsultaResponse(BaseModel):
    id: str
    status: str
    summary: Optional[str] = None
    confidence: Optional[str] = None  # alta | media | baja | no_concluyente
    citations: list[Citation] = []
    similarCases: list[SimilarCase] = []
    heatmapRegions: list[HeatmapRegion] = []
    disclaimer: Optional[str] = None
    imagenId: Optional[str] = None


class InterconsultaAsyncResponse(BaseModel):
    id: str
    taskId: str
    status: str  # pending | processing


class InterconsultaTaskStatus(BaseModel):
    status: str  # pending | processing | done | failed
    result: Optional[InterconsultaResponse] = None


# ─── Vigilancia ───

class TopicRequest(BaseModel):
    topic: str


class TopicsResponse(BaseModel):
    topics: list[str]


class VigilanciaItem(BaseModel):
    id: str
    topic: str
    title: str
    source: str
    url: str
    publishedAt: str
    impact: str  # alto | medio | bajo
    summary: str


class VigilanciaFeedResponse(BaseModel):
    items: list[VigilanciaItem]


# ─── Cápsulas (Desafíos) ───

class CapsuleOption(BaseModel):
    id: str
    label: str
    votes: int


class CapsuleResponse(BaseModel):
    id: str
    title: str
    specialty: str
    question: str
    options: list[CapsuleOption]
    timeLimit: str
    imagenId: Optional[str] = None


class CapsuleAnswerRequest(BaseModel):
    optionId: str


class CapsuleAnswerResponse(BaseModel):
    ok: bool


# ─── Foros ───

class ForumThread(BaseModel):
    id: str
    title: str
    author: str
    replies: int
    specialty: str
    lastActivity: str
    tags: list[str]
    interconsultaId: Optional[str] = None
    casoId: Optional[str] = None


class ForumCreateRequest(BaseModel):
    title: str
    specialty: str
    tags: list[str] = []
    interconsultaId: Optional[str] = None


class ForumListResponse(BaseModel):
    threads: list[ForumThread]


# ─── Badges ───

class Badge(BaseModel):
    id: str
    name: str
    description: str
    earnedAt: Optional[str] = None
    locked: bool = False


class BadgesResponse(BaseModel):
    badges: list[Badge]


# ─── Divulgación ───

class Draft(BaseModel):
    id: str
    title: str
    body: str
    status: str
    createdAt: str
    metricsSource: Optional[str] = None


class DraftsResponse(BaseModel):
    drafts: list[Draft]


class DraftUpdateRequest(BaseModel):
    action: str  # approve | edit
    body: Optional[str] = None


# ─── Bienestar ───

class WellnessResponse(BaseModel):
    show: bool
    message: str
    sessionHours: float
