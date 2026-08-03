import { API_TOKEN, HOST } from "@/utils/constants";
import { apiFetch } from "@/lib/api-client";

interface PatientSearchParams {
  dni: string;
  sexo?: string;
  birthDate?: string;
  accessToken?: string;
}

/** Token del usuario logueado (session.accessToken). Si no se pasa, se usa API_TOKEN (solo en servidor). */
function authHeader(accessToken?: string): string {
  const token = accessToken || API_TOKEN;
  return token ? `Bearer ${token}` : "Bearer";
}

export async function getPatientDNI({ dni, sexo, birthDate, accessToken }: PatientSearchParams) {
    const queryParams = new URLSearchParams({ paciente_dni: dni });
    if (sexo) queryParams.append("paciente_sexo", sexo);
    if (birthDate) queryParams.append("paciente_fecha_de_nacimiento", birthDate);
    console.log("url: ", `${HOST}paciente_dni_sexo?${queryParams.toString()}`)

    // ✅ Usa apiFetch: intercepta automáticamente el error 401 (sesión expirada)
    const response = await apiFetch(`${HOST}paciente_dni_sexo?${queryParams.toString()}`, {
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader(accessToken),
        },
    });
    if (response.status === 404) {
        // Paciente no encontrado: array vacío para que el flujo siga
        return [];
    }

    if (!response.ok) {
        throw new Error("Error buscando paciente");
    }
    return await response.json();
}

export async function createPatient(
    name: string,
    dni: string,
    sexo: string,
    fecha_de_nacimiento: string,
    userEmail: string,
    accessToken?: string
) {
    // ✅ Usa apiFetch: intercepta automáticamente el error 401 (sesión expirada)
    const res = await apiFetch(`${HOST}paciente/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader(accessToken),
        },
        body: JSON.stringify({
            nombre: name,
            dni: dni,
            sexo: sexo,
            fecha_de_nacimiento: fecha_de_nacimiento,
            mail: userEmail,
        }),
    });

    if (!res.ok) throw new Error("Error al crear paciente");
    return await res.json();
}
