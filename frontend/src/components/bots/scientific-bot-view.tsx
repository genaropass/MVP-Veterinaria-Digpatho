"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ExternalLink,
  FileText,
  ImageIcon,
  Microscope,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { InterconsultaResultCard } from "./interconsulta-result-card";
import { useBotsApi } from "@/context/bots-api-context";
import type { InterconsultaInputType, InterconsultaResult, VigilanceItem } from "@/types/bots";
import { BotApiError } from "@/services/botService";

const impactStyles = {
  alto: "border-l-red-500",
  medio: "border-l-amber-500",
  bajo: "border-l-blue-500",
};

const FILE_ACCEPT: Record<InterconsultaInputType, string> = {
  wsi: ".svs,.ndpi,.tiff,.tif,.mrxs",
  pdf: ".pdf",
  texto: ".txt",
  imagen_ihc: ".jpg,.jpeg,.png,.tif,.tiff",
};

export function ScientificBotView() {
  const {
    runInterconsulta,
    loadVigilanceTopics,
    loadVigilanceFeed,
    addVigilanceTopic,
  } = useBotsApi();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputType, setInputType] = useState<InterconsultaInputType>("wsi");
  const [file, setFile] = useState<File | null>(null);
  const [contextoClinico, setContextoClinico] = useState("");
  const [informeId, setInformeId] = useState("");
  const [pacienteId, setPacienteId] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<InterconsultaResult | null>(null);

  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [feed, setFeed] = useState<VigilanceItem[]>([]);
  const [loadingVigilance, setLoadingVigilance] = useState(true);

  const loadVigilance = useCallback(async () => {
    setLoadingVigilance(true);
    try {
      const [t, f] = await Promise.all([loadVigilanceTopics(), loadVigilanceFeed()]);
      setTopics(t);
      setFeed(f);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar vigilancia");
    } finally {
      setLoadingVigilance(false);
    }
  }, [loadVigilanceFeed, loadVigilanceTopics]);

  useEffect(() => {
    loadVigilance();
  }, [loadVigilance]);

  function onPickFile(type: InterconsultaInputType) {
    setInputType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept = FILE_ACCEPT[type];
      fileInputRef.current.click();
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    e.target.value = "";
  }

  async function handleInterconsulta() {
    setIsAnalyzing(true);
    setResult(null);
    try {
      const data = await runInterconsulta({
        file,
        inputType,
        contextoClinico: contextoClinico || undefined,
        informeId: informeId || undefined,
        pacienteId: pacienteId || undefined,
      });
      setResult(data);
    } catch (err) {
      const message =
        err instanceof BotApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo contrastar el caso";
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleFollowTopic() {
    const topic = newTopic.trim();
    if (!topic) return;
    try {
      const updated = await addVigilanceTopic(topic);
      setTopics(updated);
      setNewTopic("");
      const refreshed = await loadVigilanceFeed();
      setFeed(refreshed);
      toast.success(`Siguiendo: ${topic}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo seguir el tema");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex items-start gap-3">
          <Microscope className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-medium text-blue-900 dark:text-blue-100">Bot Científico</p>
            <p className="mt-1 text-sm text-blue-800/80 dark:text-blue-200/80">
              Evidencia con cero alucinación: interconsulta y vigilancia científica. Soporte a la
              decisión — no diagnóstico autónomo.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="interconsulta">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="interconsulta">Interconsulta</TabsTrigger>
          <TabsTrigger value="vigilancia">Vigilancia científica</TabsTrigger>
        </TabsList>

        <TabsContent value="interconsulta" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subir caso</CardTitle>
                <CardDescription>
                  WSI usa <code className="text-xs">upload-wsi/</code> existente; luego{" "}
                  <code className="text-xs">POST /bot/cientifico/interconsulta</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={onFileChange}
                />

                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 dark:border-gray-700 dark:bg-gray-900/40">
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <p className="text-sm font-medium">
                    {file ? file.name : "Arrastrá o seleccioná un archivo"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tipo actual: {inputType}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button variant="outline" size="sm" type="button" onClick={() => onPickFile("wsi")}>
                      <ImageIcon className="mr-1 h-4 w-4" />
                      WSI
                    </Button>
                    <Button variant="outline" size="sm" type="button" onClick={() => onPickFile("pdf")}>
                      <FileText className="mr-1 h-4 w-4" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => onPickFile("imagen_ihc")}
                    >
                      IHC
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">informe_id (WSI)</p>
                    <Input
                      value={informeId}
                      onChange={(e) => setInformeId(e.target.value)}
                      placeholder="Obligatorio para WSI"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">paciente_id (opcional)</p>
                    <Input
                      value={pacienteId}
                      onChange={(e) => setPacienteId(e.target.value)}
                      placeholder="Vincular al paciente"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Contexto clínico (opcional)</p>
                  <Textarea
                    value={contextoClinico}
                    onChange={(e) => setContextoClinico(e.target.value)}
                    placeholder="Ej: Mama derecha, biopsia core, sospecha de CDI..."
                    rows={3}
                  />
                </div>

                <Button className="w-full" onClick={handleInterconsulta} disabled={isAnalyzing}>
                  <Search className="mr-2 h-4 w-4" />
                  {isAnalyzing ? "Contrastando contra evidencia..." : "Contrastar caso"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endpoints existentes reutilizados</CardTitle>
                <CardDescription>Sin duplicar lógica ya disponible en el back</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { title: "upload-wsi/", desc: "Ingesta WSI → imagen_id para interconsulta." },
                  { title: "upload/ · upload-her2/", desc: "IHC Ki-67 y HER2 con polling result/{task_id}." },
                  { title: "analizar-region/", desc: "Heatmaps y segundo par de ojos sobre ROI." },
                  { title: "informe/ · paciente/", desc: "Contexto clínico del caso." },
                ].map((item) => (
                  <div key={item.title} className="rounded-lg border bg-muted/30 p-3">
                    <p className="font-medium font-mono text-xs">{item.title}</p>
                    <p className="mt-0.5 text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {result && <InterconsultaResultCard result={result} />}
        </TabsContent>

        <TabsContent value="vigilancia" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Temas seguidos</CardTitle>
              <CardDescription>
                <code className="text-xs">GET/POST /bot/cientifico/vigilancia/temas</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingVigilance ? (
                <p className="text-sm text-muted-foreground">Cargando temas…</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="Agregar tema (ej. TNBC, WSAVA guías...)"
                  onKeyDown={(e) => e.key === "Enter" && handleFollowTopic()}
                />
                <Button type="button" variant="secondary" onClick={handleFollowTopic}>
                  Seguir
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {loadingVigilance ? (
              <p className="text-sm text-muted-foreground">Cargando novedades…</p>
            ) : (
              feed.map((item) => (
                <Card key={item.id} className={`border-l-4 ${impactStyles[item.impact]}`}>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          {item.topic}
                        </span>
                        <p className="mt-1 font-medium">{item.title}</p>
                      </div>
                      {item.impact === "alto" && (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          Alto impacto
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {item.source} · {item.publishedAt}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        Ver fuente <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
