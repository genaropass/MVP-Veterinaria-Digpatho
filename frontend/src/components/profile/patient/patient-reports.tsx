'use-client';

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePatient } from "@/context/patient-context";
import generarPDF from "@/lib/pdfService";
import { Download, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Informe = {
  id: string;
  fecha_de_muestra: string;
  tipo_estudio: string;
  pacienteId: string;
  promedio_rta_img: string;
};

interface PatientReportsProps {
  informesPaciente: Informe[];
  onDeleteInforme: (informeId: string) => Promise<void>;
}

export const PatientReports = ({ informesPaciente, onDeleteInforme }: PatientReportsProps) => {
    const t = useTranslations("PatientInfoCard");
    const { setInformeId, pacienteId, informeId } = usePatient();
    const { data: session } = useSession();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [informeToDelete, setInformeToDelete] = useState<string | null>(null);

    if (!informesPaciente || informesPaciente.length === 0) {
        return <p>No hay informes disponibles.</p>;
    }

    const handleDeleteClick = () => {
        if (!informeId || informeId === "new") {
            toast.warning("Por favor, seleccione un informe para eliminar.");
            return;
        }
        setInformeToDelete(informeId);
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = async () => {
        if (!informeToDelete) return;
        
        setIsDeleting(true);
        try {
            await onDeleteInforme(informeToDelete);
            setShowDeleteDialog(false);
            setInformeToDelete(null);
        } catch (error) {
            console.error("Error al eliminar informe:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="border-t pt-4 mt-4 border-gray-200 dark:border-gray-700">
            <Label
                htmlFor="case"
                className="text-sm font-medium text-gray-700 dark:text-gray-200"
            >
            {t("paste-reports")}
            </Label>
            <Select
            onValueChange={(value) => {
                if (!pacienteId) {
                    toast.error("Primero seleccione un paciente.");
                    return;
                }
                if (value === "new") {
                    setInformeId("new");
                } else {
                    setInformeId(value);
                }
            }}
            >

            <SelectTrigger
                id="case"
                className="mt-1 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            >
                <SelectValue placeholder={t("placeholder.report-number")} />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-900 dark:text-gray-100">
                <SelectItem value="new">{t("create-report")}</SelectItem>
                {informesPaciente.map((informe, i) => (
                <SelectItem key={informe.id} value={informe.id}>
                    {`Informe ${i + 1} - ${
                    informe.tipo_estudio
                    } - ${informe.fecha_de_muestra
                    .slice(0, 10)
                    .split("-")
                    .reverse()
                    .join("/")}`}
                </SelectItem>
                ))}
            </SelectContent>
            </Select>

            <div className="flex justify-end gap-2 mt-3">
            <Button
                type="button"
                onClick={handleDeleteClick}
                disabled={!informeId || informeId === "new" || isDeleting}
                variant="destructive"
                className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
            </Button>
            <Button
                type="button"
                onClick={async () => {
                if (
                    pacienteId &&                       // pacienteId válido
                    informeId &&                        // no null
                    informeId !== "new"                 // no "nuevo"
                ) {
                    const authToken = (session as any)?.accessToken;
                    if (!authToken) {
                        toast.error("Authentication error. Please sign in again.");
                        return;
                    }
                    
                    try {
                        await generarPDF(pacienteId, informeId, authToken);
                    } catch (error) {
                        console.error("Error generating PDF:", error);
                        toast.error("Error generating PDF");
                    }
                } else {
                    toast.warning(t("toasts.report-warning"));
                }
            }}

                disabled={!informeId || informeId === "new"}
                className="bg-primary text-white dark:bg-primary dark:text-white"
            >
                <Download className="mr-2 h-4 w-4" />
                {t("download-report")}
            </Button>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The selected report will be permanently deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
