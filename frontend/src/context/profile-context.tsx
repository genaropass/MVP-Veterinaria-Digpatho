/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { API_TOKEN, HOST } from "@/utils/constants";
import { usePatient } from "@/context/patient-context";
import { Coordinate } from "../components/canvas/types";
import { apiFetch, SessionExpiredError } from "@/lib/api-client";

export interface AnalysisResult {
  field: string;
  name: string;
  reportNumber: string;
  percentage: string;
  totalCells: string;
  positiveCells: string;
  negativeCells: string;
  iaPercentage: string;
  iaTotalCells: string;
  iaPositiveCells: string;
  iaNegativeCells: string;
  wrongPositiveCells: string;
  wrongNegativeCells: string;
  coordinates: Coordinate[]; 
  minAxisFilter: number; 
  imagenId: string; 
  preview: string;
  rawApiResult?: unknown;
}

export interface StudyData {
  files: File[];
  previews: Map<string, string>;
  results: Map<string, AnalysisResult | null>;
  imageIds: Map<string, string>;
  analyzedImages: Map<string, string>;
  isAnalyzed: boolean;
  uploadedFileNames: string[];
}
export interface ProfileState {
  ki67: StudyData;
  estrogen: StudyData;
  progesterone: StudyData;
  her2: StudyData;
  reports: {
    ki67: {
      result: string;
      interpretation: string;
    };
    estrogen: {
      positivePercentage: string;
      stainingIntensity: string;
      interpretation: string;
    };
    progesterone: {
      positivePercentage: string;
      stainingIntensity: string;
      interpretation: string;
    };
    her2: {
      positivePercentage: string;
      interpretation: string;
    };
  };
  conclusion: string;
}

const initialStudyData: StudyData = {
  files: [],
  previews: new Map(),
  results: new Map(),
  imageIds: new Map(),
  analyzedImages: new Map(),
  isAnalyzed: false,
  uploadedFileNames: [],
};

const initialState: ProfileState = {
  ki67: { ...initialStudyData },
  estrogen: { ...initialStudyData },
  progesterone: { ...initialStudyData },
  her2: { ...initialStudyData },
  reports: {
    ki67: { result: "", interpretation: "" },
    estrogen: { positivePercentage: "", stainingIntensity: "", interpretation: "" },
    progesterone: { positivePercentage: "", stainingIntensity: "", interpretation: "" },
    her2: { positivePercentage: "", interpretation: "" },
  },
  conclusion: "",
};

export interface ProfileContextType {
  state: ProfileState;
  isAnalyzing: boolean;
  setIsAnalyzing: (value: boolean) => void;
  updateKi67: (data: Partial<StudyData>) => void;
  updateEstrogen: (data: Partial<StudyData>) => void;
  updateProgesterone: (data: Partial<StudyData>) => void;
  updateHer2: (data: Partial<StudyData>) => void;
  updateReports: (data: Partial<ProfileState["reports"]>) => void;
  updateReportField: (section: keyof ProfileState["reports"], field: string, value: string) => void;
  updateConclusion: (value: string) => void;
  addImageToStudy: (studyType: keyof Omit<ProfileState, "reports" | "conclusion">, file: File) => void;
  removeImageFromStudy: (studyType: keyof Omit<ProfileState, "reports" | "conclusion">, fileName: string) => void;
  analyzeStudy: (
    studyType: keyof Omit<ProfileState, "reports" | "conclusion">,
    pacienteId: string | null
  ) => Promise<{ success: boolean; message?: string } | null>;
  updateStudyResult: (studyType: keyof Omit<ProfileState, "reports" | "conclusion">, fileName: string, field: keyof AnalysisResult, value: string | Coordinate[] | number | unknown) => void;
  replaceImageInStudy: (studyType: keyof Omit<ProfileState, "reports" | "conclusion">, oldFileName: string, newFile: File) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProfileState>(initialState);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { informeId, setInformeId } = usePatient();
  const { data: session } = useSession();

  const rawToken = (session as any)?.accessToken;
  const isValidJWT = rawToken && typeof rawToken === "string" && rawToken.split(".").length === 3;
  const authToken = isValidJWT ? rawToken : API_TOKEN;

