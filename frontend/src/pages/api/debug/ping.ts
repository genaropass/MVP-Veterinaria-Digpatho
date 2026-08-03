import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/debug/ping → { "ok": true }
 * Ruta Pages Router para evitar que el App Router (next-intl, etc.) devuelva 404 HTML.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.setHeader("Allow", "GET").status(405).json({ error: "Method not allowed" });
  }
  res.status(200).json({ ok: true });
}
