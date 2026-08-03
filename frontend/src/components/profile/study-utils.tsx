import { ChangeEvent, DragEvent } from "react";
import { ProfileContextType, StudyData } from "@/context/profile-context";
import { Input } from "../ui/input";
export type StudyType = "ki67" | "estrogen" | "progesterone" | "her2";
interface FieldProps { label: string; value: string; color?: string;} 

export function Field({label, value, color = ""}: FieldProps){
    return (
    <div>
      <label className={`block font-medium mb-1 ${color}`}>{label}</label>
      <Input readOnly value={value} />
    </div>
  );
}

export function handleFileChange(
  e: ChangeEvent<HTMLInputElement>,
  studyType: StudyType,
  addImageToStudy: ProfileContextType["addImageToStudy"]
) {
  if (e.target.files) {
    Array.from(e.target.files).forEach((file) => {
      addImageToStudy(studyType, file);
    })
  }
}

export function handleDrop( e: DragEvent<HTMLDivElement>, studyType: StudyType,
  addImageToStudy: ProfileContextType["addImageToStudy"]	
) {
  e.preventDefault();
  Array.from(e.dataTransfer.files).forEach((file) => {
    if (file.type.startsWith("image/")) {
      addImageToStudy(studyType, file)}})
}

export function handleDragOver(e: DragEvent<HTMLDivElement>) {
  e.preventDefault();
}
  
export async function handleAnalyze(
  study: StudyData,
  studyType: StudyType,
  pacienteId: string | null,
  setIsAnalyzing: (value: boolean) => void,
  analyzeStudy: ProfileContextType["analyzeStudy"],
  minImagesMessage?: string
) {
  if (study.files.length < 5) {
    if (minImagesMessage) alert(minImagesMessage);
    return;
  }
  setIsAnalyzing(true);
  await analyzeStudy(studyType, pacienteId);
}

