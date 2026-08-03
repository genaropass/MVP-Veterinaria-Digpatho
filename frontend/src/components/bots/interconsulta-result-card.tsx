"use client";

import dynamic from "next/dynamic";
import { BookOpen, ExternalLink, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InterconsultaResult } from "@/types/bots";

const WsiTilesV2Viewer = dynamic(() => import("@/components/wsi/WsiTilesV2Viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video items-center justify-center rounded-lg border bg-gray-900 text-xs text-white/60">
      Cargando visor WSI…
    </div>
  ),
});

const confidenceStyles = {
  alta: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  media: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  baja: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  no_concluyente: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function InterconsultaResultCard({ result }: { result: InterconsultaResult }) {
  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Resultado de interconsulta</CardTitle>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${confidenceStyles[result.confidence]}`}
          >
            Confianza: {result.confidence}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed">{result.summary}</p>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Regiones destacadas
          </p>
          {result.imagenId ? (
            <div className="relative min-h-[320px] overflow-hidden rounded-lg border">
              <WsiTilesV2Viewer imagenId={result.imagenId} />
              {result.heatmapRegions.map((r) => (
                <div
                  key={r.label}
                  className="pointer-events-none absolute rounded border-2 border-red-400/80 bg-red-500/20"
                  style={{
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    width: `${r.w}%`,
                    height: `${r.h}%`,
                  }}
                  title={r.label}
                />
              ))}
            </div>
          ) : (
            <div className="relative aspect-video overflow-hidden rounded-lg border bg-gray-900">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#1e3a5f_0%,#0f172a_100%)]" />
              {result.heatmapRegions.map((r) => (
                <div
                  key={r.label}
                  className="absolute rounded border-2 border-red-400/80 bg-red-500/20"
                  style={{
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    width: `${r.w}%`,
                    height: `${r.h}%`,
                  }}
                  title={r.label}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            Citas obligatorias
          </p>
          <ul className="space-y-2">
            {result.citations.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.source} · {c.year}
                  </p>
                </div>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {result.similarCases.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Casos similares
            </p>
            <ul className="space-y-2">
              {result.similarCases.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>{c.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {(c.similarity * 100).toFixed(0)}% · {c.source}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {result.disclaimer}
        </div>
      </CardContent>
    </Card>
  );
}
