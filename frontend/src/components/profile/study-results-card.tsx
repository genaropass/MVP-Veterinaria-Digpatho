"use client";

import ResultsTabs from "./results-tabs";
import ImageAnnotationPanel from "./image-panel";
import AnalysisFieldsSummary from "./analysis-summary";
import HER2Statistics from "./her2-statistics";
import HER2Legend from "./her2-legend";
import { StudyData, AnalysisResult } from "@/context/profile-context";
import { StudyType } from "./study-utils";
import { EditableCanvasHandle } from "../canvas/editableCanvas";
import { Card, CardContent } from "../ui/card";

interface Props {
  study: StudyData;
  studyType: StudyType;
  activeTab: number | null;
  setActiveTab: (index: number) => void;
  canvasRef: React.RefObject<EditableCanvasHandle | null>;
  activeResult: AnalysisResult | null;
  editingFileName: string | null;
  setEditingFileName: (name: string | null) => void;
  updateStudyResult: (
    studyType: StudyType,
    fileName: string,
    field: keyof AnalysisResult,
    value: unknown
  ) => void;
}

export default function StudyAnalysisResultsCard({ study, studyType, activeTab, setActiveTab, canvasRef, activeResult, editingFileName, setEditingFileName, updateStudyResult,
}: Props) {
  const activeFile = activeTab !== null ? study.files[activeTab] : null;
  let imageSrc = "/placeholder.svg";
  if (activeFile) {
    // ✅ Priorizar SIEMPRE la imagen recortada (preview)
    imageSrc =
      study.previews.get(activeFile.name) ??
      study.analyzedImages.get(activeFile.name) ??
      "/placeholder.svg";
  }



  return (
    <Card className="bg-white border border-gray-200">
      <CardContent className="p-6">
        <h3 className="font-semibold mb-4">Resultados del análisis</h3>

      <div className="mb-4 text-sm">
        {study.isAnalyzed ? (
          <p className="text-green-600">¡Todas las imágenes han sido analizadas!</p>
        ) : (
          <p className="text-blue-600">
            Análisis en progreso...{" "}
            {
              Array.from(study.results.values()).filter((r) => r !== null).length
            }
            /{study.files.length} imágenes procesadas
          </p>
        )}
      </div>

      <ResultsTabs files={study.files} results={study.results} activeTab={activeTab} setActiveTab={setActiveTab}/>

      {activeFile && activeResult && (
        <>
          {studyType === "her2" && (
            <div className="mt-4 mb-6">
              <HER2Legend />
            </div>
          )}
          
          <div className="mt-4 flex flex-row gap-6">
            <ImageAnnotationPanel
              canvasRef={canvasRef}
              imageSrc={imageSrc}
              coordinates={activeResult?.coordinates || []}
              fileName={activeFile?.name}
              result={activeResult}
              studyType={studyType}
              editingFileName={editingFileName}
              setEditingFileName={setEditingFileName}
              updateStudyResult={updateStudyResult}
            />

            {studyType === "her2" ? (
              <div className="flex-1">
                <HER2Statistics result={activeResult} />
              </div>
            ) : (
              <AnalysisFieldsSummary result={activeResult} isAnalyzed={study.isAnalyzed} />
            )}
          </div>
        </>
      )}
      </CardContent>
      
    </Card>
  );
}