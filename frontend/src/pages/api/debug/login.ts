import type { NextApiRequest, NextApiResponse } from "next";
import { HOST, API_TOKEN } from "@/utils/constants";

/**
 * GET /api/debug/login?email=...&password=...
 * POST /api/debug/login body: { "email": "...", "password": "..." }
 * Llama al backend users_login/ y devuelve la respuesta cruda.
 * Ruta Pages Router para diagnóstico cuando las rutas App Router devuelven 404 HTML.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.setHeader("Allow", "GET, POST").status(405).json({ error: "Method not allowed" });
  }
  let email: string;
  let password: string;
  if (req.method === "GET") {
    email = (req.query.email as string) ?? "";
    password = (req.query.password as string) ?? "";
  } else {
    const body = (req.body ?? {}) as { email?: string; password?: string };
    email = body.email ?? "";
    password = body.password ?? "";
  }
  if (!email || !password) {
    return res.status(400).json({
      error:
        req.method === "GET"
          ? "Query params email y password requeridos"
          : "Body debe tener email y password",
    });
  }
  const url = `${HOST}users_login/`;
  try {
    const backendRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ mail: email, email, password }),
    });
    const text = await backendRes.text();
    let bodyRes: unknown = text;
    try {
      bodyRes = JSON.parse(text);
    } catch {
      // leave as text
    }
    res.status(200).json({
      backendUrl: url,
      status: backendRes.status,
      statusText: backendRes.statusText,
      body: bodyRes,
      hasAccessToken:
        typeof bodyRes === "object" &&
        bodyRes !== null &&
        "access_token" in bodyRes,
    });
  } catch (err) {
    res.status(500).json({
      error: "Error al llamar al backend",
      detail: String(err),
    });
  }
}