  // El manejo de 401 está centralizado en apiFetch (src/lib/api-client.ts).
  // Ya no se necesita handleUnauthorized ni validateResponse locales:
  /*
  const handleUnauthorized = async () => {
    signOut({ redirect: false });
    window.location.href = "/auth/sign-in?reason=session_expired";
  };

  const validateResponse = async (response: Response) => {
    if (response.status === 401) {
      await handleUnauthorized();
      throw new Error("Session expired"); // Simulado
    }
  };
  */

  const updateKi67 = (data: Partial<StudyData>) => { setState((prev) => ({ ...prev, ki67: { ...prev.ki67, ...data } })); };
  const updateEstrogen = (data: Partial<StudyData>) => { setState((prev) => ({ ...prev, estrogen: { ...prev.estrogen, ...data } })); };
  const updateProgesterone = (data: Partial<StudyData>) => { setState((prev) => ({ ...prev, progesterone: { ...prev.progesterone, ...data } })); };
  const updateHer2 = (data: Partial<StudyData>) => { setState((prev) => ({ ...prev, her2: { ...prev.her2, ...data } })); };
  const updateReports = (data: Partial<ProfileState["reports"]>) => { setState((prev) => ({ ...prev, reports: { ...prev.reports, ...data } })); };

  const updateReportField = (section: keyof ProfileState["reports"], field: string, value: string) => {
    setState((prev) => ({
      ...prev,
      reports: { ...prev.reports, [section]: { ...(prev.reports[section] as object), [field]: value } },
    }));
  };

  const updateConclusion = (value: string) => { setState((prev) => ({ ...prev, conclusion: value })); };

