/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PencilIcon } from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { usePatient } from "@/context/patient-context";
import { API_TOKEN } from "@/utils/constants";
import {
  calcularPromedioPorcentaje,
  obtenerValorMasFrecuente,
} from "./reports-utils";
import { ReportActions } from "./reports-actions";
import { ReportsConclusion } from "./reports-conclusion";
import { ReportSection } from "./reports-section";
import { enviarInforme } from "@/services/reportsService";
import { sendEmail } from "@/services/mailService";
import { generarContenidoEmail } from "./reports-utils";
import { toast } from "sonner";
//import { auth } from "@/lib/auth";

export function ReportsForm({ userEmail }: { userEmail: string | null }) {
  const { state, updateReportField, updateConclusion } = useProfile();
  const { conclusion } = state;
  const { pacienteId } = usePatient();
  const { informeId } = usePatient();
  const [informeGenerado, setInformeGenerado] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: session } = useSession();
  const rawToken = (session as { accessToken?: string })?.accessToken;
  const isValidJWT =
    rawToken && typeof rawToken === "string" && rawToken.split(".").length === 3;
  const authToken = isValidJWT ? rawToken : API_TOKEN;
  //const { pacienteId, informeId } = usePatient();
  const t = useTranslations("report");
  useEffect(() => {
    if (state.ki67.results) {
      const resultsArray = Array.from(state.ki67.results?.values?.());
      const promedio = calcularPromedioPorcentaje(resultsArray);

      if (promedio !== "0") {
        updateReportField("ki67", "result", `${promedio}%`);
      }
    }
    
    if (state.estrogen.results) {
      const estrogenResults = Array.from(state.estrogen.results?.values?.());
      const estrogenPercentage = calcularPromedioPorcentaje(estrogenResults);
      const estrogenIntensity = obtenerValorMasFrecuente(estrogenResults, "intensity");
      const estrogenInterpretation = obtenerValorMasFrecuente(estrogenResults, "interpretation");

      updateReportField("estrogen", "positivePercentage", `${estrogenPercentage}%`);
      updateReportField("estrogen", "stainingIntensity", estrogenIntensity);
      updateReportField("estrogen", "interpretation", estrogenInterpretation);
    }
    
    if (state.progesterone.results) {
      const progesteroneResults = Array.from(state.progesterone.results?.values?.() || []);
      const progesteronePercentage = calcularPromedioPorcentaje(progesteroneResults);
      const progesteroneIntensity = obtenerValorMasFrecuente(progesteroneResults, "intensity");
      const progesteroneInterpretation = obtenerValorMasFrecuente(progesteroneResults, "interpretation");

      updateReportField("progesterone", "positivePercentage", `${progesteronePercentage}%`);
      updateReportField("progesterone", "stainingIntensity", progesteroneIntensity);
      updateReportField("progesterone", "interpretation", progesteroneInterpretation);
    }
    
    if (state.her2.results) {
      const her2Results = Array.from(state.her2.results?.values?.() || []);
      const her2Percentage = calcularPromedioPorcentaje(her2Results);
      const her2Interpretation = obtenerValorMasFrecuente(her2Results, "interpretation");

      updateReportField("her2", "positivePercentage", `${her2Percentage}%`);
      updateReportField("her2", "interpretation", her2Interpretation);
    }
}, [
    state.ki67.results,
    state.estrogen.results,
    state.progesterone.results,
    state.her2.results,
]);

  const handleConclusionChange = (value: string) => {
    updateConclusion(value);
  };

  const handleEnviarInforme = async () => {
    setIsGenerating(true);
    const { subject, body } = generarContenidoEmail(state.reports, state.conclusion, t);

    try {
      if (!informeId) {
        toast.error(t("toasts.error"));
        return;
      }
      await enviarInforme(informeId, body, authToken);
      if (userEmail) {
        await sendEmail({
          email: userEmail,
          subject,
          body
        });
      }
      setIsGenerating(false);
      setInformeGenerado(true);
      toast.success(t("toasts.success"));
    } catch (error) {
      console.error(error);
      toast.error(t("toasts.error"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-primary dark:text-primary-dark">
        <PencilIcon className="h-5 w-5" />
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </div>
      <ReportSection marker="ki67" />
      <ReportSection marker="estrogen" />
      <ReportSection marker="progesterone" />
      <ReportSection marker="her2" />
      <ReportsConclusion 
        value={conclusion} 
        onChange={handleConclusionChange}
      />
      <ReportActions 
        onSend={handleEnviarInforme} 
        informeGenerado={informeGenerado} 
        isGenerating={isGenerating}
        pacienteId={pacienteId} 
        informeId={informeId}
      />
    </div>
  );
}
