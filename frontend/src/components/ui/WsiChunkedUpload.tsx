"use client";

import React, { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/";
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB por fragmento

type UploadStatus = "idle" | "initializing" | "uploading" | "assembling" | "done" | "error";

interface UploadResult {
  imagen_id: string;
  ubicacion: string;
  tipo: string;
  size_match?: boolean;
  md5?: string;
}

export default function WsiChunkedUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const ACCEPTED_EXTENSIONS = [".svs", ".ndpi", ".mrxs", ".tiff", ".tif", ".scn", ".bif", ".vms", ".vmu"];

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const isValidExtension = (name: string) => {
    const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext);
  };

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!isValidExtension(selectedFile.name)) {
      setErrorMsg(`Formato no soportado. Formatos válidos: ${ACCEPTED_EXTENSIONS.join(", ")}`);
      return;
    }
    setFile(selectedFile);
    setStatus("idle");
    setProgress(0);
    setResult(null);
    setErrorMsg("");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    handleFileSelect(dropped);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    abortRef.current = false;
    setErrorMsg("");
    setResult(null);

    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    setTotalChunks(chunks);
    setCurrentChunk(0);

    // --- PASO 1: INIT ---
    setStatus("initializing");
    let uploadId: string;
    try {
      const formData = new FormData();
      formData.append("informe_id", "test-local-" + Date.now());
      formData.append("filename", file.name);
      formData.append("size", file.size.toString());
      formData.append("content_type", file.type || "application/octet-stream");
      formData.append("total_chunks", chunks.toString());

      const initRes = await fetch(`${API_URL}upload-wsi/init`, {
        method: "POST",
        body: formData,
      });

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({ detail: initRes.statusText }));
        throw new Error(err.detail || "Error al inicializar la subida");
      }

      const initData = await initRes.json();
      uploadId = initData.upload_id;
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Error al conectar con el servidor");
      return;
    }

    // --- PASO 2: CHUNKS ---
    setStatus("uploading");
    for (let i = 0; i < chunks; i++) {
      if (abortRef.current) {
        setStatus("idle");
        setErrorMsg("Subida cancelada por el usuario.");
        return;
      }

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);

      try {
        const chunkRes = await fetch(
          `${API_URL}upload-wsi/chunk/${uploadId}?chunk_index=${i}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: blob,
          }
        );

        if (!chunkRes.ok) {
          const err = await chunkRes.json().catch(() => ({ detail: chunkRes.statusText }));
          throw new Error(err.detail || `Error en el chunk ${i}`);
        }
      } catch (err: unknown) {
        // Reintentar 1 vez
        try {
          const retryRes = await fetch(
            `${API_URL}upload-wsi/chunk/${uploadId}?chunk_index=${i}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/octet-stream" },
              body: file.slice(start, end),
            }
          );
          if (!retryRes.ok) throw new Error("Reintento fallido");
        } catch {
          setStatus("error");
          setErrorMsg(
            `Error al subir el fragmento ${i + 1}/${chunks}. ${err instanceof Error ? err.message : ""}`
          );
          return;
        }
      }

      setCurrentChunk(i + 1);
      setProgress(Math.round(((i + 1) / chunks) * 100));
    }

    // --- PASO 3: COMPLETE ---
    setStatus("assembling");
    try {
      const completeRes = await fetch(`${API_URL}upload-wsi/complete/${uploadId}`, {
        method: "POST",
      });

      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({ detail: completeRes.statusText }));
        throw new Error(err.detail || "Error al ensamblar el archivo");
      }

      const completeData = await completeRes.json();
      setResult(completeData);
      setStatus("done");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Error al ensamblar");
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
  };

  const handleReset = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setCurrentChunk(0);
    setTotalChunks(0);
    setResult(null);
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const statusLabels: Record<UploadStatus, string> = {
    idle: "Listo para subir",
    initializing: "Inicializando...",
    uploading: `Subiendo fragmento ${currentChunk}/${totalChunks}`,
    assembling: "Ensamblando archivo en el servidor...",
    done: "✅ Subida completada con éxito",
    error: "❌ Error en la subida",
  };

  const isUploading = status === "uploading" || status === "initializing" || status === "assembling";

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl text-purple-700 dark:text-purple-300">
          Subida de WSI por fragmentos
        </CardTitle>
        <CardDescription>
          Sube archivos de patología digital de gran tamaño (SVS, NDPI, MRXS, TIFF, etc.)
          dividiéndolos en fragmentos de {formatSize(CHUNK_SIZE)}.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Zona de Drag & Drop */}
        {!file && (
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                : "border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="text-4xl mb-3">🔬</div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Arrastrá tu archivo WSI aquí o hacé clic para seleccionarlo
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Formatos: {ACCEPTED_EXTENSIONS.join(", ")}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />
          </div>
        )}

        {/* Info del archivo seleccionado */}
        {file && (
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl flex-shrink-0">🧬</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatSize(file.size)} · {totalChunks > 0 ? totalChunks : Math.ceil(file.size / CHUNK_SIZE)} fragmentos
                </p>
              </div>
            </div>
            {status === "idle" && (
              <button
                onClick={handleReset}
                className="text-gray-400 hover:text-red-500 transition-colors text-lg"
                title="Quitar archivo"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Barra de progreso */}
        {file && status !== "idle" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className={`font-medium ${status === "error" ? "text-red-500" : status === "done" ? "text-green-600" : "text-purple-600 dark:text-purple-400"}`}>
                {statusLabels[status]}
              </span>
              {status === "uploading" && (
                <span className="text-gray-500 tabular-nums">{progress}%</span>
              )}
            </div>
            <Progress
              value={status === "done" ? 100 : status === "assembling" ? 100 : progress}
              className={`h-3 ${status === "error" ? "[&>div]:bg-red-500" : status === "done" ? "[&>div]:bg-green-500" : ""}`}
            />
          </div>
        )}

        {/* Mensaje de error */}
        {errorMsg && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Resultado exitoso */}
        {result && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-1">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Archivo subido exitosamente</p>
            <p className="text-xs text-green-600 dark:text-green-500">ID: {result.imagen_id}</p>
            <p className="text-xs text-green-600 dark:text-green-500">Ubicación: {result.ubicacion}</p>
            {result.md5 && (
              <p className="text-xs text-green-600 dark:text-green-500">MD5: {result.md5}</p>
            )}
            {result.size_match !== undefined && (
              <p className="text-xs text-green-600 dark:text-green-500">
                Integridad: {result.size_match ? "✅ Tamaño correcto" : "⚠️ Diferencia de tamaño"}
              </p>
            )}
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-3">
          {file && status === "idle" && (
            <Button
              onClick={handleUpload}
              className="flex-1 bg-purple-700 hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700"
            >
              🚀 Iniciar subida
            </Button>
          )}

          {isUploading && status === "uploading" && (
            <Button
              onClick={handleCancel}
              variant="destructive"
              className="flex-1"
            >
              Cancelar subida
            </Button>
          )}

          {(status === "done" || status === "error") && (
            <Button
              onClick={handleReset}
              variant="outline"
              className="flex-1"
            >
              Subir otro archivo
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
