import type {
  Badge,
  ChallengeCapsule,
  Citation,
  DivulgacionDraft,
  ForumThread,
  HeatmapRegion,
  InterconsultaResult,
  SimilarCase,
  VigilanceItem,
  WellnessAlert,
} from "@/types/bots";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function mapCitation(raw: Record<string, unknown>): Citation {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    source: String(raw.source ?? ""),
    url: String(raw.url ?? ""),
    year: Number(raw.year ?? 0),
  };
}

export function mapSimilarCase(raw: Record<string, unknown>): SimilarCase {
  return {
    id: String(raw.id ?? ""),
    label: String(raw.label ?? ""),
    similarity: Number(raw.similarity ?? 0),
    source: (raw.source as SimilarCase["source"]) ?? "laboratorio",
  };
}

export function mapHeatmapRegion(raw: Record<string, unknown>): HeatmapRegion {
  return {
    label: String(raw.label ?? ""),
    x: Number(raw.x ?? 0),
    y: Number(raw.y ?? 0),
    w: Number(raw.w ?? raw.width ?? 0),
    h: Number(raw.h ?? raw.height ?? 0),
  };
}

export function mapInterconsultaResult(raw: Record<string, unknown>): InterconsultaResult {
  return {
    id: raw.id != null ? String(raw.id) : undefined,
    summary: String(raw.summary ?? ""),
    confidence: (raw.confidence as InterconsultaResult["confidence"]) ?? "no_concluyente",
    citations: asArray<Record<string, unknown>>(raw.citations).map(mapCitation),
    similarCases: asArray<Record<string, unknown>>(raw.similar_cases ?? raw.similarCases).map(
      mapSimilarCase
    ),
    heatmapRegions: asArray<Record<string, unknown>>(
      raw.heatmap_regions ?? raw.heatmapRegions
    ).map(mapHeatmapRegion),
    disclaimer: String(
      raw.disclaimer ??
        "Soporte a la decisión clínica. No constituye diagnóstico autónomo. El patólogo conserva el control final."
    ),
    imagenId:
      raw.imagen_id != null
        ? String(raw.imagen_id)
        : raw.imagenId != null
          ? String(raw.imagenId)
          : undefined,
    informeId:
      raw.informe_id != null
        ? String(raw.informe_id)
        : raw.informeId != null
          ? String(raw.informeId)
          : undefined,
    status: raw.status as InterconsultaResult["status"],
  };
}

export function mapVigilanceItem(raw: Record<string, unknown>): VigilanceItem {
  return {
    id: String(raw.id ?? ""),
    topic: String(raw.topic ?? ""),
    title: String(raw.title ?? ""),
    source: String(raw.source ?? ""),
    url: String(raw.url ?? ""),
    publishedAt: String(raw.published_at ?? raw.publishedAt ?? ""),
    impact: (raw.impact as VigilanceItem["impact"]) ?? "bajo",
    summary: String(raw.summary ?? ""),
  };
}

export function mapChallengeCapsule(raw: Record<string, unknown>): ChallengeCapsule {
  const options = asArray<Record<string, unknown>>(raw.options).map((opt) => ({
    id: String(opt.id ?? ""),
    label: String(opt.label ?? ""),
    votes: Number(opt.votes ?? 0),
  }));

  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    specialty: String(raw.specialty ?? raw.especialidad ?? ""),
    question: String(raw.question ?? ""),
    options,
    timeLimit: String(raw.time_limit ?? raw.timeLimit ?? ""),
    imagenId:
      raw.imagen_id != null
        ? String(raw.imagen_id)
        : raw.imagenId != null
          ? String(raw.imagenId)
          : undefined,
    tilePreviewUrl:
      raw.tile_preview_url != null
        ? String(raw.tile_preview_url)
        : raw.tilePreviewUrl != null
          ? String(raw.tilePreviewUrl)
          : undefined,
  };
}

export function mapForumThread(raw: Record<string, unknown>): ForumThread {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    author: String(raw.author ?? raw.autor ?? ""),
    replies: Number(raw.replies ?? raw.respuestas ?? 0),
    specialty: String(raw.specialty ?? raw.especialidad ?? ""),
    lastActivity: String(raw.last_activity ?? raw.lastActivity ?? ""),
    tags: asArray<string>(raw.tags).map(String),
    interconsultaId:
      raw.interconsulta_id != null
        ? String(raw.interconsulta_id)
        : undefined,
    casoId: raw.caso_id != null ? String(raw.caso_id) : undefined,
  };
}

export function mapBadge(raw: Record<string, unknown>): Badge {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? raw.nombre ?? ""),
    description: String(raw.description ?? raw.descripcion ?? ""),
    earnedAt:
      raw.earned_at != null
        ? String(raw.earned_at)
        : raw.earnedAt != null
          ? String(raw.earnedAt)
          : undefined,
    locked: Boolean(raw.locked ?? raw.bloqueada ?? false),
  };
}

export function mapDivulgacionDraft(raw: Record<string, unknown>): DivulgacionDraft {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? raw.titulo ?? ""),
    body: String(raw.body ?? raw.cuerpo ?? ""),
    status: (raw.status as DivulgacionDraft["status"]) ?? "pending_review",
    createdAt: String(raw.created_at ?? raw.createdAt ?? ""),
    metricsSource:
      raw.metrics_source != null
        ? String(raw.metrics_source)
        : raw.metricsSource != null
          ? String(raw.metricsSource)
          : undefined,
  };
}

export function mapWellnessAlert(raw: Record<string, unknown>): WellnessAlert {
  return {
    show: Boolean(raw.show ?? raw.mostrar ?? false),
    message: String(
      raw.message ??
        "Llevás más de 3 h en la plataforma. Un descanso breve mejora la precisión diagnóstica."
    ),
    sessionHours:
      raw.session_hours != null
        ? Number(raw.session_hours)
        : raw.sessionHours != null
          ? Number(raw.sessionHours)
          : undefined,
  };
}
