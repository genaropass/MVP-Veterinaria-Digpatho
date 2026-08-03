// components/ImageCropModal.tsx
"use client";

import { useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { getCroppedFileFromDataUrl } from "@/utils/cropImage";
import { useProfile } from "@/context/profile-context";

interface ImageCropModalProps {
  open: boolean;
  onClose: () => void;
  studyType: keyof Omit<
    import("@/context/profile-context").ProfileState,
    "reports" | "conclusion"
  >;
  fileName: string;
  imageSrc: string; // dataURL of the current image
}

export function ImageCropModal({
  open,
  onClose,
  studyType,
  fileName,
  imageSrc,
}: ImageCropModalProps) {
  const { replaceImageInStudy } = useProfile();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!open || !imageSrc) return null;

  const onCropComplete = (_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsSaving(true);
    try {
      const newFile = await getCroppedFileFromDataUrl(
        imageSrc,
        {
          x: Math.round(croppedAreaPixels.x),
          y: Math.round(croppedAreaPixels.y),
          width: Math.round(croppedAreaPixels.width),
          height: Math.round(croppedAreaPixels.height),
        },
        fileName
      );

      // Preview is generated in the context
      replaceImageInStudy(studyType, fileName, newFile);

      setIsSaving(false);
      onClose();
    } catch (err) {
      console.error("Error cropping image", err);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-xl w-[90vw] max-w-3xl h-[80vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <h2 className="font-semibold text-lg">Crop image</h2>
          <button onClick={onClose} className="text-sm text-gray-500">
            Close
          </button>
        </div>

        <div className="flex-1 relative bg-black">
          <Cropper
            image={imageSrc}          // ✅ usamos imageSrc
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-4 py-3 border-t flex justify-between items-center gap-4">
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
          />
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Apply crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
