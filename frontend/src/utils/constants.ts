/**
 * Base URL del backend (API).
 */
function normalizeApiBase(raw: string): string {
  const t = raw.trim();
  return t.endsWith("/") ? t : `${t}/`;
}

function getServerApiBase(): string {
  if (process.env.API_URL) {
    return normalizeApiBase(process.env.API_URL);
  }
  return normalizeApiBase(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/");
}

export const HOST =
  typeof window === "undefined"
    ? getServerApiBase()
    : normalizeApiBase(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/");

/**
 * URL del frontend/app para redirects (logout, sesión expirada).
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Token para autenticación server-side (NO exponer en NEXT_PUBLIC) */
export const API_TOKEN = process.env.API_TOKEN || "";

export const UPLOAD_THRESHOLD = 90_000_000; // 90 MB
export const CHUNK_SIZE = 10_000_000; // 10 MB por fragmento (ajustable)
export const MAX_RETRIES = 3; // Intentos por cada chunk que falle
