"use client";

import { useTranslations } from "next-intl";

export default function CriteriosDeSubida() {
  const t = useTranslations("criterios-subida");
  const TOTAL_RULES = 5;
  const icons = ["🔍", "📏", "🚫", "🔄", "🔬"];
  const ruleKeys = Array.from({ length: TOTAL_RULES }, (_, i) => `rule-${i + 1}`);

  return (
    // CAMBIO CLAVE: Quitamos w-96 y estilos de tooltip.
    // Ahora es un bloque ancho (w-full) con fondo de alerta (azul suave).
    <div
      className="w-full mb-6 p-4 bg-blue-50 dark:bg-slate-800 border-l-4 border-blue-500 rounded-r-lg shadow-sm"
      role="alert"
    >
      <div className="flex items-center mb-3">
        <span className="text-2xl mr-3">ℹ️</span>
        <strong className="text-lg font-bold text-blue-900 dark:text-blue-100">
          {t("rules")}
        </strong>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm text-blue-800 dark:text-blue-200">
        {ruleKeys.map((key, i) => (
          <li key={key} className="flex items-start">
            <span className="mr-2 mt-0.5 select-none">{icons[i] || "•"}</span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
