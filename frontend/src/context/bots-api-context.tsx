"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useBotsApi as useBotsApiInternal, type BotsApiMode } from "@/hooks/use-bots-api";
import type { InterconsultaInputType, InterconsultaResult } from "@/types/bots";
import type {
  Badge,
  ChallengeCapsule,
  DivulgacionDraft,
  ForumThread,
  VigilanceItem,
} from "@/types/bots";

type BotsApiContextValue = {
  apiMode: BotsApiMode;
  token: string;
  runInterconsulta: (params: {
    file?: File | null;
    inputType: InterconsultaInputType;
    contextoClinico?: string;
    pacienteId?: string;
    informeId?: string;
  }) => Promise<InterconsultaResult>;
  loadVigilanceTopics: () => Promise<string[]>;
  loadVigilanceFeed: () => Promise<VigilanceItem[]>;
  addVigilanceTopic: (topic: string) => Promise<string[]>;
  loadChallenge: () => Promise<ChallengeCapsule>;
  answerChallenge: (capsuleId: string, optionId: string) => Promise<{ ok: boolean }>;
  loadForums: () => Promise<ForumThread[]>;
  openCaseForum: (interconsultaId?: string) => Promise<ForumThread>;
  loadBadges: () => Promise<Badge[]>;
  loadDivulgacionDrafts: () => Promise<DivulgacionDraft[]>;
  approveDraft: (draftId: string) => Promise<DivulgacionDraft>;
  loadWellness: () => Promise<{ show: boolean; message: string }>;
};

const BotsApiContext = createContext<BotsApiContextValue | null>(null);

export function BotsApiProvider({ children }: { children: ReactNode }) {
  const value = useBotsApiInternal();
  return <BotsApiContext.Provider value={value}>{children}</BotsApiContext.Provider>;
}

export function useBotsApi(): BotsApiContextValue {
  const ctx = useContext(BotsApiContext);
  if (!ctx) {
    throw new Error("useBotsApi debe usarse dentro de BotsApiProvider");
  }
  return ctx;
}
