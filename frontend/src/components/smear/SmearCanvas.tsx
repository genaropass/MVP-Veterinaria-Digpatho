import React, { useRef, useEffect } from 'react';

interface BBox {
  id: number;
  tipo: string;
  bbox: [number, number, number, number]; // xmin, ymin, xmax, ymax
  color: string;
}

interface SmearCanvasProps {
  imageSrc: string;
  bboxes: BBox[];
  originalWidth: number;
  originalHeight: number;
}

export default function SmearCanvas({ imageSrc, bboxes, originalWidth, originalHeight }: SmearCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      // Ajustar tamaño del canvas al contenedor manteniendo aspect ratio
      const containerWidth = container.clientWidth;
      const scale = containerWidth / originalWidth;
      const canvasHeight = originalHeight * scale;

      canvas.width = originalWidth;
      canvas.height = originalHeight;
      
      // Estilo CSS para que ocupe el ancho pero se vea nítido
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.maxHeight = '500px';
      canvas.style.objectFit = 'contain';

      // Dibujar imagen original
      ctx.drawImage(img, 0, 0, originalWidth, originalHeight);

      // Dibujar bounding boxes
      bboxes.forEach(box => {
        const [xmin, ymin, xmax, ymax] = box.bbox;
        const width = xmax - xmin;
        const height = ymax - ymin;

        ctx.strokeStyle = box.color;
        ctx.lineWidth = Math.max(2, originalWidth / 400); // Grosor relativo al tamaño de la imagen
        ctx.strokeRect(xmin, ymin, width, height);

        // Etiqueta
        ctx.fillStyle = box.color;
        ctx.font = `${Math.max(12, originalWidth / 60)}px Arial`;
        ctx.fillText(box.tipo, xmin, ymin > 20 ? ymin - 5 : ymin + 15);
      });
    };
  }, [imageSrc, bboxes, originalWidth, originalHeight]);

  return (
    <div ref={containerRef} className="w-full relative bg-black/5 rounded-lg overflow-hidden flex justify-center items-center">
      <canvas ref={canvasRef} className="rounded-lg shadow-sm" />
    </div>
  );
}
