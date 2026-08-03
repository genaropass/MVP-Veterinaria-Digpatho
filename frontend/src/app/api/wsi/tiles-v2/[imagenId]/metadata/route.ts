import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { HOST } from "@/utils/constants";

type MetadataPayload = {
  width: number;
  height: number;
  tileSize: number;
  minLevel: number;
  maxLevel: number;
};

function normalizeMetadata(payload: any): MetadataPayload | null {
  const width = Number(payload?.width);
  const height = Number(payload?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  return {
    width,
    height,
    tileSize: Number(payload?.tileSize ?? payload?.tile_size ?? 256),
    minLevel: Number(payload?.minLevel ?? payload?.min_level ?? 0),
    maxLevel: Number(payload?.maxLevel ?? payload?.max_level ?? 10),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ imagenId: string }> }
) {
  const { imagenId } = await params;
  const session = await auth();
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ detail: "Sesion expirada." }, { status: 401 });
  }

  if (!imagenId) {
    return NextResponse.json({ detail: "imagen_id faltante." }, { status: 400 });
  }

  const candidates = [
    `${HOST}tiles-v2/metadata/${encodeURIComponent(imagenId)}`,
    `${HOST}tiles-v2/${encodeURIComponent(imagenId)}/metadata`,
    `${HOST}tiles-v2/${encodeURIComponent(imagenId)}/info`,
  ];

  for (const backendUrl of candidates) {
    try {
      const backendRes = await fetch(backendUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!backendRes.ok) {
        continue;
      }

      const payload = await backendRes.json().catch(() => null);
      const normalized = normalizeMetadata(payload);
      if (!normalized) {
        continue;
      }

      return NextResponse.json(normalized, { status: 200 });
    } catch {
      // Try next metadata candidate endpoint.
    }
  }

  return NextResponse.json(
    { detail: "No se encontro metadata para la imagen." },
    { status: 404 }
  );
}
