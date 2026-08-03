/** Contrato compartido front ↔ back para los bots Digpatho */

export type ConfidenceLevel = "alta" | "media" | "baja" | "no_concluyente";
export type ImpactLevel = "alto" | "medio" | "bajo";
export type SimilarCaseSource = "laboratorio" | "pubmed";
export type InterconsultaInputType = "wsi" | "pdf" | "texto" | "imagen_ihc";

export type Citation = {
  id: string;
  title: string;
  source: string;
  url: string;
  year: number;
};

export type SimilarCase = {
  id: string;
  label: string;
  similarity: number;
  source: SimilarCaseSource;
};

export type HeatmapRegion = {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type InterconsultaResult = {
  id?: string;
  summary: string;
  confidence: ConfidenceLevel;
  citations: Citation[];
  similarCases: SimilarCase[];
  heatmapRegions: HeatmapRegion[];
  disclaimer: string;
  imagenId?: string;
  informeId?: string;
  status?: "pending" | "processing" | "done" | "failed";
};

export type VigilanceItem = {
  id: string;
  topic: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  impact: ImpactLevel;
  summary: string;
};

export type ChallengeOption = {
  id: string;
  label: string;
  votes: number;
};

export type ChallengeCapsule = {
  id: string;
  title: string;
  specialty: string;
  question: string;
  options: ChallengeOption[];
  timeLimit: string;
  imagenId?: string;
  tilePreviewUrl?: string;
};

export type ForumThread = {
  id: string;
  title: string;
  author: string;
  replies: number;
  specialty: string;
  lastActivity: string;
  tags: string[];
  interconsultaId?: string;
  casoId?: string;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  earnedAt?: string;
  locked?: boolean;
};

export type DivulgacionDraft = {
  id: string;
  title: string;
  body: string;
  status: "pending_review" | "approved" | "scheduled" | "published";
  createdAt: string;
  metricsSource?: string;
};

export type WellnessAlert = {
  show: boolean;
  message: string;
  sessionHours?: number;
};

export type BotsHealthResponse = {
  status: "ok";
  version?: string;
  modules?: {
    cientifico?: boolean;
    genial?: boolean;
  };
};

/** Payload POST /bot/cientifico/interconsulta */
export type InterconsultaRequest = {
  contexto_clinico?: string;
  paciente_id?: string;
  informe_id?: string;
  imagen_id?: string;
  tipo_entrada: InterconsultaInputType;
  especialidad?: string;
};

/** Respuesta async (si el back devuelve task_id como upload/) */
export type InterconsultaJobResponse = {
  interconsulta_id: string;
  task_id?: string;
  status: "pending" | "processing" | "done" | "failed";
  result?: InterconsultaResult;
};
