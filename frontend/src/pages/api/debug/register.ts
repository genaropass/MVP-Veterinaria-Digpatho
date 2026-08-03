import type { NextApiRequest, NextApiResponse } from "next";
import { HOST, API_TOKEN } from "@/utils/constants";

/**
 * POST /api/debug/register - Llama al backend POST users/ y devuelve la respuesta cruda.
 * Body: { "name": "...", "email": "...", "password": "..." }
 * Ruta Pages Router para diagnóstico cuando las rutas App Router devuelven 404 HTML.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.setHeader("Allow", "POST").status(405).json({ error: "Method not allowed" });
  }
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Body debe tener name, email y password",
    });
  }
  const url = `${HOST}users/`;
  try {
    const backendRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ nombre: name, mail: email, password }),
    });
    const text = await backendRes.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // leave as string
    }
    res.status(200).json({
      backendUrl: url,
      status: backendRes.status,
      statusText: backendRes.statusText,
      ok: backendRes.ok,
      body: parsed,
    });
  } catch (err) {
    res.status(500).json({
      error: "Error al llamar al backend",
      detail: String(err),
    });
  }
}
