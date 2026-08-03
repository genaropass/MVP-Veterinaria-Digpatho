import { HOST } from "@/utils/constants";
import { apiFetch } from "@/lib/api-client";

export async function enviarInforme(informeId: string, contenido: string, authToken: string) {
    // ✅ apiFetch intercepta 401 globalmente y fuerza logout automático
    const response = await apiFetch(`${HOST}informe/${informeId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            Accept: "application/json",
        },
        body: JSON.stringify({
            id: informeId,
            promedio_rta_img: contenido,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error al enviar informe:", errorData);
        throw new Error(errorData.detail || "Error al enviar el informe");
    }

    return await response.json();
}

export async function getPatientReport(pacienteId: string, authToken: string) {
    // ✅ apiFetch intercepta 401 globalmente y fuerza logout automático
    const res = await apiFetch(`${HOST}informe/paciente_id/${pacienteId}`, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        }
    });
    if (!res.ok) {
        if (res.status === 400) {
            return []; // Paciente sin informes
        }
        const errorText = await res.text();
        console.error("Error al obtener informes:", errorText);
        throw new Error("Error al obtener informes");
    }
    return await res.json();
}