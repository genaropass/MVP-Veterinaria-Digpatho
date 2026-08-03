"use client";

import { AlertCircle, Wifi } from "lucide-react";
import type { BotsApiMode } from "@/hooks/use-bots-api";

export function BotsApiBanner({ mode }: { mode: BotsApiMode }) {
  if (mode === "checking") {
    return (
      <div className="rounded-lg border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        Verificando conexión con el backend de bots…
      </div>
    );
  }

  if (mode === "live") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
        <Wifi className="h-4 w-4 shrink-0" />
        Conectado al backend de bots — datos en vivo.
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Modo demo: el backend aún no expone <code className="text-xs">GET /bot/health</code>.
        Cuando los endpoints estén listos, esta pantalla pasará a datos reales automáticamente.
      </span>
    </div>
  );
}
