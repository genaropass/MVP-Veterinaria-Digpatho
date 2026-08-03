import { NextRequest, NextResponse } from "next/server";
import { HOST, API_TOKEN } from "@/utils/constants";

/**
 * Proxy para obtener metadata de un WSI desde el backend protegido.
 *
 * Frontend llama a:
 *   GET /api/wsi/metadata/[wsiName]
 *
 * Este handler llama al backend real:
 *   GET {HOST}tiles/metadata/[wsiName]
 * con el header Authorization requerido y devuelve el JSON tal cual.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ wsiName: string }> }
) {
  const { wsiName } = await params;

  if (!wsiName) {
    return NextResponse.json(
      { error: "Missing wsiName" },
      { status: 400 }
    );
  }

  // HOST suele terminar en "/", pero el backend tolera el doble slash.
  const backendUrl = `${HOST}tiles/metadata/${encodeURIComponent(wsiName)}`;

  try {
    const backendRes = await fetch(backendUrl, {
      headers: {
        Authorization: API_TOKEN ? `Bearer ${API_TOKEN}` : "",
      },
      // Metadata cambia poco; permitimos cache básico en el edge/browser
      cache: "no-store",
    });

    if (!backendRes.ok) {
      const text = await backendRes.text().catch(() => "");
      console.error("[WSI metadata] Backend error", {
        status: backendRes.status,
        url: backendUrl,
        body: text.slice(0, 500),
      });
      return NextResponse.json(
        { error: "Error fetching WSI metadata" },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[WSI metadata] Network error", error);
    return NextResponse.json(
      { error: "Network error fetching WSI metadata" },
      { status: 500 }
    );
  }
}

