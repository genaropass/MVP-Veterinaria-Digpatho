"use client";

import type { AnalysisResult } from "@/context/profile-context";
import { calcularScoreHer2FromCoordinates } from "./her2-utils";

interface HER2StatsProps {
  result: AnalysisResult;
}

export default function HER2Statistics({ result }: HER2StatsProps) {
  const minAxisFilter = result.minAxisFilter || 10;

  const filteredCoords = (result.coordinates || []).filter(
    (c) => c.minAxis === undefined || c.minAxis >= minAxisFilter
  );

  const score = calcularScoreHer2FromCoordinates(filteredCoords);

  const rows = [
    {
      key: "baja_incompleta",
      label: "Baja / Incompleta (1+)",
      color: "#FFFF00",
    },
    {
      key: "moderada_completa",
      label: "Moderada / Completa (2+)",
      color: "#FFA500",
    },
    {
      key: "alta_completa",
      label: "Intensa / Completa (3+)",
      color: "#FF0000",
    },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Score final */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
          Score Final HER2 (ASCO/CAP)
        </p>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-4xl font-extrabold text-blue-900">
            HER2 {score.score_final}
          </span>
        </div>
        <p className="mt-1 text-sm text-blue-900">
          Total de células válidas (excluyendo NA):{" "}
          <span className="font-semibold">{score.total_celulas_validas}</span>
        </p>
      </div>

      {/* Tabla de distribución */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Categoría
              </th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">
                Cantidad
              </th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">
                Porcentaje
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const data = score.distribucion[row.key];
              return (
                <tr
                  key={row.key}
                  className={index !== rows.length - 1 ? "border-b border-gray-200" : ""}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-4 h-4 rounded-full border-2 border-gray-800"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="font-medium">{row.label}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 font-semibold">
                    {data.cantidad}
                  </td>
                  <td className="text-right py-3 px-4 font-semibold">
                    {data.porcentaje.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

