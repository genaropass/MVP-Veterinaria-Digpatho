// utils/cropImage.ts
export async function getCroppedFileFromDataUrl(
  imageSrc: string,
  cropPixels: { x: number; y: number; width: number; height: number },
  fileName: string
): Promise<File> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((res) => (image.onload = res));

  const canvas = document.createElement("canvas");
  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error("No se pudo generar el recorte");
      const file = new File([blob], fileName, { type: "image/jpeg" });
      resolve(file);
    }, "image/jpeg");
  });
}
