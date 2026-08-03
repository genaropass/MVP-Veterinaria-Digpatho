import type {
  Badge,
  ChallengeCapsule,
  DivulgacionDraft,
  ForumThread,
  InterconsultaResult,
  VigilanceItem,
} from "@/types/bots";

export const MOCK_INTERCONSULTA: InterconsultaResult = {
  summary:
    "Patrón morfológico compatible con carcinoma ductal invasivo de bajo grado. Se observan áreas con arquitectura tubular y núcleos pleomórficos moderados. La evidencia bibliográfica sugiere correlación con HER2-low en contexto de mama.",
  confidence: "media",
  citations: [
    {
      id: "c1",
      title: "WHO Classification of Tumours: Breast Tumours, 5th ed.",
      source: "WHO / IARC",
      url: "https://publications.iarc.who.int/",
      year: 2019,
    },
    {
      id: "c2",
      title: "HER2-low breast cancer: pathological and clinical landscape",
      source: "PubMed",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      year: 2023,
    },
    {
      id: "c3",
      title: "CAP Protocol for Invasive Carcinoma of the Breast",
      source: "CAP",
      url: "https://www.cap.org/",
      year: 2022,
    },
  ],
  similarCases: [
    { id: "s1", label: "Caso #1847 — mama, CDI G2", similarity: 0.91, source: "laboratorio" },
    { id: "s2", label: "PMID 38123456 — carcinoma ductal invasivo", similarity: 0.84, source: "pubmed" },
    { id: "s3", label: "Caso #0921 — mama, CDI G1", similarity: 0.78, source: "laboratorio" },
  ],
  heatmapRegions: [
    { label: "Área sospechosa A", x: 12, y: 18, w: 28, h: 22 },
    { label: "Micro-metástasis posible", x: 55, y: 40, w: 14, h: 12 },
  ],
  disclaimer:
    "Soporte a la decisión clínica. No constituye diagnóstico autónomo. El patólogo conserva el control final.",
};

export const MOCK_VIGILANCE: VigilanceItem[] = [
  {
    id: "v1",
    topic: "HER2-low",
    title: "Nueva guía ASCO/CAP sobre clasificación HER2 en mama",
    source: "ASCO/CAP",
    url: "https://www.cap.org/",
    publishedAt: "2025-11-12",
    impact: "alto",
    summary:
      "Actualización de umbrales y criterios de reporte para HER2-low. Enlace a fuente original — resumen citado, no juicio clínico.",
  },
  {
    id: "v2",
    topic: "Ki-67",
    title: "Concordancia interobservador en cuantificación digital de Ki-67",
    source: "PubMed",
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    publishedAt: "2025-10-28",
    impact: "medio",
    summary:
      "Estudio comparativo de métodos automatizados vs. manual en 240 casos de mama.",
  },
  {
    id: "v3",
    topic: "mastocitoma canino",
    title: "Patrones histopatológicos en mastocitoma canino — revisión",
    source: "PubMed",
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    publishedAt: "2025-09-15",
    impact: "bajo",
    summary: "Revisión narrativa con énfasis en gradación y pronóstico en medicina veterinaria.",
  },
];

export const MOCK_CHALLENGE: ChallengeCapsule = {
  id: "ch1",
  title: "Cápsula de desafío diagnóstico",
  specialty: "Patología de mama",
  question: "¿Cuál es el patrón predominante en esta región del tile WSI?",
  options: [
    { id: "a", label: "Arquitectura cribiforme", votes: 12 },
    { id: "b", label: "Células en anillo de signet", votes: 3 },
    { id: "c", label: "Patrón micropapilar", votes: 8 },
    { id: "d", label: "No concluyente — derivar", votes: 5 },
  ],
  timeLimit: "2 min",
};

export const MOCK_FORUMS: ForumThread[] = [
  {
    id: "f1",
    title: "Segunda opinión: CDI G2 con foco HER2 ambiguo",
    author: "Dra. Martínez",
    replies: 7,
    specialty: "Mama",
    lastActivity: "hace 2 h",
    tags: ["interconsulta", "HER2", "segunda-opinión"],
  },
  {
    id: "f2",
    title: "Debate: mitosis atípica vs. artefacto de sección",
    author: "Dr. López",
    replies: 14,
    specialty: "Patología general",
    lastActivity: "hace 5 h",
    tags: ["cazador-de-patrones", "consenso"],
  },
  {
    id: "f3",
    title: "Caso resuelto: osteosarcoma canino vs. humano",
    author: "Comunidad One Health",
    replies: 23,
    specialty: "Veterinaria",
    lastActivity: "ayer",
    tags: ["one-health", "celebración"],
  },
];

export const MOCK_BADGES: Badge[] = [
  {
    id: "b1",
    name: "Consenso ≥ 90%",
    description: "Aportaste al consenso en un debate de mitosis atípica",
    earnedAt: "2025-10-01",
  },
  {
    id: "b2",
    name: "Embajador científico",
    description: "Validaste 3 cápsulas de desafío para la comunidad",
    earnedAt: "2025-08-15",
  },
  {
    id: "b3",
    name: "Maestría HER2",
    description: "Reputación por validación entre pares en casos HER2",
    locked: true,
  },
];

export const MOCK_DIVULGACION_DRAFT: DivulgacionDraft = {
  id: "d1",
  title: "Concordancia digital en Ki-67 — borrador",
  body:
    "En un estudio multicéntrico de 240 casos de mama, la cuantificación digital de Ki-67 mostró reducción de variabilidad interobservador frente al conteo manual...",
  status: "pending_review",
  createdAt: "2025-11-01",
  metricsSource: "informes_anonimizados",
};

export const SUBSCRIBED_TOPICS = ["HER2-low", "Ki-67", "mastocitoma canino"];
