"use client";

import { useMemo, useState, useRef, type ChangeEvent } from "react";
import WsiTilesV2Viewer from "@/components/wsi/WsiTilesV2Viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadSimpleMode, uploadChunkedMode } from "@/services/wsiUploadService";
import { UPLOAD_THRESHOLD, API_TOKEN, HOST } from "@/utils/constants";
import { Progress } from "@/components/ui/progress";
import { useSession } from "next-auth/react";
import { createPatient, getPatientDNI } from "@/services/patientService";

type WsiUploadResponse = {
  imagen_id: string;
  ubicacion?: string;
  tipo?: string;
  [key: string]: unknown;
};

export default function WSIViewerPage() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [informeId, setInformeId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<WsiUploadResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const rawToken = (session as any)?.accessToken;
  const isValidJWT = rawToken && typeof rawToken === "string" && rawToken.split(".").length === 3;
  const authToken = isValidJWT ? rawToken : API_TOKEN;

  function onInformeIdChange(e: ChangeEvent<HTMLInputElement>) {
    setInformeId(e.target.value);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
  }

  async function handleCreateTestInforme() {
    try {
      setIsUploading(true);
      setError(null);
      
      const userEmail = session?.user?.email || "valentinopicco2004@gmail.com";
      const randomDni = `99${Math.floor(Math.random() * 1000000)}`;
      
      await createPatient(
        "Paciente Prueba WSI",
        randomDni,
        "M",
        "1990-01-01",
        userEmail,
        authToken
      );
      
      // El backend no devuelve el ID al crear, así que lo buscamos por DNI
      const patients = await getPatientDNI({ dni: randomDni, accessToken: authToken });
      const pacienteId = patients[0]?.id || patients[0]?.paciente_id;
      
      if (!pacienteId) {
        throw new Error(`No pudimos recuperar el ID del paciente recién creado.`);
      }

      const now = new Date();
      const fechaMuestra = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      const res = await fetch(`${HOST}informe/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          paciente_id: pacienteId,
          fecha_de_muestra: fechaMuestra,
          tipo_estudio: "ki67"
        })
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Backend Error:", errorText);
        throw new Error(`Error al crear informe de prueba: ${errorText}`);
      }
      const data = await res.json();
      setInformeId(data.informe.id);
    } catch (err: any) {
      setError(err.message || "Error al crear informe de prueba");
    } finally {
      setIsUploading(false);
    }
  }

  const fileSizeText = useMemo(() => {
    if (!file) return "-";
    if (file.size < 1024 * 1024) return `${(file.size / 1024).toFixed(1)} KB`;
    return `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
  }, [file]);

  async function onUploadWsi() {
    if (!file) {
      setError("Selecciona un archivo WSI.");
      return;
    }

    if (!informeId.trim()) {
      setError("El informe_id es obligatorio.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);
    setUploadResult(null);
    abortControllerRef.current = new AbortController();

    try {
      let imageId = "";
      if (file.size <= UPLOAD_THRESHOLD) {
        imageId = await uploadSimpleMode(
          file,
          informeId.trim(),
          authToken,
          (p) => setProgress(p),
          abortControllerRef.current.signal
        );
      } else {
        imageId = await uploadChunkedMode(
          file,
          informeId.trim(),
          authToken,
          (p) => setProgress(p),
          abortControllerRef.current.signal
        );
      }

      if (!imageId) {
        throw new Error("El backend no devolvio imagen_id.");
      }

      setUploadResult({ imagen_id: imageId });
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Subida cancelada por el usuario.");
      } else {
        const message = err instanceof Error ? err.message : "No se pudo subir el WSI.";
        setError(message);
      }
      setUploadResult(null);
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  }

  function onCancelUpload() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  return (
    <div className="flex h-screen flex-col gap-4 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">WSI Upload + OpenSeadragon</h1>
          <p className="text-sm text-muted-foreground">
            Subi .tiff/.tif/.svs/.ndpi/.mrxs y visualiza tiles desde /tiles-v2.
          </p>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[380px_1fr]">
        <Card className="overflow-auto">
          <CardHeader>
            <CardTitle>Subir WSI</CardTitle>
            <CardDescription>
              El upload usa /upload-wsi/ y, al responder imagen_id, se abre el visor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">informe_id</p>
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-blue-600" onClick={handleCreateTestInforme}>
                  Crear Informe de Prueba
                </Button>
              </div>
              <Input
                value={informeId}
                onChange={onInformeIdChange}
                placeholder="Ej: 12345"
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">Archivo WSI</p>
              <Input
                type="file"
                accept=".tiff,.tif,.svs,.ndpi,.mrxs"
                onChange={onFileChange}
              />
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Preview de subida</p>
              <p className="mt-2 text-muted-foreground">
                <span className="font-medium text-foreground">Nombre:</span> {file?.name || "-"}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Tamano:</span> {fileSizeText}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">informe_id:</span> {informeId || "-"}
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {uploadResult && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                <p className="font-medium text-emerald-700 dark:text-emerald-400">Upload exitoso</p>
                <p className="mt-1 text-muted-foreground">
                  <span className="font-medium text-foreground">imagen_id:</span> {uploadResult.imagen_id}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">ubicacion:</span>{" "}
                  {String(uploadResult.ubicacion ?? "-")}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">tipo:</span> {String(uploadResult.tipo ?? "-")}
                </p>
              </div>
            )}

            {isUploading ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Subiendo...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <Button type="button" variant="outline" className="w-full text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200" onClick={onCancelUpload}>
                  Cancelar Subida
                </Button>
              </div>
            ) : (
              <Button type="button" className="w-full" onClick={onUploadWsi}>
                Subir WSI
              </Button>
            )}
          </CardContent>
        </Card>

        <main className="relative min-h-[420px] overflow-hidden rounded-xl border bg-black">
          {uploadResult?.imagen_id ? (
            <WsiTilesV2Viewer imagenId={uploadResult.imagen_id} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sube un archivo WSI para iniciar la visualizacion.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