  const replaceImageInStudy = (studyType: keyof Omit<ProfileState, "reports" | "conclusion">, oldFileName: string, newFile: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const newPreview = event.target?.result as string;
      setState((prev) => {
        const study = prev[studyType];
        const files = study.files.map((f) => f.name === oldFileName ? newFile : f);
        
        const previews = new Map(study.previews);
        previews.delete(oldFileName);
        previews.set(newFile.name, newPreview);

        const results = new Map(study.results);
        const prevResult = results.get(oldFileName) || null;
        results.delete(oldFileName);
        results.set(newFile.name, prevResult);

        const imageIds = new Map(study.imageIds);
        const prevImageId = imageIds.get(oldFileName);
        imageIds.delete(oldFileName);
        if (prevImageId) imageIds.set(newFile.name, prevImageId);

        const analyzedImages = new Map(study.analyzedImages);
        const prevAnalyzed = analyzedImages.get(oldFileName);
        analyzedImages.delete(oldFileName);
        if (prevAnalyzed) analyzedImages.set(newFile.name, prevAnalyzed);

        const uploadedFileNames = study.uploadedFileNames.map((name) => name === oldFileName ? newFile.name : name);

        return { ...prev, [studyType]: { ...study, files, previews, results, imageIds, analyzedImages, uploadedFileNames } };
      });
    };
    reader.readAsDataURL(newFile);
  };

  const addImageToStudy = (studyType: keyof Omit<ProfileState, "reports" | "conclusion">, file: File) => {
    if (state[studyType].files.length >= 1) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setState((current) => {
        const previews = new Map(current[studyType].previews);
        previews.set(file.name, event.target?.result as string);
        const results = new Map(current[studyType].results);
        results.set(file.name, null);
        const analyzedImages = new Map(current[studyType].analyzedImages);
        analyzedImages.set(file.name, event.target?.result as string);
        return {
          ...current,
          [studyType]: {
            ...current[studyType],
            files: [...current[studyType].files, file],
            previews,
            results,
            analyzedImages,
            uploadedFileNames: [...current[studyType].uploadedFileNames, file.name],
          },
        };
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImageFromStudy = (studyType: keyof Omit<ProfileState, "reports" | "conclusion">, fileName: string) => {
    setState((prev) => {
      const study = prev[studyType];
      const newFiles = study.files.filter((f) => f.name !== fileName);

      // CORRECCIÓN AQUÍ: Usar las variables 'new...'
      const newPreviews = new Map(study.previews);
      newPreviews.delete(fileName);

      const newResults = new Map(study.results);
      newResults.delete(fileName);

      const newAnalyzedImages = new Map(study.analyzedImages);
      newAnalyzedImages.delete(fileName);

      const newImageIds = new Map(study.imageIds);
      newImageIds.delete(fileName);

      const newUploadedFileNames = study.uploadedFileNames.filter((name) => name !== fileName);

      return {
        ...prev,
        [studyType]: {
          ...study,
          files: newFiles,
          previews: newPreviews,
          results: newResults,
          analyzedImages: newAnalyzedImages,
          imageIds: newImageIds,
          uploadedFileNames: newUploadedFileNames,
          isAnalyzed: false,
        },
      };
    });
  };

  const crearInformeParaPaciente = async (pacienteId: string, studyType?: string) => {
    if (!pacienteId || pacienteId === "new") {
      throw new Error("Cannot create a report without a valid patient.");
    }
    // Usar el tipo de estudio correcto (ki67 o her2) o un valor por defecto
    const tipoEstudio = studyType === "her2" ? "her2" : studyType === "ki67" ? "ki67" : "ki67";
    // Usar fecha actual en formato 'YYYY-MM-DD HH:MM:SS'
    const now = new Date();
    const fechaMuestra = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const body = { 
      paciente_id: pacienteId, 
      fecha_de_muestra: fechaMuestra, 
      tipo_estudio: tipoEstudio 
    };
    // ✅ apiFetch intercepta 401 globalmente → redirige al login automáticamente
    const res = await apiFetch(`${HOST}informe/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Could not create the report automatically.");
    }
    const data = await res.json();
    return data.informe.id;
  };

  const analyzeStudy = async (studyType: keyof Omit<ProfileState, "reports" | "conclusion">, pacienteId: string | null) => {
    if (!authToken) {
      return {
        success: false,
        message: "Authentication error: no token found. Please reload the page.",
      };
    }
    if (!pacienteId || pacienteId === "new" || pacienteId.trim() === "") {
      return {
        success: false,
        message: "Invalid patient. Please select the patient again.",
      };
    }

    let informeIdFinal = informeId;
    if (!informeIdFinal || informeIdFinal === "new" || typeof informeIdFinal !== "string" || informeIdFinal.trim() === "") {
      try {
        console.log("Invalid report. Creating new report…");
        informeIdFinal = await crearInformeParaPaciente(pacienteId, studyType);
        if (!informeIdFinal) throw new Error("Could not get a valid report ID.");
        setInformeId(informeIdFinal);
      } catch (error: any) {
        console.error(error);
        return {
          success: false,
          message: error?.message || "Could not create a report for this patient.",
        };
      }
    }

    const selectedFiles = state[studyType].files;
    setIsAnalyzing(true);

    try {
      const endpoint = studyType === "her2" ? `${HOST}upload-her2/` : `${HOST}upload/`;
      if (!informeIdFinal) throw new Error("Could not determine report ID.");

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("informe_id", informeIdFinal);
        formData.append("file", file);
        console.log(`📤 Subiendo ${file.name}...`);
        
        // ✅ apiFetch intercepta 401 globalmente → redirige al login automáticamente
        const uploadRes = await apiFetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body: formData,
        });
        if (!uploadRes.ok) throw new Error(`Error uploading ${file.name}`);
        const data = await uploadRes.json();

        // Polling
        if (data.task_id) {
          const taskId = data.task_id;
          console.log("⏳ Worker iniciado. Polling ID:", taskId);
          while (true) {
            await new Promise((r) => setTimeout(r, 3000));
            // ✅ apiFetch intercepta 401 globalmente
            let pollRes: Response;
            try {
              pollRes = await apiFetch(`${HOST}result/${taskId}`, { headers: { Authorization: `Bearer ${authToken}` } });
            } catch (e) {
              if (e instanceof SessionExpiredError) throw e; // re-lanzar para detener el loop
              break;
            }
            if (!pollRes.ok) continue;

            const pollData = await pollRes.json();
            if (pollData.status === "done") {
              console.log(`✅ Terminado: ${file.name}`);
              let resultadoIA = pollData.result?.resultado || pollData.resultado || pollData.output || pollData.data || pollData.result;
              if (resultadoIA?.resultado) resultadoIA = resultadoIA.resultado;

              if (!resultadoIA) { console.warn("No result found"); break; }

              let coords: Coordinate[] = [];
              if (resultadoIA.coordinates || resultadoIA.coordenadas) {
                const rawCoords = resultadoIA.coordinates || resultadoIA.coordenadas;
                if (Array.isArray(rawCoords)) {
                  coords = rawCoords.map((c: any) => ({
                    x: c.x, y: c.y, label: c.label ? c.label.toLowerCase() : undefined, minAxis: c.min_axis ?? c.minAxis ?? undefined,
                  }));
                }
              } else if (Array.isArray(resultadoIA.x_coords)) {
                coords = resultadoIA.x_coords.map((x: number, index: number) => ({
                  x, y: resultadoIA.y_coords[index], label: (resultadoIA.labels[index] as string).toLowerCase(),
                  minAxis: Array.isArray(resultadoIA.min_axis) ? resultadoIA.min_axis[index] : undefined,
                }));
              }
              if (coords.length > 0) updateStudyResult(studyType, file.name, "coordinates", coords);
              if (studyType === "her2") updateStudyResult(studyType, file.name, "rawApiResult", pollData);

              const processedImage = resultadoIA.processed_image || resultadoIA.imagen_procesada || resultadoIA.image || null;
              if (processedImage) {
                setState((prev) => {
                  const analyzedImages = new Map(prev[studyType].analyzedImages);
                  analyzedImages.set(file.name, processedImage);
                  return { ...prev, [studyType]: { ...prev[studyType], analyzedImages } };
                });
              }
              break;
            }
            if (pollData.status === "error") {
              console.error("❌ Error en worker:", pollData.error);
              const backendMessage =
                typeof pollData.error === "string"
                  ? pollData.error
                  : pollData.error?.detail ||
                    pollData.error?.message ||
                    JSON.stringify(pollData.error ?? {});
              throw new Error(backendMessage || "An error occurred while processing the images.");
            }
          }
          continue;
        }

        // Respuesta inmediata
        const resultadoIA = data.resultado || data.result || data.output || data.modelo_response?.resultado || null;
        if (resultadoIA) {
          let coords: Coordinate[] = [];
          if (resultadoIA.coordinates || resultadoIA.coordenadas) {
            let rawCoords = resultadoIA.coordinates || resultadoIA.coordenadas;
            if (Array.isArray(rawCoords)) {
                coords = rawCoords.map((coord: any) => ({
                  ...coord,
                  label: coord.label ? coord.label.toLowerCase() : coord.label
                }));
            }
          } else if (Array.isArray(resultadoIA.x_coords)) {
            coords = resultadoIA.x_coords.map((x: number, index: number) => ({
              x, y: resultadoIA.y_coords[index], label: (resultadoIA.labels[index] as string).toLowerCase(),
              minAxis: Array.isArray(resultadoIA.min_axis) ? resultadoIA.min_axis[index] : undefined,
            }));
          }
          if (coords.length > 0) updateStudyResult(studyType, file.name, "coordinates", coords);
          if (studyType === "her2") {
            updateStudyResult(studyType, file.name, "rawApiResult", {
              status: "done",
              result: data.result ?? { resultado: resultadoIA },
            });
          }
          if (resultadoIA.processed_image) {
            setState((prev) => {
              const analyzedImages = new Map(prev[studyType].analyzedImages);
              analyzedImages.set(file.name, resultadoIA.processed_image);
              return { ...prev, [studyType]: { ...prev[studyType], analyzedImages } };
            });
          }
        }
      }
      setState((prev) => ({ ...prev, [studyType]: { ...prev[studyType], isAnalyzed: true } }));
      return {
        success: true,
        message: "Analysis completed successfully!",
      };
    } catch (error: any) {
      // Si la sesión expiró, el interceptor ya redirigió. Salimos silenciosamente.
      if (error instanceof SessionExpiredError) {
        setIsAnalyzing(false);
        return null;
      }
      console.error("Analysis error:", error);
      return {
        success: false,
        message:
          (error?.message as string) ||
          "An error occurred during analysis. Please try again.",
      };
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateStudyResult = (
    studyType: keyof Omit<ProfileState, "reports" | "conclusion">,
    fileName: string,
    field: keyof AnalysisResult,
    value: string | Coordinate[] | number | unknown
  ) => {
    setState((prev) => {
      const study = prev[studyType];
      const results = new Map(study.results);
      let currentResult = results.get(fileName);

      if (!currentResult) {
        currentResult = {
          field: "", name: "", reportNumber: "", percentage: "", totalCells: "", positiveCells: "", negativeCells: "",
          iaPercentage: "", iaTotalCells: "", iaPositiveCells: "", iaNegativeCells: "", wrongPositiveCells: "", wrongNegativeCells: "",
          coordinates: [], minAxisFilter: 10, imagenId: "", preview: "",
        }
      };

      const updatedResult = { ...currentResult, [field]: value };

      if (field === "coordinates") {
        const coords = value as Coordinate[];
        const isFirstTimeFromModel = !currentResult.iaTotalCells || currentResult.iaTotalCells === "";
        const minAxisFilter = currentResult.minAxisFilter || 10;
        
        // 🔥 Lista FILTRADA para ambos cálculos
        const filteredCoords = coords.filter(c => c.minAxis === undefined || c.minAxis >= minAxisFilter);
        const total = filteredCoords.length;

        if (studyType === "her2") {
          const tincionAlta = filteredCoords.filter((c) => c.label === "tincion_alta").length;
          const noTincion = filteredCoords.filter((c) => c.label === "no_tincion").length;

          updatedResult.totalCells = total.toString();
          updatedResult.positiveCells = tincionAlta.toString();
          updatedResult.negativeCells = noTincion.toString();
          updatedResult.percentage = total > 0 ? `${Math.round((tincionAlta / total) * 100)}%` : "0%";

          if (isFirstTimeFromModel) {
            const iaTotal = filteredCoords.length;
            const iaTincionAlta = filteredCoords.filter((c) => c.label === "tincion_alta").length;
            const iaNoTincion = filteredCoords.filter((c) => c.label === "no_tincion").length;
            updatedResult.iaTotalCells = iaTotal.toString();
            updatedResult.iaPositiveCells = iaTincionAlta.toString();
            updatedResult.iaNegativeCells = iaNoTincion.toString();
            updatedResult.iaPercentage = iaTotal > 0 ? `${Math.round((iaTincionAlta / iaTotal) * 100)}%` : "0%";
          }
        } else {
          const positives = filteredCoords.filter((c) => (c.label || "").toLowerCase() === "positivo").length;
          const negatives = filteredCoords.filter((c) => (c.label || "").toLowerCase() === "negativo").length;

          updatedResult.totalCells = total.toString();
          updatedResult.positiveCells = positives.toString();
          updatedResult.negativeCells = negatives.toString();
          updatedResult.percentage = total > 0 ? `${Math.round((positives / total) * 100)}%` : "0%";

          if (isFirstTimeFromModel) {
            const iaTotal = filteredCoords.length;
            const iaPositives = filteredCoords.filter((c) => (c.label || "").toLowerCase() === "positivo").length;
            const iaNegatives = filteredCoords.filter((c) => (c.label || "").toLowerCase() === "negativo").length;
            updatedResult.iaTotalCells = iaTotal.toString();
            updatedResult.iaPositiveCells = iaPositives.toString();
            updatedResult.iaNegativeCells = iaNegatives.toString();
            updatedResult.iaPercentage = iaTotal > 0 ? `${Math.round((iaPositives / iaTotal) * 100)}%` : "0%";
          }
        }
      }

      if (field === "minAxisFilter") {
        const newMinAxis = value as number;
        updatedResult.minAxisFilter = newMinAxis;
        const coords = currentResult.coordinates || [];
        const filteredCoords = coords.filter(c => c.minAxis === undefined || c.minAxis >= newMinAxis);
        const total = filteredCoords.length;

        if (studyType === "her2") {
          const tincionAlta = filteredCoords.filter((c) => c.label === "tincion_alta").length;
          const noTincion = filteredCoords.filter((c) => c.label === "no_tincion").length;
          updatedResult.totalCells = total.toString();
          updatedResult.positiveCells = tincionAlta.toString();
          updatedResult.negativeCells = noTincion.toString();
          updatedResult.percentage = total > 0 ? `${Math.round((tincionAlta / total) * 100)}%` : "0%";
        } else {
          const positives = filteredCoords.filter((c) => (c.label || "").toLowerCase() === "positivo").length;
          const negatives = filteredCoords.filter((c) => (c.label || "").toLowerCase() === "negativo").length;
          updatedResult.totalCells = total.toString();
          updatedResult.positiveCells = positives.toString();
          updatedResult.negativeCells = negatives.toString();
          updatedResult.percentage = total > 0 ? `${Math.round((positives / total) * 100)}%` : "0%";
        }
      }

      results.set(fileName, updatedResult);
      return { ...prev, [studyType]: { ...study, results } };
    });
  };

  return (
    <ProfileContext.Provider value={{
        state, isAnalyzing, setIsAnalyzing, updateKi67, updateEstrogen, updateProgesterone, updateHer2,
        updateReports, updateReportField, updateConclusion, addImageToStudy, removeImageFromStudy,
        analyzeStudy, updateStudyResult, replaceImageInStudy,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within a ProfileProvider");
  return context;
}
