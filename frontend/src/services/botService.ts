import { HOST } from "@/utils/constants";
import type {
  BotsHealthResponse,
  InterconsultaInputType,
  InterconsultaRequest,
  InterconsultaResult,
} from "@/types/bots";
import {
  mapBadge,
  mapChallengeCapsule,
  mapDivulgacionDraft,
  mapForumThread,
  mapInterconsultaResult,
  mapVigilanceItem,
  mapWellnessAlert,
} from "./botMappers";

export class BotApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BotApiError";
    this.status = status;
  }
}

function authHeader(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
}

async function parseError(res: Response): Promise<string> {
  const payload = await res.json().catch(() => ({}));
  if (typeof payload?.detail === "string") return payload.detail;
  if (Array.isArray(payload?.detail)) return payload.detail.map(String).join(", ");
  return `Error ${res.status}`;
}

async function botFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${HOST}${path}`, {
    ...init,
    headers: {
      ...authHeader(accessToken),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new BotApiError(await parseError(res), res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/** GET /bot/health — el front lo usa para detectar si el módulo ya está desplegado */
export async function checkBotsHealth(accessToken: string): Promise<boolean> {
  try {
    const data = await botFetch<BotsHealthResponse>("bot/health", accessToken, {
      method: "GET",
    });
    return data?.status === "ok";
  } catch (err) {
    if (err instanceof BotApiError && (err.status === 404 || err.status === 501)) {
      return false;
    }
    return false;
  }
}

/**
 * POST /bot/cientifico/interconsulta
 * Si hay archivo WSI, el front primero sube con upload-wsi/ y pasa imagen_id.
 */
export async function createInterconsulta(
  accessToken: string,
  body: InterconsultaRequest
): Promise<InterconsultaResult> {
  const raw = await botFetch<Record<string, unknown>>("bot/cientifico/interconsulta", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (raw.result && typeof raw.result === "object") {
    return mapInterconsultaResult(raw.result as Record<string, unknown>);
  }

  return mapInterconsultaResult(raw);
}

/** POST multipart cuando el back acepta PDF/imagen directo en interconsulta */
export async function createInterconsultaWithFile(
  accessToken: string,
  params: {
    file: File;
    tipo_entrada: InterconsultaInputType;
    contexto_clinico?: string;
    paciente_id?: string;
    informe_id?: string;
  }
): Promise<InterconsultaResult> {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("tipo_entrada", params.tipo_entrada);
  if (params.contexto_clinico) formData.append("contexto_clinico", params.contexto_clinico);
  if (params.paciente_id) formData.append("paciente_id", params.paciente_id);
  if (params.informe_id) formData.append("informe_id", params.informe_id);

  const res = await fetch(`${HOST}bot/cientifico/interconsulta`, {
    method: "POST",
    headers: authHeader(accessToken),
    body: formData,
  });

  if (!res.ok) {
    throw new BotApiError(await parseError(res), res.status);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  if (raw.result && typeof raw.result === "object") {
    return mapInterconsultaResult(raw.result as Record<string, unknown>);
  }
  return mapInterconsultaResult(raw);
}

/** GET /bot/cientifico/interconsulta/{id} — polling si el job es async */
export async function getInterconsulta(
  accessToken: string,
  interconsultaId: string
): Promise<InterconsultaResult> {
  const raw = await botFetch<Record<string, unknown>>(
    `bot/cientifico/interconsulta/${encodeURIComponent(interconsultaId)}`,
    accessToken
  );

  if (raw.result && typeof raw.result === "object") {
    return mapInterconsultaResult(raw.result as Record<string, unknown>);
  }
  return mapInterconsultaResult(raw);
}

/** Poll reutilizando el patrón existente result/{task_id} si el back lo expone igual */
export async function pollInterconsultaTask(
  accessToken: string,
  taskId: string,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<InterconsultaResult> {
  const intervalMs = options?.intervalMs ?? 3000;
  const maxAttempts = options?.maxAttempts ?? 40;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${HOST}bot/cientifico/interconsulta/task/${encodeURIComponent(taskId)}`, {
      headers: authHeader(accessToken),
    });

    if (res.status === 404) {
      // Fallback al endpoint genérico ya usado por Ki-67/HER2
      const legacy = await fetch(`${HOST}result/${encodeURIComponent(taskId)}`, {
        headers: authHeader(accessToken),
      });
      if (!legacy.ok) {
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }
      const legacyData = (await legacy.json()) as Record<string, unknown>;
      if (legacyData.status === "done") {
        const payload =
          (legacyData.result as Record<string, unknown>)?.resultado ??
          legacyData.result ??
          legacyData;
        return mapInterconsultaResult(payload as Record<string, unknown>);
      }
      if (legacyData.status === "failed") {
        throw new BotApiError("La interconsulta falló en el worker.", 500);
      }
    } else if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      if (data.status === "done" || data.status === "completed") {
        if (data.result && typeof data.result === "object") {
          return mapInterconsultaResult(data.result as Record<string, unknown>);
        }
        return mapInterconsultaResult(data);
      }
      if (data.status === "failed") {
        throw new BotApiError("La interconsulta falló en el worker.", 500);
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new BotApiError("Tiempo de espera agotado para la interconsulta.", 408);
}

