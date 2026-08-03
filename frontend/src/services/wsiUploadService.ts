import { CHUNK_SIZE, MAX_RETRIES } from "@/utils/constants";
import { apiFetch, apiFetchJson } from "@/lib/api-client";
import { HOST } from "@/utils/constants";

/**
 * Subida simple (archivo <= 90 MB) — un solo POST multipart a /upload-wsi/
 */
export async function uploadSimpleMode(
	file: File,
	informe_id: string,
	token: string,
	onProgress?: (percent: number) => void,
	signal?: AbortSignal
): Promise<string> {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("informe_id", informe_id);

	if (onProgress) onProgress(10);

	const response = await apiFetchJson<{ imagen_id: string }>(
		`${HOST}upload-wsi/`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
			},
			body: formData,
			signal,
		}
	);

	if (onProgress) onProgress(100);
	return response.imagen_id;
}

/**
 * Subida por chunks (archivo > 90 MB)
 * Flujo: init → loop de chunks → complete
 */
export async function uploadChunkedMode(
	file: File,
	informe_id: string,
	token: string,
	onProgress?: (percent: number) => void,
	signal?: AbortSignal
): Promise<string> {
	const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

	// ── 1. INIT: el backend espera Form data ──────────────────────────────────
	const initForm = new FormData();
	initForm.append("informe_id", informe_id);
	initForm.append("filename", file.name);
	initForm.append("size", file.size.toString());
	initForm.append("content_type", file.type || "application/octet-stream");
	initForm.append("total_chunks", totalChunks.toString());

	const initResponse = await apiFetchJson<{ upload_id: string }>(
		`${HOST}upload-wsi/init`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
			},
			body: initForm,
			signal,
		}
	);

	const { upload_id } = initResponse;

	// ── 2. LOOP DE CHUNKS ─────────────────────────────────────────────────────
	for (let index = 0; index < totalChunks; index++) {
		// Cancelación controlada desde el componente visual
		if (signal?.aborted) {
			await apiFetch(`${HOST}upload-wsi/${upload_id}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			throw new Error("Subida cancelada por el usuario");
		}

		// Cortar el pedazo de archivo correspondiente
		const start = index * CHUNK_SIZE;
		const end = Math.min(start + CHUNK_SIZE, file.size);
		const chunk = file.slice(start, end);

		// Subir con reintentos — PUT binario puro con chunk_index como query param
		await uploadChunkWithRetries(upload_id, chunk, index, totalChunks, token, signal);

		// Actualizar progreso
		const progressPercent = Math.round(((index + 1) / totalChunks) * 100);
		if (onProgress) {
			onProgress(progressPercent);
		}
	}

	// ── 3. COMPLETE: upload_id va como path param ─────────────────────────────
	const completeResponse = await apiFetchJson<{ imagen_id: string }>(
		`${HOST}upload-wsi/complete/${upload_id}`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
			},
			signal,
		}
	);

	return completeResponse.imagen_id;
}

/**
 * Sube un chunk individual con reintentos automáticos.
 * El backend espera: PUT /upload-wsi/chunk/{upload_id}?chunk_index=N
 * con body binario (application/octet-stream).
 */
async function uploadChunkWithRetries(
	uploadId: string,
	chunk: Blob,
	chunkIndex: number,
	totalChunks: number,
	token: string,
	signal?: AbortSignal,
	retriesLeft: number = MAX_RETRIES
): Promise<void> {
	try {
		const res = await apiFetch(
			`${HOST}upload-wsi/chunk/${uploadId}?chunk_index=${chunkIndex}`,
			{
				method: "PUT",
				body: chunk,
				headers: {
					"Content-Type": "application/octet-stream",
					Authorization: `Bearer ${token}`,
				},
				signal,
			}
		);

		if (!res.ok) {
			const errTxt = await res.text().catch(() => "");
			throw new Error(`HTTP ${res.status} ${res.statusText} - ${errTxt}`);
		}
	} catch (error: any) {
		// Si fue cancelación del usuario, no reintentamos
		if (error.name === "AbortError" || signal?.aborted) {
			throw error;
		}

		if (retriesLeft > 0) {
			console.warn(
				`Fallo al subir chunk ${chunkIndex}. Reintentos restantes: ${retriesLeft}`
			);
			// Backoff antes de reintentar
			await new Promise((resolve) => setTimeout(resolve, 1500));
			return uploadChunkWithRetries(
				uploadId, chunk, chunkIndex, totalChunks, token, signal, retriesLeft - 1
			);
		} else {
			throw new Error(
				`La conexión de red falló permanentemente en el chunk ${chunkIndex}.`
			);
		}
	}
}
