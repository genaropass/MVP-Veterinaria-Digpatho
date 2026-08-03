"use client";

import { EditableCanvasHandle } from "../canvas/editableCanvas";
import EditableCanvas from "../canvas/editableCanvas";
import ImageEditorModal from "../canvas/imageEditorModal";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import React from "react";
import { AnalysisResult } from "@/context/profile-context";
import { Coordinate } from "../canvas/types";
import { StudyType } from "./study-utils";
import { downloadHer2CoordinatesJson } from "./her2-utils";


interface Props {
  canvasRef: React.RefObject<EditableCanvasHandle | null>;
  imageSrc: string;
  coordinates: Coordinate[];
  fileName: string | null;
  result: AnalysisResult | null;
  studyType: StudyType;
  editingFileName: string | null;
  setEditingFileName: (name: string | null) => void;
  updateStudyResult: (
    studyType: StudyType,
    fileName: string,
    field: keyof AnalysisResult,
    value: unknown
  ) => void;
}

export default function ImageAnnotationPanel({
  canvasRef,
  imageSrc,
  coordinates,
  fileName,
  result,
  studyType,
  editingFileName,
  setEditingFileName,
  updateStudyResult,
}: Props) {
  return (
    <div className="flex flex-col gap-4 w-1/3">
      <div>
        <div 
          className="relative aspect-square border rounded overflow-hidden cursor-pointer"
          onClick={() => setEditingFileName(fileName)}
        >
          <EditableCanvas
            ref={canvasRef}
            imageSrc={imageSrc}
            coordinates={coordinates}
            onUpdateCoordinates={(updated) => {
              if (fileName) {
                updateStudyResult(studyType, fileName, "coordinates", updated);
              }
            }}
            action="pan"
            selectedLabel={studyType === "her2" ? ("moderada completa" as Coordinate["label"]) : ("positivo" as Coordinate["label"])}
            showPoints={true}
            zoom={1}
            readOnly={true}
            studyType={studyType}
          />
        </div>

        <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => canvasRef.current?.download()}>
          <Download className="h-4 w-4 mr-2" />
          Descargar
        </Button>

        {studyType === "her2" && !!result?.rawApiResult && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={() => downloadHer2CoordinatesJson(result.rawApiResult, fileName || "her2")}
          >
            <Download className="h-4 w-4 mr-2" />
            Descargar coordenadas
          </Button>
        )}

        <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setEditingFileName(fileName)}>
          Corregir anotación
        </Button>

        {editingFileName && result && (
          <ImageEditorModal
            open={!!editingFileName}
            onOpenChange={() => setEditingFileName(null)}
            imageSrc={imageSrc}
            coordinates={result.coordinates || []}
            initialMinAxis={result.minAxisFilter || 10}
            studyType={studyType}
            onSave={(updatedCoords) => {
              console.log("🖼️ Modal guardando coordenadas completas:", {
                fileName: editingFileName,
                coordenadas: updatedCoords.length,
                studyType
              });
              updateStudyResult(studyType, editingFileName, "coordinates", updatedCoords);
              setEditingFileName(null);
            }}
            onUpdateMinAxis={(minAxis) => {
              console.log("🎚️ Modal actualizando minAxis:", {
                fileName: editingFileName,
                minAxis,
                studyType
              });
              updateStudyResult(studyType, editingFileName, "minAxisFilter", minAxis);
            }}
          />
        )}
      </div>
    </div>
  );
}

