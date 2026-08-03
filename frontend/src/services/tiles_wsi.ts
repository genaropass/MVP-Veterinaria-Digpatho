/**
 * Rutas públicas del frontend para acceder a los tiles.
 *
 * En lugar de llamar directamente a `https://api.digpatho.com/...` desde el navegador
 * (lo que requiere manejar tokens/jwt en el cliente), usamos rutas internas de Next:
 *
 * - `/api/wsi/metadata/[wsiName]`
 * - `/api/wsi/tiles/[wsiName]/[level]/[x]/[y]`
 *
 * Esas rutas del API se encargan de hablar con el backend real (api.digpatho.com)
 * incluyendo los headers de autenticación necesarios.
 */
const WSI_API_BASE = "/api/wsi";

export type WsiUploadResponse = {
  imagen_id: string;
  ubicacion?: string;
  tipo?: string;
  [key: string]: unknown;
};

export type WsiTilesMetadata = {
  width: number;
  height: number;
  tileSize: number;
  minLevel: number;
  maxLevel: number;
};

/**
 * Construye la URL para obtener metadata de un WSI a través del API interno.
 */
export function buildMetadataUrl(wsiName: string): string {
  return `${WSI_API_BASE}/metadata/${encodeURIComponent(wsiName)}`;
}

/**
 * Construye la URL para obtener un tile específico a través del API interno.
 */
export function buildTileUrl(
  wsiName: string,
  level: number,
  x: number,
  y: number,
  tileSize = 256
): string {
  return `${WSI_API_BASE}/tiles/${encodeURIComponent(
    wsiName
  )}/${level}/${x}/${y}`;
}

export function buildTilesV2MetadataUrl(imagenId: string): string {
  return `${WSI_API_BASE}/tiles-v2/${encodeURIComponent(imagenId)}/metadata`;
}

export function buildTilesV2TileUrl(
  imagenId: string,
  level: number,
  x: number,
  y: number
): string {
  return `${WSI_API_BASE}/tiles-v2/${encodeURIComponent(
    imagenId
  )}/${level}/${x}/${y}`;
}

export async function uploadWsiFile(params: {
  informeId: string;
  file: File;
}): Promise<WsiUploadResponse> {
  const formData = new FormData();
  formData.append("informe_id", params.informeId);
  formData.append("file", params.file);

  const res = await fetch(`${WSI_API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await res.json()
    : { detail: await res.text() };

  if (!res.ok) {
    const detail =
      typeof payload?.detail === "string"
        ? payload.detail
        : "No se pudo subir el archivo WSI.";
    throw new Error(detail);
  }

  return payload as WsiUploadResponse;
}

export async function getTilesV2Metadata(imagenId: string): Promise<WsiTilesMetadata> {
  const res = await fetch(buildTilesV2MetadataUrl(imagenId), {
    cache: "no-store",
  });

  if (!res.ok) {
    const maybeJson = await res
      .json()
      .catch(async () => ({ detail: await res.text().catch(() => "") }));
    throw new Error(
      typeof maybeJson?.detail === "string"
        ? maybeJson.detail
        : "No se pudo obtener metadata del WSI."
    );
  }

  const data = await res.json();
  return {
    width: Number(data.width),
    height: Number(data.height),
    tileSize: Number(data.tileSize ?? data.tile_size ?? 256),
    minLevel: Number(data.minLevel ?? data.min_level ?? 0),
    maxLevel: Number(data.maxLevel ?? data.max_level ?? 10),
  };
}
