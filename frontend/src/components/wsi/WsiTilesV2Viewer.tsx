"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  buildTilesV2TileUrl,
  getTilesV2Metadata,
  type WsiTilesMetadata,
} from "@/services/tiles_wsi";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type WsiTilesV2ViewerProps = {
  imagenId: string;
};

type SelectionRect = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type ImageCoords = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Biomarker = "ki67" | "her2" | "re" | "rp";

const BIOMARKERS: { id: Biomarker; label: string; color: string; description: string }[] = [
  { id: "ki67", label: "Ki-67", color: "#22c55e", description: "Índice de proliferación celular" },
  { id: "her2", label: "HER2", color: "#3b82f6", description: "Receptor de factor de crecimiento epidérmico humano 2" },
  { id: "re", label: "RE", color: "#f59e0b", description: "Receptores de estrógeno" },
  { id: "rp", label: "RP", color: "#ec4899", description: "Receptores de progesterona" },
];

const DEFAULT_METADATA: WsiTilesMetadata = {
  width: 120000,
  height: 90000,
  tileSize: 256,
  minLevel: 0,
  maxLevel: 12,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WsiTilesV2Viewer({ imagenId }: WsiTilesV2ViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<any>(null);

  const [retryKey, setRetryKey] = useState(0);
  const [metadata, setMetadata] = useState<WsiTilesMetadata>(DEFAULT_METADATA);
  const [metadataStatus, setMetadataStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [tileError, setTileError] = useState<string | null>(null);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [imageCoords, setImageCoords] = useState<ImageCoords | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  /* ---- Metadata loader ---- */
  useEffect(() => {
    let cancelled = false;
    async function loadMetadata() {
      setMetadataStatus("loading");
      try {
        const remoteMetadata = await getTilesV2Metadata(imagenId);
        if (!cancelled) {
          setMetadata(remoteMetadata);
          setMetadataStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setMetadata(DEFAULT_METADATA);
          setMetadataStatus("error");
        }
      }
    }
    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [imagenId, retryKey]);

  /* ---- OpenSeadragon init ---- */
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    async function initViewer() {
      const OpenSeadragon = (await import("openseadragon")).default;
      if (cancelled || !containerRef.current) return;

      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }

      setTileError(null);

      const viewer = OpenSeadragon({
        element: containerRef.current,
        prefixUrl:
          "https://cdn.jsdelivr.net/npm/openseadragon@5.0.1/build/openseadragon/images/",
        showZoomControl: true,
        showHomeControl: true,
        showFullPageControl: false,
        showNavigator: true,
        gestureSettingsMouse: {
          scrollToZoom: true,
          clickToZoom: false,
        },
        defaultZoomLevel: 1,
        minZoomLevel: 0.5,
        maxZoomLevel: 8,
        tileSources: {
          width: metadata.width,
          height: metadata.height,
          tileSize: metadata.tileSize,
          minLevel: metadata.minLevel,
          maxLevel: metadata.maxLevel,
          getTileUrl: (level: number, x: number, y: number) =>
            buildTilesV2TileUrl(imagenId, level, x, y),
        },
      });

      viewer.addHandler("tile-load-failed", (event: any) => {
        const status = event?.message ? String(event.message) : "Error de tile";
        setTileError(`Fallo al cargar uno o mas tiles (${status}).`);
      });

      viewerRef.current = viewer;
    }

    initViewer();

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [imagenId, metadata, retryKey]);

  /* ---- Canvas overlay resize ---- */
  useEffect(() => {
    function resizeCanvas() {
      if (!overlayRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      overlayRef.current.width = rect.width;
      overlayRef.current.height = rect.height;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  /* ---- Draw selection rectangle on canvas ---- */
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (selection && selectionMode) {
      const x = Math.min(selection.startX, selection.endX);
      const y = Math.min(selection.startY, selection.endY);
      const w = Math.abs(selection.endX - selection.startX);
      const h = Math.abs(selection.endY - selection.startY);

      // Semi-transparent overlay outside selection
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(x, y, w, h);

      // Selection border
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);

      // Corner handles
      ctx.setLineDash([]);
      ctx.fillStyle = "#22d3ee";
      const handleSize = 8;
      const corners = [
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ];
      corners.forEach(([cx, cy]) => {
        ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
      });

      // Size label
      if (imageCoords) {
        const label = `${imageCoords.width} × ${imageCoords.height} px`;
        ctx.font = "12px monospace";
        ctx.fillStyle = "#22d3ee";
        ctx.fillText(label, x + 4, y - 6);
      }
    }
  }, [selection, selectionMode, imageCoords]);

  /* ---- Mouse handlers for drawing selection ---- */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!selectionMode) return;
      const canvas = overlayRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setIsDrawing(true);
      setSelection({ startX: x, startY: y, endX: x, endY: y });
      setImageCoords(null);
    },
    [selectionMode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !selectionMode) return;
      const canvas = overlayRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setSelection((prev) =>
        prev ? { ...prev, endX: x, endY: y } : null
      );
    },
    [isDrawing, selectionMode]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !selection) return;
    setIsDrawing(false);

    const viewer = viewerRef.current;
    if (!viewer) return;

    // Convert screen coordinates to image coordinates
    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const w = Math.abs(selection.endX - selection.startX);
    const h = Math.abs(selection.endY - selection.startY);

    // Minimum selection size
    if (w < 20 || h < 20) {
      setSelection(null);
      return;
    }

    // Convert viewport points to image coordinates
    const topLeft = viewer.viewport.viewerElementToImageCoordinates(
      new (window as any).OpenSeadragon.Point(x, y)
    );
    const bottomRight = viewer.viewport.viewerElementToImageCoordinates(
      new (window as any).OpenSeadragon.Point(x + w, y + h)
    );

    const imgCoords: ImageCoords = {
      x: Math.max(0, Math.round(topLeft.x)),
      y: Math.max(0, Math.round(topLeft.y)),
      width: Math.round(Math.abs(bottomRight.x - topLeft.x)),
      height: Math.round(Math.abs(bottomRight.y - topLeft.y)),
    };

    setImageCoords(imgCoords);
    setShowModal(true);
  }, [isDrawing, selection]);

  /* ---- Toggle selection mode ---- */
  const toggleSelectionMode = useCallback(() => {
    const newMode = !selectionMode;
    setSelectionMode(newMode);

    if (!newMode) {
      setSelection(null);
      setImageCoords(null);
      setShowModal(false);
    }

    // Disable/enable OSD mouse tracking
    const viewer = viewerRef.current;
    if (viewer) {
      viewer.setMouseNavEnabled(!newMode);
    }
  }, [selectionMode]);

  /* ---- Cancel selection ---- */
  const cancelSelection = useCallback(() => {
    setSelection(null);
    setImageCoords(null);
    setShowModal(false);
    setAnalysisStatus("idle");
    setAnalysisResult(null);
  }, []);

  /* ---- Submit analysis ---- */
  const submitAnalysis = useCallback(
    async (biomarker: Biomarker) => {
      if (!imageCoords) return;

      setAnalysisStatus("loading");
      setAnalysisResult(null);

      try {
        const res = await fetch("/api/wsi/analyze-region", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imagen_id: imagenId,
            x: imageCoords.x,
            y: imageCoords.y,
            width: imageCoords.width,
            height: imageCoords.height,
            biomarker,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.detail || "Error al analizar la región");
        }

        setAnalysisStatus("done");
        setAnalysisResult(
          typeof data?.resultado === "string"
            ? data.resultado
            : JSON.stringify(data, null, 2)
        );
      } catch (err: any) {
        setAnalysisStatus("error");
        setAnalysisResult(err?.message || "Error desconocido");
      }
    },
    [imagenId, imageCoords]
  );

  /* ---- Metadata summary ---- */
  const metadataSummary = useMemo(() => {
    return `${metadata.width} x ${metadata.height} | tile ${metadata.tileSize} | levels ${metadata.minLevel}-${metadata.maxLevel}`;
  }, [metadata]);

  /* ---- Render ---- */
  return (
    <div className="relative h-full w-full">
      {/* Info panel */}
      <div className="absolute left-3 top-3 z-20 rounded-md border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow">
        <p>
          <span className="font-semibold text-foreground">imagen_id:</span>{" "}
          {imagenId}
        </p>
        <p>
          <span className="font-semibold text-foreground">metadata:</span>{" "}
          {metadataSummary}
        </p>
        <p>
          <span className="font-semibold text-foreground">estado:</span>{" "}
          {metadataStatus === "ready"
            ? "metadata real"
            : metadataStatus === "loading"
            ? "cargando metadata"
            : metadataStatus === "error"
            ? "metadata placeholder"
            : "inicial"}
        </p>
      </div>

      {/* Tile error */}
      {tileError && (
        <div className="absolute right-3 top-3 z-20 max-w-sm rounded-md border border-destructive/50 bg-background/95 p-3 text-xs shadow">
          <p className="font-semibold text-destructive">Error de tiles</p>
          <p className="mt-1 text-muted-foreground">{tileError}</p>
          <Button
            type="button"
            className="mt-2 h-8"
            variant="outline"
            onClick={() => setRetryKey((k: number) => k + 1)}
          >
            Reintentar carga
          </Button>
        </div>
      )}

      {/* Selection mode button */}
      <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
        <Button
          type="button"
          onClick={toggleSelectionMode}
          className={`h-10 px-6 font-semibold shadow-lg transition-all ${
            selectionMode
              ? "bg-cyan-500 text-white hover:bg-cyan-600 ring-2 ring-cyan-300"
              : "bg-background/95 text-foreground hover:bg-accent border"
          }`}
        >
          {selectionMode ? (
            <>
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Cancelar selección
            </>
          ) : (
            <>
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
              Seleccionar región
            </>
          )}
        </Button>
      </div>

      {/* Selection mode hint */}
      {selectionMode && !selection && (
        <div className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="rounded-lg bg-black/70 px-6 py-3 text-sm text-white backdrop-blur-sm">
            Dibujá un rectángulo sobre la región a analizar
          </div>
        </div>
      )}

      {/* Drawing overlay canvas */}
      <canvas
        ref={overlayRef}
        className={`absolute inset-0 z-10 ${
          selectionMode ? "cursor-crosshair" : "pointer-events-none"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* OpenSeadragon container */}
      <div ref={containerRef} className="h-full w-full bg-black" />

      {/* ---- Biomarker analysis modal ---- */}
      {showModal && imageCoords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border bg-background p-6 shadow-2xl">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                Analizar región
              </h2>
              <button
                onClick={cancelSelection}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Region info */}
            <div className="mb-5 rounded-lg bg-muted/50 p-3 text-xs font-mono text-muted-foreground">
              <p>
                <span className="text-foreground font-semibold">Posición:</span>{" "}
                ({imageCoords.x}, {imageCoords.y})
              </p>
              <p>
                <span className="text-foreground font-semibold">Tamaño:</span>{" "}
                {imageCoords.width} × {imageCoords.height} px
              </p>
              <p>
                <span className="text-foreground font-semibold">Imagen:</span>{" "}
                {imagenId}
              </p>
            </div>

            {/* Biomarker buttons */}
            {analysisStatus === "idle" && (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  Seleccioná el biomarcador a analizar:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {BIOMARKERS.map((bm) => (
                    <button
                      key={bm.id}
                      onClick={() => submitAnalysis(bm.id)}
                      className="group relative overflow-hidden rounded-lg border-2 p-4 text-left transition-all hover:shadow-md"
                      style={{
                        borderColor: `${bm.color}40`,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = bm.color;
                        (e.currentTarget as HTMLElement).style.backgroundColor = `${bm.color}10`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = `${bm.color}40`;
                        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                      }}
                    >
                      <div
                        className="mb-1 text-base font-bold"
                        style={{ color: bm.color }}
                      >
                        {bm.label}
                      </div>
                      <div className="text-[11px] leading-tight text-muted-foreground">
                        {bm.description}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Loading state */}
            {analysisStatus === "loading" && (
              <div className="flex flex-col items-center py-8">
                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                <p className="text-sm text-muted-foreground">
                  Analizando región...
                </p>
              </div>
            )}

            {/* Result */}
            {(analysisStatus === "done" || analysisStatus === "error") && (
              <div className="space-y-3">
                <div
                  className={`rounded-lg p-4 text-sm ${
                    analysisStatus === "done"
                      ? "bg-green-500/10 border border-green-500/30 text-foreground"
                      : "bg-destructive/10 border border-destructive/30 text-destructive"
                  }`}
                >
                  <p className="font-semibold mb-1">
                    {analysisStatus === "done" ? "Resultado" : "Error"}
                  </p>
                  <pre className="whitespace-pre-wrap text-xs">
                    {analysisResult}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setAnalysisStatus("idle");
                      setAnalysisResult(null);
                    }}
                  >
                    Otro biomarcador
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={cancelSelection}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            )}

            {/* Cancel button when in idle */}
            {analysisStatus === "idle" && (
              <Button
                variant="ghost"
                className="mt-4 w-full text-muted-foreground"
                onClick={cancelSelection}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
