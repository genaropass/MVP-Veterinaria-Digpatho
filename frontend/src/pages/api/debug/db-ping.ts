import type { NextApiRequest, NextApiResponse } from "next";
import db from "@/lib/db/db";

/**
 * GET /api/debug/db-ping → { "ok": true, "db": "ok" } si la conexión a la DB funciona.
 * Si falla, devuelve 500 con el mensaje de error.
 * Sirve para verificar que POSTGRES_URL y DIRECT_URL están bien configurados.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.setHeader("Allow", "GET").status(405).json({ error: "Method not allowed" });
  }
  try {
    await db.$queryRaw`SELECT 1`;
    res.status(200).json({ ok: true, db: "ok" });
  } catch (error: any) {
    console.error("[db-ping] Error conectando a la DB:", error?.message || error);
    res.status(500).json({
      ok: false,
      db: "error",
      error: error?.message || String(error),
    });
  }
}
