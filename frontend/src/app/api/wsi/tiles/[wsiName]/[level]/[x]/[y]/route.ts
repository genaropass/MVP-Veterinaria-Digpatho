import { NextRequest } from "next/server";
import { HOST, API_TOKEN } from "@/utils/constants";

/**
 * Proxy para obtener un tile individual desde el backend protegido.
 *
 * Frontend / OpenSeadragon llama a:
 *   GET /api/wsi/tiles/[wsiName]/[level]/[x]/[y]
 *
 * Este handler llama al backend real:
 *   GET {HOST}tiles/[wsiName]/[level]/[x]/[y]
 * con el header Authorization requerido y devuelve la imagen tal cual.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ wsiName: string; level: string; x: string; y: string }> }
) {
  const { wsiName, level, x, y } = await params;

  if (!wsiName || level == null || x == null || y == null) {
    return new Response("Missing tile parameters", { status: 400 });
  }

  const backendUrl = `${HOST}tiles/${encodeURIComponent(
    wsiName
  )}/${level}/${x}/${y}`;

  try {
    const backendRes = await fetch(backendUrl, {
      headers: {
        Authorization: API_TOKEN ? `Bearer ${API_TOKEN}` : "",
      },
      cache: "no-store",
    });

    if (!backendRes.ok) {
      const text = await backendRes.text().catch(() => "");
      console.error("[WSI tile] Backend error", {
        status: backendRes.status,
        url: backendUrl,
        body: text.slice(0, 300),
      });
      return new Response("Error fetching tile", {
        status: backendRes.status,
      });
    }

    const contentType = backendRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await backendRes.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Tiles se pueden cachear fuerte en el cliente/CDN
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[WSI tile] Network error", error);
    return new Response("Network error fetching tile", { status: 500 });
  }
}

