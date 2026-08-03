"use client";

import { useState } from "react";
import { useProfile } from "@/context/profile-context";
import type { ProfileState } from "@/context/profile-context";
// 👇 usa el nombre que le pusiste a tu modal, y el path correcto
import { ImageCropModal } from "@/components/imageCropModal"; 

// Todas las keys de estudios, sin reports ni conclusion
type StudyKey = keyof Omit<ProfileState, "reports" | "conclusion">;

interface StudyImagesGridProps {
  studyType: StudyKey; // "ki67" | "estrogen" | "progesterone" | "her2"
}

export function StudyImagesGrid({ studyType }: StudyImagesGridProps) {
  const {
    state,
    removeImageFromStudy,
    replaceImageInStudy, // ✅ esto ya lo agregaste al Provider
  } = useProfile();

  const study = state[studyType];

  // Estado para el modal de recorte
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState<string>("");

  // Cuando apretás ✂️ en una imagen
  const handleOpenCrop = (fileName: string) => {
    const preview = study.previews.get(fileName);
    if (!preview) {
      console.warn("No preview found for", fileName);
      return;
    }
    setCropFileName(fileName);
    setCropImageSrc(preview);
    setCropOpen(true);
  };

  // Cuando el modal termina de recortar y devuelve un File nuevo
  const handleCropped = (newFile: File) => {
    // Reemplaza en el contexto el File original por el recortado
    replaceImageInStudy(studyType, cropFileName, newFile);
  };

  return (
    <>
      {/* Grilla de imágenes */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {study.files.map((file) => {
          const preview = study.previews.get(file.name);

          return (
            <div
              key={file.name}
              className="relative rounded-md overflow-hidden border border-gray-200 bg-gray-50"
            >
              {preview && (
                <img
                  src={preview}
                  alt={file.name}
                  className="w-full h-40 object-cover"
                />
              )}

              {/* ❌ Botón borrar que ya tenías o similar */}
              <button
                type="button"
                onClick={() => removeImageFromStudy(studyType, file.name)}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs shadow-md"
              >
                ✕
              </button>

              {/* ✂️ NUEVO botón RECORTAR - esquina superior izquierda */}
              <button
                type="button"
                onClick={() => handleOpenCrop(file.name)}
                className="absolute top-1 left-1 bg-white/90 text-gray-800 rounded-full px-2 py-1 text-xs shadow-md hover:bg-white"
              >
                ✂️ Recortar
              </button>

              <div className="px-2 py-1 text-[11px] text-gray-600 truncate">
                {file.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de recorte */}
      <ImageCropModal
        open={cropOpen}
        imageSrc={cropImageSrc!}
        studyType={studyType}
        fileName={cropFileName!}
        onClose={() => setCropOpen(false)}
        />

    </>
  );
}
