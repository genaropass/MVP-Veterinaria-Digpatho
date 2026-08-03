import { auth } from "@/lib/auth";
import { HOST } from "@/utils/constants";

export async function GET(
  _req: Request,
  {
    params,
  }: { params: Promise<{ imagenId: string; level: string; x: string; y: string }> }
) {
  const { imagenId, level, x, y } = await params;
  const session = await auth();
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!accessToken) {
    return new Response("Sesion expirada", { status: 401 });
  }

  if (!imagenId || level == null || x == null || y == null) {
    return new Response("Missing tile parameters", { status: 400 });
  }

  const backendUrl = `${HOST}tiles-v2/${encodeURIComponent(imagenId)}/${level}/${x}/${y}`;

  try {
    const backendRes = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!backendRes.ok) {
      return new Response("Tile not found", { status: backendRes.status });
    }

    const contentType = backendRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await backendRes.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[WSI tiles-v2] Network error", error);
    return new Response("Network error fetching tile", { status: 500 });
  }
}
