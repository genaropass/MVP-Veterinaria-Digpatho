/**
 * api-client.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cliente HTTP global con interceptor de respuestas para el manejo automático
 * de sesiones expiradas (JWT 401 Unauthorized).
 *
 * CÓMO FUNCIONA:
 *   1. Todas las llamadas al backend deben pasar por `apiFetch()` en lugar de
 *      `fetch()` directamente.
 *   2. Si el backend responde con HTTP 401, el interceptor:
 *      a) Limpia la sesión de NextAuth (signOut).
 *      b) Redirige al usuario a /auth/sign-in con el mensaje de sesión expirada.
 *   3. Lanza `SessionExpiredError` para que el código llamador pueda detener
 *      su ejecución inmediatamente (el redirect ya fue iniciado).
 *
 * USO:
 *   import { apiFetch } from "@/lib/api-client";
 *   const data = await apiFetch("/mi-endpoint", { method: "GET", ... });
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { signOut } from "next-auth/react";
import { APP_URL } from "@/utils/constants";

// ── Error especial para señalizar que la sesión expiró ────────────────────────
export class SessionExpiredError extends Error {
  constructor() {
    super("Sesión expirada. El usuario fue redirigido al login.");
    this.name = "SessionExpiredError";
  }
}

// ── Flag para evitar múltiples redirecciones simultáneas ─────────────────────
let isHandlingExpiry = false;

/**
 * Maneja el cierre de sesión automático cuando el backend devuelve 401.
 * Se ejecuta UNA sola vez aunque múltiples requests fallen al mismo tiempo.
 */
async function handleSessionExpired(): Promise<void> {
  if (isHandlingExpiry) return;
  isHandlingExpiry = true;

  console.warn("[api-client] Token JWT expirado. Cerrando sesión automáticamente.");

  try {
    // Cierra la sesión de NextAuth (limpia cookies y estado global)
    await signOut({
      redirect: false, // Manejamos la redirección manualmente
    });
  } catch (err) {
    console.error("[api-client] Error durante signOut:", err);
  }

  // Redirige a login con mensaje de sesión expirada
  const loginUrl = new URL("/auth/sign-in", window.location.origin);
  loginUrl.searchParams.set("reason", "session_expired");

  // Usamos window.location para garantizar recarga completa del estado
  if (typeof window !== "undefined") {
    window.location.href = loginUrl.toString();
  }
}

/**
 * Wrapper global de fetch con interceptor de 401.
 *
 * @param url      - URL completa o ruta relativa del endpoint
 * @param options  - Opciones estándar de RequestInit (headers, method, body, etc.)
 * @returns        - La Response de fetch si el request fue exitoso
 * @throws         - SessionExpiredError si el backend responde 401
 * @throws         - Error genérico para otros errores HTTP o de red
 */
export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(url, options);
  } catch (networkError) {
    // Error de red (sin conexión, CORS, etc.) — no es 401
    throw networkError;
  }

  // ── Interceptor 401: Sesión / Token expirado ──────────────────────────────
  if (response.status === 401) {
    await handleSessionExpired();
    throw new SessionExpiredError();
  }

  return response;
}

/**
 * Versión tipada de apiFetch que parsea JSON directamente.
 * Útil para reemplazar patrones como:
 *   const data = await fetch(url, opts).then(r => r.json())
 *
 * @template T - Tipo de la respuesta JSON esperada
 */
export async function apiFetchJson<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await apiFetch(url, options);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${errorBody.slice(0, 200)}`
    );
  }

  return response.json() as Promise<T>;
}
