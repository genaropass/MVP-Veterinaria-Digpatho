import type { Coordinate } from "../canvas/types";

export type Her2Categoria = "no_tincion" | "baja" | "moderada" | "alta" | "na";
export type Her2Completitud = "completa" | "incompleta" | null;

export interface Her2Score {
  total_celulas_validas: number;
  conteos: {
    baja_incompleta: number;
    moderada_completa: number;
    alta_completa: number;
    alta_total: number;
  };
  porcentajes: {
    baja_incompleta: number;
    moderada_completa: number;
    alta_completa: number;
    alta_total: number;
  };
  distribucion: {
    baja_incompleta: { cantidad: number; porcentaje: number };
    moderada_completa: { cantidad: number; porcentaje: number };
    alta_completa: { cantidad: number; porcentaje: number };
  };
  score_final: "0" | "1+" | "2+" | "3+";
}

function normalizarTextoHer2(texto: unknown): string {
  if (!texto) return "";
  const raw = String(texto);

  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return normalized
    .toLowerCase()
    .replace(/_/g, " ")   
    .replace(/\s+/g, " ")
    .trim();
}
/**
 * Replica la lógica de _parsear_label_her2 del back-end.
 * A partir de un label libre intenta extraer:
 * - categoria de intensidad: no_tincion | baja | moderada | alta | na
 * - completitud perinuclear: completa | incompleta | null
 */
export function parsearLabelHer2(label: unknown): {
  categoria: Her2Categoria;
  completitud: Her2Completitud;
} {
  const txt = ` ${normalizarTextoHer2(label)} `;

  let categoria: Her2Categoria;

  // NA / estroma / no tumorales
  if (
    txt.includes(" na") ||
    txt.includes(" estroma") ||
    txt.includes(" stroma") ||
    txt.includes(" no tumoral") ||
    txt.includes(" no tumoral/estroma")
  ) {
    categoria = "na";
  } else if (txt.includes("no tincion") || txt.includes("sin tincion") || txt.includes(" 0+")) {
    categoria = "no_tincion";
  } else if (txt.includes("baja") || txt.includes(" 1+")) {
    categoria = "baja";
  } else if (txt.includes("moderad") || txt.includes(" 2+")) {
    categoria = "moderada";
  } else if (txt.includes("alta") || txt.includes("intensa") || txt.includes(" 3+")) {
    categoria = "alta";
  } else {
    // si no reconocemos nada, consideramos NA para no contaminar el score
    categoria = "na";
  }

  let completitud: Her2Completitud = null;
  if (txt.includes("incomplet")) {
    completitud = "incompleta";
  } else if (txt.includes("complet")) {
    completitud = "completa";
  }

  return { categoria, completitud };
}

/**
 * Implementa en front la misma lógica ASCO/CAP que calcular_score_her2 en el back.
 *
 * - Ignora células NA para el cálculo de porcentajes.
 * - Calcula distribución:
 *    * baja_incompleta
 *    * moderada_completa
 *    * alta_completa
 *    * alta_total (todas las 'alta', completas o no)
 */
export function calcularScoreHer2FromCoordinates(
  coordinates: Coordinate[] | undefined | null
): Her2Score {
  let totalValidas = 0;

  const conteos = {
    baja_incompleta: 0,
    moderada_completa: 0,
    alta_completa: 0,
    alta_total: 0,
  };

  for (const c of coordinates || []) {
    const { categoria, completitud } = parsearLabelHer2(c.label);

    if (categoria === "na") {
      continue;
    }

    totalValidas += 1;

    if (categoria === "alta") {
      conteos.alta_total += 1;
      if (completitud === "completa") {
        conteos.alta_completa += 1;
      }
    }

    if (categoria === "moderada" && completitud === "completa") {
      conteos.moderada_completa += 1;
    }

    if (categoria === "baja" && completitud === "incompleta") {
      conteos.baja_incompleta += 1;
    }
  }

  const pct = (n: number): number =>
    totalValidas > 0 ? Math.round((n / totalValidas) * 10000) / 100 : 0;

  const porcentajes = {
    baja_incompleta: pct(conteos.baja_incompleta),
    moderada_completa: pct(conteos.moderada_completa),
    alta_completa: pct(conteos.alta_completa),
    alta_total: pct(conteos.alta_total),
  };

  // Reglas de score (idénticas al back-end)
  let score: Her2Score["score_final"] = "0";
  if (porcentajes.alta_completa > 10) {
    score = "3+";
  } else if (
    porcentajes.moderada_completa > 10 ||
    (porcentajes.alta_total > 0 && porcentajes.alta_total <= 10)
  ) {
    score = "2+";
  } else if (porcentajes.baja_incompleta > 10) {
    score = "1+";
  }

  const distribucion: Her2Score["distribucion"] = {
    baja_incompleta: {
      cantidad: conteos.baja_incompleta,
      porcentaje: porcentajes.baja_incompleta,
    },
    moderada_completa: {
      cantidad: conteos.moderada_completa,
      porcentaje: porcentajes.moderada_completa,
    },
    alta_completa: {
      cantidad: conteos.alta_completa,
      porcentaje: porcentajes.alta_completa,
    },
  };

  return {
    total_celulas_validas: totalValidas,
    conteos,
    porcentajes,
    distribucion,
    score_final: score,
  };
}

export function downloadHer2CoordinatesJson(rawApiResult: unknown, fileName: string) {
  const baseName = fileName.replace(/\.[^/.]+$/, "") || "her2";
  const blob = new Blob([JSON.stringify(rawApiResult, null, 4)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${baseName}_coordinates.json`;
  link.click();
  URL.revokeObjectURL(url);
}