export async function getVigilanceTopics(accessToken: string): Promise<string[]> {
  const raw = await botFetch<{ topics?: string[]; temas?: string[] }>(
    "bot/cientifico/vigilancia/temas",
    accessToken
  );
  return raw.topics ?? raw.temas ?? [];
}

export async function followVigilanceTopic(accessToken: string, topic: string): Promise<string[]> {
  const raw = await botFetch<{ topics?: string[]; temas?: string[] }>(
    "bot/cientifico/vigilancia/temas",
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, tema: topic }),
    }
  );
  return raw.topics ?? raw.temas ?? [];
}

export async function getVigilanceFeed(accessToken: string): Promise<ReturnType<typeof mapVigilanceItem>[]> {
  const raw = await botFetch<{ items?: Record<string, unknown>[]; novedades?: Record<string, unknown>[] }>(
    "bot/cientifico/vigilancia/feed",
    accessToken
  );
  const list = raw.items ?? raw.novedades ?? [];
  return list.map((item) => mapVigilanceItem(item));
}

export async function getCurrentChallenge(accessToken: string) {
  const raw = await botFetch<Record<string, unknown>>("bot/genial/capsulas/actual", accessToken);
  return mapChallengeCapsule(raw);
}

export async function submitChallengeAnswer(
  accessToken: string,
  capsuleId: string,
  optionId: string
) {
  return botFetch<{ ok: boolean }>(
    `bot/genial/capsulas/${encodeURIComponent(capsuleId)}/respuesta`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: optionId, opcion_id: optionId }),
    }
  );
}

export async function getForumThreads(accessToken: string) {
  const raw = await botFetch<{ threads?: Record<string, unknown>[]; foros?: Record<string, unknown>[] }>(
    "bot/genial/foros",
    accessToken
  );
  const list = raw.threads ?? raw.foros ?? [];
  return list.map((t) => mapForumThread(t));
}

export async function createForumThread(
  accessToken: string,
  body: { title: string; specialty?: string; tags?: string[]; interconsulta_id?: string; caso_id?: string }
) {
  const raw = await botFetch<Record<string, unknown>>("bot/genial/foros", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return mapForumThread(raw);
}

export async function getUserBadges(accessToken: string) {
  const raw = await botFetch<{ badges?: Record<string, unknown>[]; medallas?: Record<string, unknown>[] }>(
    "bot/genial/perfil/badges",
    accessToken
  );
  const list = raw.badges ?? raw.medallas ?? [];
  return list.map((b) => mapBadge(b));
}

export async function getDivulgacionDrafts(accessToken: string) {
  const raw = await botFetch<{
    drafts?: Record<string, unknown>[];
    borradores?: Record<string, unknown>[];
  }>("bot/genial/divulgacion/borradores", accessToken);
  const list = raw.drafts ?? raw.borradores ?? [];
  return list.map((d) => mapDivulgacionDraft(d));
}

export async function updateDivulgacionDraft(
  accessToken: string,
  draftId: string,
  body: { action: "approve" | "edit"; body?: string }
) {
  const raw = await botFetch<Record<string, unknown>>(
    `bot/genial/divulgacion/borradores/${encodeURIComponent(draftId)}`,
    accessToken,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return mapDivulgacionDraft(raw);
}

export async function getWellnessAlert(accessToken: string) {
  const raw = await botFetch<Record<string, unknown>>("bot/genial/bienestar", accessToken);
  return mapWellnessAlert(raw);
}
