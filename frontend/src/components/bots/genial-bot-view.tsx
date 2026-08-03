"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Award,
  Heart,
  MessageCircle,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBotsApi } from "@/context/bots-api-context";
import type { Badge, ChallengeCapsule, DivulgacionDraft, ForumThread } from "@/types/bots";

const WsiTilesV2Viewer = dynamic(() => import("@/components/wsi/WsiTilesV2Viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-square items-center justify-center rounded-lg border bg-gray-900 text-xs text-white/60">
      Cargando tile…
    </div>
  ),
});

export function GenialBotView() {
  const {
    loadChallenge,
    answerChallenge,
    loadForums,
    openCaseForum,
    loadBadges,
    loadDivulgacionDrafts,
    approveDraft,
    loadWellness,
  } = useBotsApi();

  const [challenge, setChallenge] = useState<ChallengeCapsule | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [forums, setForums] = useState<ForumThread[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [drafts, setDrafts] = useState<DivulgacionDraft[]>([]);
  const [wellnessMessage, setWellnessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ch, fo, ba, dr, we] = await Promise.all([
        loadChallenge(),
        loadForums(),
        loadBadges(),
        loadDivulgacionDrafts(),
        loadWellness(),
      ]);
      setChallenge(ch);
      setForums(fo);
      setBadges(ba);
      setDrafts(dr);
      if (we.show) setWellnessMessage(we.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar Bot Genial");
    } finally {
      setLoading(false);
    }
  }, [
    loadBadges,
    loadChallenge,
    loadDivulgacionDrafts,
    loadForums,
    loadWellness,
  ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleSubmitAnswer() {
    if (!challenge || !selectedOption) return;
    try {
      await answerChallenge(challenge.id, selectedOption);
      toast.success("Respuesta enviada");
      const refreshed = await loadChallenge();
      setChallenge(refreshed);
      setSelectedOption(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar la respuesta");
    }
  }

  async function handleOpenCaseForum() {
    try {
      const thread = await openCaseForum();
      toast.success(`Foro creado: ${thread.title}`);
      const refreshed = await loadForums();
      setForums(refreshed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el foro");
    }
  }

  async function handleApproveDraft(draftId: string) {
    try {
      await approveDraft(draftId);
      toast.success("Borrador aprobado para revisión/distribución");
      const refreshed = await loadDivulgacionDrafts();
      setDrafts(refreshed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo aprobar el borrador");
    }
  }

  if (loading || !challenge) {
    return <p className="text-sm text-muted-foreground">Cargando Bot Genial…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
          <div>
            <p className="font-medium text-violet-900 dark:text-violet-100">Bot Genial</p>
            <p className="mt-1 text-sm text-violet-800/80 dark:text-violet-200/80">
              La red: engagement, comunidad, prospección y divulgación. Gamificación por prestigio.
            </p>
          </div>
        </div>
      </div>

      {wellnessMessage && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
          <Heart className="h-5 w-5 shrink-0 text-rose-500" />
          <div>
            <p className="font-medium text-rose-900 dark:text-rose-100">Alerta de bienestar</p>
            <p className="mt-1 text-sm text-rose-800/80 dark:text-rose-200/80">{wellnessMessage}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setWellnessMessage(null)}
            >
              Entendido
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="desafios">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="desafios">Desafíos</TabsTrigger>
          <TabsTrigger value="comunidad">Comunidad</TabsTrigger>
          <TabsTrigger value="prestigio">Prestigio</TabsTrigger>
          <TabsTrigger value="divulgacion">Divulgación</TabsTrigger>
        </TabsList>

        <TabsContent value="desafios" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-amber-500" />
                {challenge.title}
              </CardTitle>
              <CardDescription>
                {challenge.specialty} · {challenge.timeLimit}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {challenge.imagenId ? (
                  <div className="relative min-h-[280px] overflow-hidden rounded-lg border">
                    <WsiTilesV2Viewer imagenId={challenge.imagenId} />
                  </div>
                ) : (
                  <div className="relative aspect-square overflow-hidden rounded-lg border bg-gray-900">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,#4c1d95_0%,#1e1b4b_50%,#0f172a_100%)]" />
                    <p className="absolute bottom-2 left-2 right-2 text-center text-xs text-white/60">
                      El back puede devolver imagen_id en la cápsula
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="font-medium">{challenge.question}</p>
                  <div className="space-y-2">
                    {challenge.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedOption(opt.id)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                          selectedOption === opt.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.votes} votos</span>
                      </button>
                    ))}
                  </div>
                  <Button className="w-full" disabled={!selectedOption} onClick={handleSubmitAnswer}>
                    Enviar respuesta
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comunidad" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Foros e interconsulta social
              </CardTitle>
              <CardDescription>
                <code className="text-xs">GET/POST /bot/genial/foros</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {forums.map((thread) => (
                <div
                  key={thread.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{thread.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {thread.author} · {thread.specialty} · {thread.lastActivity}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {thread.replies}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {thread.tags.map((tag) => (
                      <span key={tag} className="rounded bg-muted px-2 py-0.5 text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={handleOpenCaseForum}>
                Abrir foro de caso (vinculado al Bot Científico)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prestigio" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-4 w-4 text-amber-500" />
                Medallas por maestría
              </CardTitle>
              <CardDescription>
                <code className="text-xs">GET /bot/genial/perfil/badges</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`rounded-lg border p-4 text-center ${badge.locked ? "opacity-50" : ""}`}
                  >
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                      <Award className="h-6 w-6 text-amber-600" />
                    </div>
                    <p className="font-medium text-sm">{badge.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{badge.description}</p>
                    {badge.earnedAt && (
                      <p className="mt-2 text-xs text-emerald-600">Obtenida {badge.earnedAt}</p>
                    )}
                    {badge.locked && (
                      <p className="mt-2 text-xs text-muted-foreground">Bloqueada</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="divulgacion" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Red de divulgación (GEO)</CardTitle>
              <CardDescription>
                <code className="text-xs">GET/PUT /bot/genial/divulgacion/borradores</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {drafts.map((draft) => (
                <div key={draft.id} className="rounded-lg border border-dashed p-4">
                  <p className="font-medium">{draft.title}</p>
                  <p className="mt-2 text-muted-foreground">{draft.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Estado: {draft.status}
                    {draft.metricsSource ? ` · Fuente: ${draft.metricsSource}` : ""}
                  </p>
                  {draft.status === "pending_review" && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => handleApproveDraft(draft.id)}>
                        Aprobar y programar
                      </Button>
                      <Button size="sm" variant="outline">
                        Editar borrador
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
