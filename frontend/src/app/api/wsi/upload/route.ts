import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { HOST } from "@/utils/constants";

export async function POST(req: Request) {
  const session = await auth();
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ detail: "Sesion expirada." }, { status: 401 });
  }

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return NextResponse.json({ detail: "Formulario invalido." }, { status: 400 });
  }

  const informeId = incoming.get("informe_id");
  const file = incoming.get("file");

  if (typeof informeId !== "string" || !informeId.trim()) {
    return NextResponse.json({ detail: "informe_id es requerido." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ detail: "file es requerido." }, { status: 400 });
  }

  const body = new FormData();
  body.append("informe_id", informeId.trim());
  body.append("file", file);

  const backendUrl = `${HOST}upload-wsi/`;

  try {
    const backendRes = await fetch(backendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body,
      cache: "no-store",
    });

    const contentType = backendRes.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await backendRes.json()
      : { detail: await backendRes.text() };

    if (!backendRes.ok) {
      return NextResponse.json(payload, { status: backendRes.status });
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("[WSI upload] Network error", error);
    return NextResponse.json(
      { detail: "Error de red al subir el archivo WSI." },
      { status: 500 }
    );
  }
}
export const runtime = 'nodejs';
export const maxDuration = 900;
