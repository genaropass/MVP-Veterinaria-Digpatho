'use client';

import { getPatientDNI, createPatient } from "@/services/patientService";
import { getPatientReport } from "@/services/reportsService";
import { Warning } from "postcss";
import { toast } from "sonner";

export async function createPatientIfNotExists({ 
  session, 
  name, 
  dni, 
  sexo, 
  birthDate,
} : {
  session: any; 
  name: string; 
  dni: string; 
  sexo: string; 
  birthDate: string;
}) {
  if (!session?.user?.email) {
    toast.warning("Usuario no autenticado");
    return;
  }

  if (!name || !dni || !sexo || !birthDate) {
    toast.warning("Please complete all required fields");
    return;
  }

  const authToken = (session as any)?.accessToken;
  try {
    const existing = await getPatientDNI({ dni, sexo, birthDate, accessToken: authToken });
    if (existing && existing.length > 0) {
      throw new Error("El paciente ya existe");
    } 
    /* Creamos el paciente solo si no existe, luego de chequear arriba*/
    console.log("Creando paciente")
    return await createPatient(name, dni, sexo, birthDate, session.user.email, authToken);
  } catch (error: any) {
    console.error(error);

    const message = error?.message || "";

    // 👇 Caso especial: paciente duplicado
    if (message.includes("El paciente ya existe")) {
      toast.error("El paciente ya existe");
      return;
    }

    // 👇 Caso especial: problema de red
    if (message.includes("Failed to fetch")) {
      toast.error("Connection error");
      return;
    }

    // 👇 Cualquier otro error genérico
    toast.error("Error communicating with the server");
  }
}

export async function searchPatientAndReports({ 
  dni, 
  sexo, 
  birthDate,
  session,
}: { 
  dni: string; 
  sexo: string; 
  birthDate: string;
  session: any;
}) {
  const authToken = (session as any)?.accessToken || "";
  
  const patients = await getPatientDNI({ dni, sexo, birthDate, accessToken: authToken });
  if (patients.length !== 1) {
    if (patients.length === 0) {
      toast.error(
        "Paciente no encontrado"
      );
      throw new Error("Paciente no encontrado")
    }
    if (patients.length > 1) {
      toast.warning(
        "Multiple patients found with that ID. Please also enter sex or date of birth."
      );
      throw new Warning("Multiple patients found. Add sex or date of birth.")
    }
  }

  const patient = patients[0];

  if (patient.fecha_de_nacimiento) {
    patient.fecha_de_nacimiento = patient.fecha_de_nacimiento.slice(0, 10);
  }

  const reports = await getPatientReport(patient.id, authToken);

  if (reports.length === 0) {
    toast.info("No se encontraron informes para este paciente.");
  }

  return { patient, reports };
}
