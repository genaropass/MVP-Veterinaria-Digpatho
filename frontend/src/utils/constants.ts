/**
 * Base URL del backend (API). En producción usar api.digpatho.com, NO app.digpatho.com.
 *
 * Importante: `NEXT_PUBLIC_*` se incrusta en **build time**. Si en el build quedó `http://`,
 * el servidor seguirá llamando http aunque después corrijas `.env` en disco.
 * En **servidor** usamos `API_URL` (sin NEXT_PUBLIC) para leer la URL en **runtime** (login, API routes).
 * En **cliente** sigue valiendo `NEXT_PUBLIC_API_URL` (rebuild si cambia).
 */
function normalizeApiBase(raw: string): string {
  const t = raw.trim();
  return t.endsWith("/") ? t : `${t}/`;
}

const DEFAULT_API = "https://api.digpatho.com/";

/** En producción no usar NEXT_PUBLIC_* en servidor: queda incrustado en el build y puede seguir siendo http. */
function getServerApiBase(): string {
  if (process.env.API_URL) {
    return normalizeApiBase(process.env.API_URL);
  }
  if (process.env.NODE_ENV !== "production") {
    return normalizeApiBase(process.env.NEXT_PUBLIC_API_URL || DEFAULT_API);
  }
  return DEFAULT_API;
}

export const HOST =
  typeof window === "undefined"
    ? getServerApiBase()
    : normalizeApiBase(process.env.NEXT_PUBLIC_API_URL || DEFAULT_API);

/**
 * URL del frontend/app para redirects (logout, sesión expirada).
 * En preprod: NEXT_PUBLIC_APP_URL (ej. https://app-preprod.digpatho.com).
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.digpatho.com";

/** Token para autenticación con el backend API. Usar env API_TOKEN en servidor; en cliente puede exponerse si el backend lo permite. */
export const API_TOKEN = process.env.API_TOKEN || process.env.NEXT_PUBLIC_API_TOKEN || "";

export const UPLOAD_THRESHOLD = 90_000_000; // 90 MB
export const CHUNK_SIZE = 10_000_000; // 10 MB por fragmento (ajustable)
export const MAX_RETRIES = 3; // Intentos por cada chunk que falle

//export const HOST = process.env.HOST || "http://18.220.112.181:8000/";   
//export const HOST = process.env.HOST || "http://127.0.0.1:8000/";
