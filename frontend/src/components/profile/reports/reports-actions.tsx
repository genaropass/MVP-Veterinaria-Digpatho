'use client';

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import generarPDF from "@/lib/pdfService";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Props {
  onSend: () => void;
  informeGenerado: boolean;
  isGenerating: boolean;
  pacienteId: string | null;
  informeId: string | null;
}

export const ReportActions = ({
  onSend,
  informeGenerado,
  isGenerating,
  pacienteId,
  informeId
}: Props) => {
  const t = useTranslations("report");
  const { data: session } = useSession();

  return (
    <div className="flex justify-end gap-4">

      <Button
        onClick={onSend}
        className="bg-secondary text-black dark:bg-secondary-dark dark:text-white"
        disabled={isGenerating}
      >
        {isGenerating ? "Generating..." : t("generate-report")}
      </Button>

      <Button
        onClick={async () => {
          if (!pacienteId || !informeId || informeId === "new") {
            toast.error("Please select a valid report");
            return;
          }
          
          const authToken = (session as any)?.accessToken;
          if (!authToken) {
            toast.error("Authentication error. Please sign in again.");
            return;
          }
          
          try {
            await generarPDF(pacienteId as string, informeId as string, authToken);
          } catch (error) {
            console.error("Error al generar PDF:", error);
            toast.error("Error al generar el PDF");
          }
        }}

        disabled={!informeGenerado}
        className="bg-primary text-white dark:bg-primary-dark"
      >
        <Download className="mr-2 h-4 w-4" />
        {t("view-pdf")}
      </Button>

    </div>
  );
};
