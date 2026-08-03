'use-client';

import { useTranslations } from "next-intl";
import { ProfileState } from '@/context/profile-context';


type Reports = ProfileState['reports'];
type HandleInputChange = (
  section: keyof Reports,
  field: string,
  value: string
) => void;

type HandleConclusionChange = (value: string) => void;

export function generarContenidoEmail(
  reports: ProfileState['reports'],
  conclusion: string,
  t: ReturnType<typeof useTranslations>
) {
  // Generar contenido legible para email
  const contenidoEmail = formatearInforme(reports, conclusion, t);
  
  // Generar contenido estructurado para guardar en BD (JSON)
  const contenidoEstructurado = JSON.stringify({
    ki67: reports.ki67.result || '',
    estrogen: {
      percentage: reports.estrogen.positivePercentage || '',
      intensity: reports.estrogen.stainingIntensity || '',
      interpretation: reports.estrogen.interpretation || ''
    },
    progesterone: {
      percentage: reports.progesterone.positivePercentage || '',
      intensity: reports.progesterone.stainingIntensity || '',
      interpretation: reports.progesterone.interpretation || ''
    },
    her2: {
      percentage: reports.her2.positivePercentage || '',
      interpretation: reports.her2.interpretation || ''
    },
    conclusion: conclusion.trim()
  });
  
  return {
    subject: "Medical Report",
    body: contenidoEstructurado, // Guardamos JSON en lugar de string plano
    emailBody: contenidoEmail // Para el email usamos el formato legible
  };
}

export const formatearInforme = (reports: ProfileState['reports'], conclusion: string, t: ReturnType<typeof useTranslations> ):string => {
  const entries: string[] = [];

  if (reports.ki67.result) {
    entries.push(`${t("result-ki67")} ${reports.ki67.result}`);
  }

  if (reports.estrogen.positivePercentage) {
    entries.push(
      `${t("positive-cells-estrogen")} ${reports.estrogen.positivePercentage}`
    );
  }
  if (reports.estrogen.stainingIntensity) {
    entries.push(
      `${t("estrogen-intensity")} ${reports.estrogen.stainingIntensity}`
    );
  }

  if (reports.estrogen.interpretation) {
    entries.push(
      `${t("interpretation-estrogen")} ${reports.estrogen.interpretation}`
    );
  }

  if (reports.progesterone.positivePercentage) {
    entries.push(
      `${t("positive-cells-progesterone")} ${
        reports.progesterone.positivePercentage
      }`
    );
  }
  if (reports.progesterone.stainingIntensity) {
    entries.push(
      `${t("progesterone-intensity")} ${
        reports.progesterone.stainingIntensity
      }`
    );
  }

  if (reports.progesterone.interpretation) {
    entries.push(
      `${t("interpretation-progesterone")} ${
        reports.progesterone.interpretation
      }`
    );
  }

  if (reports.her2.positivePercentage) {
    entries.push(`${t("result-her2")} ${reports.her2.positivePercentage}`);
  }

  if (conclusion.trim()) {
    entries.push(`${t("conclusion")} ${conclusion.trim()}`);
  }

  return entries.join("; ");
};

export function calcularPromedioPorcentaje(results: any[]): string {
  const valores = results
    .map((r) => parseFloat((r?.percentage || "")))
    .filter((v) => !isNaN(v));

  return valores.length
    ? `${(valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1)}`
    : "";
}

export function obtenerValorMasFrecuente(results: any[], field: string): string {
  const contador: Record<string, number> = {};

  for (const r of results) {
    const val = r?.[field];
    if (val) {
      contador[val] = (contador[val] || 0) + 1;
    }
  }

  const ordenado = Object.entries(contador).sort((a, b) => b[1] - a[1]);
  return ordenado.length ? ordenado[0][0] : "";
}