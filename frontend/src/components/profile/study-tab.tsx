"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AnalysisResult, useProfile } from "@/context/profile-context";
import { Send, ImageIcon, X } from "lucide-react";
import { EditableCanvasHandle } from "../canvas/editableCanvas";;
import { usePatient } from "@/context/patient-context";
import { handleFileChange, handleDrop, handleDragOver, handleAnalyze} from "./study-utils";
import SendAnalysisEmail from "./send-analysis-email";
import StudyAnalysisResultsCard from "./study-results-card";
import { useTranslations } from "next-intl";

interface StudyTabProps {
  studyType: "ki67" | "estrogen" | "progesterone" | "her2";
  onUpload?: (file: File) => Promise<unknown>;
}

export function StudyTab({ studyType }: StudyTabProps) {
  const t = useTranslations("studyTab");
  const { state, removeImageFromStudy, analyzeStudy, updateStudyResult, addImageToStudy } = useProfile();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const study = state[studyType];
  const { pacienteId } = usePatient();
  const canvasRef = useRef<EditableCanvasHandle | null>(null);

const activeFile = activeTab !== null ? study.files[activeTab] : undefined;
const activeFileName = activeFile?.name;
const activeResult: AnalysisResult | null = activeFileName ? study.results.get(activeFileName) ?? null : null;


  // Set active tab to first available result when results change
  useEffect(() => {
    if (activeTab === null && study.files.length > 0) {
      const firstResultIndex = study.files.findIndex(
        (file) => study.results.get(file.name) !== null
      );
      if (firstResultIndex !== -1) {
        setActiveTab(firstResultIndex);
      }
    }
  }, [study.results, study.files, activeTab]);

  const onAnalyzeClick = async() => {
    setIsAnalyzing(true);
    setShowConfirmation(true);
    await handleAnalyze(study, studyType, pacienteId, setIsAnalyzing, analyzeStudy, t("min-images-required"));
    setIsAnalyzing(false);
  }


  return (
    <div className="space-y-6">
      {/* Image Upload Section */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-6">
          <div className="space-y-6">
            <h3 className="font-medium">
              {t("upload-file")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from(study.previews.entries()).map(
                ([name, preview], index) => (
                  <div key={name} className="relative w-24 h-24 border rounded overflow-hidden">
                    {/* Image */}
                    <Image src={preview || "/placeholder.svg"} alt={`Preview ${index + 1}`} fill className="object-cover"/>

                    {/* Delete Button */}
                    <button onClick={() => removeImageFromStudy(studyType, name)}
                      className="absolute top-1 right-1 flex items-center justify-center w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )
              )}

              {study.files.length < 5 && (
                <div className="relative aspect-square border-2 border-dashed rounded flex items-center justify-center" onDrop={(e) => handleDrop(e, studyType, addImageToStudy)} onDragOver={handleDragOver}
                >
                  <input type="file" id={`fileInput-${studyType}`} className="hidden" accept="image/*" multiple
                    onChange={(e) => handleFileChange(e, studyType, addImageToStudy)}
                  />
                  <label htmlFor={`fileInput-${studyType}`} className="cursor-pointer text-center p-4">
                    <ImageIcon className="mx-auto h-6 w-6 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">
                      {t("image-placeholder")}{" "}
                      {study.files.length + 1}/5
                    </p>
                  </label>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" className="bg-primary text-white" 
                onClick={onAnalyzeClick}
                disabled={study.files.length < 5 || isAnalyzing}>
                <Send className="mr-2 h-4 w-4" />
                {isAnalyzing ? t("analysing-images") : t("analyse-images")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results - Show as soon as at least one result is available */}
   
      {/* Mensaje de confirmación tras enviar imágenes */}
      {showConfirmation && !study.isAnalyzed && (
        <div className="mb-4 text-sm text-blue-700 bg-blue-100 p-2 rounded">
          {t("analysis-in-progress")} {" "}
          {Array.from(study.results.values()).filter((r) => r !== null).length}
          /{study.files.length}
        </div>
      )}

        {/* Resultados y email solo si el análisis está completo */}
      {study.isAnalyzed && (
        <>
          <StudyAnalysisResultsCard
            study={study}
            studyType={studyType}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            activeResult={activeResult}
            canvasRef={canvasRef}
            updateStudyResult={updateStudyResult}
            editingFileName={editingFileName}
            setEditingFileName={setEditingFileName}
          />
          <div className="mb-4 text-sm">
            <p className="text-green-600">
              {t("analysis-complete")}
            </p>
            <SendAnalysisEmail />
          </div>
        </>
      )}
    </div>
  );
}