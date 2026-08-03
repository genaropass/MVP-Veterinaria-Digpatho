import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/debug/config → { apiHost: "https://api.digpatho.com/" }
 * Para verificar qué URL de API usa el servidor (registro, login, admin).
 * Si sale api-preprod, corregir .env.production en el servidor y reiniciar.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.setHeader("Allow", "GET").status(405).json({ error: "Method not allowed" });
  }
  const apiHost = process.env.NEXT_PUBLIC_API_URL || "https://api.digpatho.com/";
  res.status(200).json({ apiHost });
}
