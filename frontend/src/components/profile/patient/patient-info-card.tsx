/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { usePatient } from "@/context/patient-context";
import {
  createPatientIfNotExists,
  searchPatientAndReports,
} from "./patient-info-utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { HOST } from "@/utils/constants";
import { getPatientSchema, PatientFormData } from "@/schemas/patientSchema";
import { ErrorMessage, SuccessIndicator, getInputClassName } from "../../form-utils";
import PatientFormFields from "./patient-form-fields";
import { PatientReports } from "./patient-reports";


type Informe = {
  id: string;
  fecha_de_muestra: string;
  tipo_estudio: string;
  pacienteId: string;
  promedio_rta_img: string;
};


export function PatientInfoCard() {
  const { data: session, status } = useSession();
  const { pacienteId, setPacienteId, informeId, setInformeId } = usePatient();
  const t = useTranslations("PatientInfoCard");
  const patientSchema = getPatientSchema(t);

  // Form state
  const formMethods = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    mode: "onBlur",
    defaultValues: {
      dni: "",
      nombre: "",
      sexo: undefined,
      fecha_de_nacimiento: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, touchedFields, isValid },
    watch,
    reset,
    trigger,
  } = formMethods;

  // Watch form values
  const watchedValues = watch();

  // Additional state
  const [informesPaciente, setInformesPaciente] = useState<Informe[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    // Validate DNI before searching
    const isDNIValid = await trigger("dni");
    if (!isDNIValid || !watchedValues.dni) {
      toast.info("Please enter a valid ID to search for a patient.");
      return;
    }
    setIsSearching(true);

    const queryParams = new URLSearchParams({
      paciente_dni: watchedValues.dni,
    });

    if (watchedValues.sexo) {
      queryParams.append("paciente_sexo", watchedValues.sexo);
    }
    if (watchedValues.fecha_de_nacimiento) {
      queryParams.append(
        "paciente_fecha_de_nacimiento",
        watchedValues.fecha_de_nacimiento
      );
    }

    try {
      const { patient, reports } = await searchPatientAndReports({
        dni: watchedValues.dni,
        sexo: watchedValues.sexo,
        birthDate: watchedValues.fecha_de_nacimiento,
        session,
      });

      // Rellenar el formulario con los datos del paciente encontrado
      reset({
        dni: patient.dni || "",
        nombre: patient.nombre || "",
        sexo: patient.sexo || undefined,
        fecha_de_nacimiento: patient.fecha_de_nacimiento || "",
      });

      setPacienteId(patient.id);
      setInformesPaciente(reports);
      setInformeId(null); 
      toast.success(t("toasts.patient-found"));
    } catch (error: any) {
      console.error(error);
      
      // Si el paciente no se encontró, limpiar el pacienteId para mostrar el botón de crear
      if (error.message?.includes("Paciente no encontrado")) {
        setPacienteId("");
        setInformesPaciente([]);
        setInformeId(null);
      }
      
      if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("NetworkError")
      ) {
        toast.error(t("toasts.network-error"));
      } else {
        toast.error(error.message || t("toasts.error"));
      }
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = async (data: PatientFormData) => {
    if (!session?.user?.email) {
      toast.warning("Usuario no autenticado");
      return;
    }

    if (!/^\d{7,8}$/.test(data.dni)) {
      toast.error("ID must be 7 to 8 numeric digits.");
      return;
    }

    try {
      const result = await createPatientIfNotExists({
        session: session,
        name: data.nombre,
        dni: data.dni,
        sexo: data.sexo,
        birthDate: data.fecha_de_nacimiento
      });

      if (!result) return;

      toast.success(t("toasts.patient-created"));

      // Find the newly created patient to load all their data
      try {
        const { patient, reports } = await searchPatientAndReports({
          dni: data.dni,
          sexo: data.sexo,
          birthDate: data.fecha_de_nacimiento,
          session,
        });

        // Save patient ID and reports
        setPacienteId(patient.id);
        setInformesPaciente(reports);

      } catch (searchError) {
        // Si falla la búsqueda, al menos guardar el ID del resultado de creación
        console.warn("Could not find the newly created patient:", searchError);
        setPacienteId(result.id);
        setInformesPaciente([]);
      }
    } catch (error: any) {
      console.error(error);
      if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError")
      ) {
        toast.error(
          t("toasts.network-error")
        );
      } else {
        toast.error(
          t("toasts.error")
        );
      }
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Cargando sesión...</span>
      </div>
    );
  }

  return (
    <Card className="bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700">
      <CardContent className="p-6">
        <FormProvider {...formMethods}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <h1 className="text-lg font-semibold text-center text-gray-900 dark:text-gray-100">
              {t("title")}
            </h1>

            {/* DNI Field */}
            <div>
              <Label
                htmlFor="dni"
                className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1"
              >
                {t("patient-id")}
                <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="dni"
                  {...register("dni")}
                  className={
                    getInputClassName("dni", errors, touchedFields, watchedValues) +
                    " dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  }
                  placeholder={t("placeholder.patient-id")}
                  maxLength={8}
                  minLength={7}
                />
                <SuccessIndicator
                  show={!!touchedFields.dni && !errors.dni && !!watchedValues.dni}
                />
              </div>
              <ErrorMessage message={errors.dni?.message} />
            </div>

            {/* Search Button */}
            <Button
              type="button"
              className="mt-2"
              variant="outline"
              onClick={handleSearch}
              disabled={isSearching || !watchedValues.dni || !!errors.dni}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("searching-patient")}
                </>
              ) : (
                t("search-patient")
              )}
            </Button>

            <PatientFormFields />

            {/* Submit Button - Solo mostrar si no hay paciente seleccionado */}
            {!pacienteId && (
              <Button
                type="submit"
                className="mt-4"
                disabled={isSubmitting || !isValid}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("creating-patient")}
                  </>
                ) : (
                  t("create-patient")
                )}
              </Button>
            )}

            {/* Reports Section */}
            {informesPaciente.length > 0 && (
              <PatientReports 
                informesPaciente={informesPaciente} 
                onDeleteInforme={async (informeIdToDelete: string) => {
                  const authToken = (session as any)?.accessToken;
                  if (!authToken) {
                    toast.error("Authentication error. Please sign in again.");
                    return;
                  }

                  try {
                    const response = await fetch(`${HOST}informe/${informeIdToDelete}`, {
                      method: "DELETE",
                      headers: {
                        Authorization: `Bearer ${authToken}`,
                      },
                    });

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({
                        detail: response.statusText,
                      }));
                      throw new Error(errorData.detail || "Error al eliminar el informe");
                    }

                    // Actualizar la lista de informes
                    const updatedInformes = informesPaciente.filter(
                      (informe) => informe.id !== informeIdToDelete
                    );
                    setInformesPaciente(updatedInformes);

                    // Si el informe eliminado era el seleccionado, limpiar la selección
                    if (informeId === informeIdToDelete) {
                      setInformeId(null);
                    }

                    toast.success("Informe eliminado exitosamente");
                  } catch (error: any) {
                    console.error("Error al eliminar informe:", error);
                    toast.error(error.message || "Error al eliminar el informe");
                  }
                }}
              />
            )}
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
