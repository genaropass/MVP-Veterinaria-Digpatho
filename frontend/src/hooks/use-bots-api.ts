"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { API_TOKEN } from "@/utils/constants";
import {
  BotApiError,
  checkBotsHealth,
  createForumThread,
  createInterconsulta,
  createInterconsultaWithFile,
  followVigilanceTopic,
  getCurrentChallenge,
  getDivulgacionDrafts,
  getForumThreads,
  getInterconsulta,
  getUserBadges,
  getVigilanceFeed,
  getVigilanceTopics,
  getWellnessAlert,
  pollInterconsultaTask,
  submitChallengeAnswer,
  updateDivulgacionDraft,
} from "@/services/botService";
import { uploadWsiFile } from "@/services/tiles_wsi";
import type { InterconsultaInputType, InterconsultaResult } from "@/types/bots";
import {
  MOCK_BADGES,
  MOCK_CHALLENGE,
  MOCK_FORUMS,
  MOCK_INTERCONSULTA,
  MOCK_VIGILANCE,
  MOCK_DIVULGACION_DRAFT,
  SUBSCRIBED_TOPICS,
} from "@/components/bots/mock-data";

export type BotsApiMode = "checking" | "live" | "mock";

function resolveToken(session: ReturnType<typeof useSession>["data"]): string {
  const raw = (session as { accessToken?: string } | null)?.accessToken;
  if (raw && typeof raw === "string" && raw.split(".").length === 3) return raw;
  return API_TOKEN;
}

function forceMock(): boolean {
  return process.env.NEXT_PUBLIC_BOTS_MOCK === "true";
}

export function useBotsApi() {
  const { data: session, status } = useSession();
  const token = useMemo(() => resolveToken(session), [session]);
  const [apiMode, setApiMode] = useState<BotsApiMode>("checking");

  useEffect(() => {
    if (status === "loading") return;

    if (forceMock() || !token) {
      setApiMode("mock");
      return;
    }

    let cancelled = false;
    checkBotsHealth(token).then((ok) => {
      if (!cancelled) setApiMode(ok ? "live" : "mock");
    });

    return () => {
      cancelled = true;
    };
  }, [token, status]);

  const runInterconsulta = useCallback(
    async (params: {
      file?: File | null;
      inputType: InterconsultaInputType;
      contextoClinico?: string;
      pacienteId?: string;
      informeId?: string;
    }): Promise<InterconsultaResult> => {
      if (apiMode === "mock") {
        await new Promise((r) => setTimeout(r, 900));
        return { ...MOCK_INTERCONSULTA };
      }

      let imagenId: string | undefined;

      if (params.file && params.inputType === "wsi") {
        if (!params.informeId) {
          throw new BotApiError("informe_id es obligatorio para subir WSI.", 400);
        }
        const uploaded = await uploadWsiFile({
          informeId: params.informeId,
          file: params.file,
        });
        imagenId = uploaded.imagen_id;
      }

      if (params.file && params.inputType !== "wsi") {
        return createInterconsultaWithFile(token, {
          file: params.file,
          tipo_entrada: params.inputType,
          contexto_clinico: params.contextoClinico,
          paciente_id: params.pacienteId,
          informe_id: params.informeId,
        });
      }

      const response = await createInterconsulta(token, {
        tipo_entrada: params.inputType,
        contexto_clinico: params.contextoClinico,
        paciente_id: params.pacienteId,
        informe_id: params.informeId,
        imagen_id: imagenId,
      });

      if (response.status === "pending" || response.status === "processing") {
        if (!response.id) {
          throw new BotApiError("El backend no devolvió interconsulta_id para polling.", 500);
        }
        return getInterconsulta(token, response.id);
      }

      return response;
    },
    [apiMode, token]
  );

  const loadVigilanceTopics = useCallback(async () => {
    if (apiMode === "mock") return SUBSCRIBED_TOPICS;
    return getVigilanceTopics(token);
  }, [apiMode, token]);

  const loadVigilanceFeed = useCallback(async () => {
    if (apiMode === "mock") return MOCK_VIGILANCE;
    return getVigilanceFeed(token);
  }, [apiMode, token]);

  const addVigilanceTopic = useCallback(
    async (topic: string) => {
      if (apiMode === "mock") return [...SUBSCRIBED_TOPICS, topic];
      return followVigilanceTopic(token, topic);
    },
    [apiMode, token]
  );

  const loadChallenge = useCallback(async () => {
    if (apiMode === "mock") return MOCK_CHALLENGE;
    return getCurrentChallenge(token);
  }, [apiMode, token]);

  const answerChallenge = useCallback(
    async (capsuleId: string, optionId: string) => {
      if (apiMode === "mock") return { ok: true };
      return submitChallengeAnswer(token, capsuleId, optionId);
    },
    [apiMode, token]
  );

  const loadForums = useCallback(async () => {
    if (apiMode === "mock") return MOCK_FORUMS;
    return getForumThreads(token);
  }, [apiMode, token]);

  const openCaseForum = useCallback(
    async (interconsultaId?: string) => {
      if (apiMode === "mock") return MOCK_FORUMS[0];
      return createForumThread(token, {
        title: "Foro de caso vinculado a interconsulta",
        specialty: "Mama",
        tags: ["interconsulta"],
        interconsulta_id: interconsultaId,
      });
    },
    [apiMode, token]
  );

  const loadBadges = useCallback(async () => {
    if (apiMode === "mock") return MOCK_BADGES;
    return getUserBadges(token);
  }, [apiMode, token]);

  const loadDivulgacionDrafts = useCallback(async () => {
    if (apiMode === "mock") return [MOCK_DIVULGACION_DRAFT];
    return getDivulgacionDrafts(token);
  }, [apiMode, token]);

  const approveDraft = useCallback(
    async (draftId: string) => {
      if (apiMode === "mock") return MOCK_DIVULGACION_DRAFT;
      return updateDivulgacionDraft(token, draftId, { action: "approve" });
    },
    [apiMode, token]
  );

  const loadWellness = useCallback(async () => {
    if (apiMode === "mock") return { show: false, message: "" };
    return getWellnessAlert(token);
  }, [apiMode, token]);

  return {
    apiMode,
    token,
    runInterconsulta,
    loadVigilanceTopics,
    loadVigilanceFeed,
    addVigilanceTopic,
    loadChallenge,
    answerChallenge,
    loadForums,
    openCaseForum,
    loadBadges,
    loadDivulgacionDrafts,
    approveDraft,
    loadWellness,
    pollInterconsultaTask: (taskId: string) => pollInterconsultaTask(token, taskId),
  };
}
