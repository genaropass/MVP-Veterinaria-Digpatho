"use client";

import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { isPointInPolygon, Point } from '../../utils/geometry';
import { Coordinate } from "./types";
import { parsearLabelHer2 } from "../profile/her2-utils";

export interface EditableCanvasHandle {
  download: () => void;
  resetView: () => void;
  setContrast: (contrast: number) => void;
}

interface EditableCanvasProps {
  imageSrc: string;
  coordinates: Coordinate[];
  onUpdateCoordinates: (updatedCoords: Coordinate[]) => void;
  action: "add" | "remove" | "pan" | "select_area";
  selectedLabel: string;
  showPoints: boolean;
  zoom: number;
  readOnly?: boolean;
  style?: React.CSSProperties;
  showControls?: boolean;
  coordinateFilter?: (coord: Coordinate) => boolean;
  studyType?: "ki67" | "estrogen" | "progesterone" | "her2";
}

// Colores base para Ki67 / tejido no tumoral
const BASE_COLORS: Record<string, string> = {
  positivo: "red",
  negativo: "lime",
  tejido_no_tumoral: "cyan",
};

// Colores HER2
const HER2_COLORS: Record<string, string> = {
  no_tincion: "#0000FF",
  baja: "#FFFF00",
  moderada: "#FFA500",
  alta: "#FF0000",
  na: "#808080",
};

function getDotColor(label: string | undefined): string {
  if (!label) return "black";

  const normalized = label.toString().trim().toLowerCase();

  // 1. Etiquetas clasicas de Ki67
  if (normalized in BASE_COLORS) {
    return BASE_COLORS[normalized];
  }

  // 2. Si parece un label HER2, usamos el parser compartido
  const { categoria } = parsearLabelHer2(label);
  if (categoria in HER2_COLORS) {
    return HER2_COLORS[categoria];
  }

  // 3. Fallback
  return "black";
}

const EditableCanvas = forwardRef<EditableCanvasHandle, EditableCanvasProps>(
  (
    {
      imageSrc,
      coordinates,
      onUpdateCoordinates,
      action,
      selectedLabel,
      showPoints,
      zoom,
      readOnly,
      style,
      coordinateFilter,
      studyType,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Estados principales
    const [dots, setDots] = useState<Coordinate[]>(coordinates);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [contrast, setContrast] = useState<number>(100);

    // ESTADOS PARA LAZO Y MENU
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionPath, setSelectionPath] = useState<Point[]>([]);
    const [menuPos, setMenuPos] = useState<{x: number, y: number} | null>(null);

    // Estados de imagen y pan
    const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef<{ x: number; y: number } | null>(null);

    // Zoom interno para permitir zoom con rueda del mouse
    const [internalZoom, setInternalZoom] = useState(zoom);

    const initialState = useRef({
      offset: { x: 0, y: 0 },
      contrast: 100,
      zoom: zoom,
    });
    const hasInitializedView = useRef(false);

    useEffect(() => {
      setDots(coordinates);
    }, [coordinates]);

    // Sincronizar zoom del padre con el interno
    useEffect(() => {
      setInternalZoom(zoom);
    }, [zoom]);

    useEffect(() => {
      if (imageSrc) {
        const img = new Image();
        img.onload = () => {
          setImageDimensions({ width: img.width, height: img.height });
          hasInitializedView.current = false;
        };
        img.src = imageSrc;
      }
    }, [imageSrc]);

    // Centrar imagen en el canvas en la primera carga
    useEffect(() => {
      if (!imageDimensions || !canvasRef.current || hasInitializedView.current) return;

      const canvas = canvasRef.current;
      const renderedWidth = imageDimensions.width * internalZoom;
      const renderedHeight = imageDimensions.height * internalZoom;

      const centeredOffset = {
        x: (canvas.width - renderedWidth) / 2,
        y: (canvas.height - renderedHeight) / 2,
      };

      setOffset(centeredOffset);
      initialState.current.offset = centeredOffset;
      initialState.current.zoom = internalZoom;
      hasInitializedView.current = true;
    }, [imageDimensions, internalZoom]);

    // Redibujar
    useEffect(() => {
      drawCanvas();
    }, [dots, imageSrc, showPoints, internalZoom, offset, contrast, coordinateFilter, selectionPath]);

    const drawCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.src = imageSrc;

      const draw = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Dibujar Imagen
        ctx.filter = `contrast(${contrast}%)`;
        ctx.setTransform(internalZoom, 0, 0, internalZoom, offset.x, offset.y);
        ctx.drawImage(img, 0, 0, img.width, img.height);
        ctx.filter = 'none';

        // 2. Dibujar Puntos
        if (showPoints) {
          dots.forEach((coord) => {
            if (coordinateFilter && !coordinateFilter(coord)) {
              return;
            }
            const { x, y, label } = coord;
            const color = getDotColor(label);
            ctx.beginPath();
            ctx.arc(x, y, 6 / internalZoom, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1 / internalZoom;
            ctx.stroke();
          });
        }

        // 3. Dibujar Lazo
        if (selectionPath.length > 0) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.beginPath();
          ctx.moveTo(selectionPath[0].x, selectionPath[0].y);
          for (let i = 1; i < selectionPath.length; i++) {
            ctx.lineTo(selectionPath[i].x, selectionPath[i].y);
          }
          ctx.closePath();

          ctx.fillStyle = "rgba(0, 123, 255, 0.2)";
          ctx.strokeStyle = "#007bff";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
        }
      };

      if (img.complete) draw();
      else img.onload = draw;
    };

    const resetView = () => {
      setOffset(initialState.current.offset);
      setContrast(initialState.current.contrast);
      setInternalZoom(initialState.current.zoom);
    };

    const handleContrastChange = (newContrast: number) => {
      setContrast(newContrast);
    };

    useImperativeHandle(ref, () => ({
      download: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const url = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = url;
        link.download = "analyzed-image.png";
        link.click();
      },
      resetView,
      setContrast: handleContrastChange,
    }));

    // --- MANEJO DE MOUSE ---

    const getCursorStyle = () => {
      if (isPanning) return "grabbing";
      switch (action) {
        case "add": return "crosshair";
        case "remove": return "pointer";
        case "select_area": return "crosshair";
        case "pan": return "grab";
        default: return "pointer";
      }
    };

    const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (readOnly) return;

      // Si hacemos clic fuera del menu, cerramos el menu y limpiamos seleccion
      if (menuPos) {
        setMenuPos(null);
        setSelectionPath([]);
        drawCanvas();
        return;
      }

      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (event.clientX - rect.left) * scaleX;
      const mouseY = (event.clientY - rect.top) * scaleY;

      // Pan con click derecho (button=2), middle click (button=1), o modo pan
      if (event.button === 2 || event.button === 1 || (event.button === 0 && action === "pan")) {
        panStart.current = { x: mouseX, y: mouseY };
        setIsPanning(true);
        return;
      }

      // INICIO LAZO
      if (event.button === 0 && action === "select_area") {
        setIsSelecting(true);
        setSelectionPath([{ x: mouseX, y: mouseY }]);
        return;
      }

      // Logica de Add/Remove individual
      const getClickedDotIndex = () => {
        return dots.findIndex((coord) => {
          if (coordinateFilter && !coordinateFilter(coord)) return false;
          const { x, y } = coord;
          const imgX = (mouseX - offset.x) / internalZoom;
          const imgY = (mouseY - offset.y) / internalZoom;
          return Math.hypot(imgX - x, imgY - y) < 8 / internalZoom;
        });
      };

      const clickedIndex = getClickedDotIndex();

      if (event.button === 0) {
        if (clickedIndex !== -1 && action === "remove") {
          const newDots = dots.filter((_, i) => i !== clickedIndex);
          setDots(newDots);
          onUpdateCoordinates(newDots);
        } else if (action === "add" && clickedIndex === -1) {
          const newDot: Coordinate = {
            x: (mouseX - offset.x) / internalZoom,
            y: (mouseY - offset.y) / internalZoom,
            label: selectedLabel,
          };
          const updated = [...dots, newDot];
          setDots(updated);
          onUpdateCoordinates(updated);
        } else if (clickedIndex !== -1 && action === "add") {
          setDraggingIndex(clickedIndex);
        }
      }
    };

    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (event.clientX - rect.left) * scaleX;
      const mouseY = (event.clientY - rect.top) * scaleY;

      // Pan libre sin limites
      if (isPanning && panStart.current) {
        const dx = mouseX - panStart.current.x;
        const dy = mouseY - panStart.current.y;
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        panStart.current = { x: mouseX, y: mouseY };
        return;
      }

      // DIBUJANDO LAZO
      if (isSelecting) {
        setSelectionPath(prev => [...prev, { x: mouseX, y: mouseY }]);
        return;
      }

      if (readOnly || draggingIndex === null) return;
      const updatedDots = [...dots];
      updatedDots[draggingIndex] = {
        ...updatedDots[draggingIndex],
        x: (mouseX - offset.x) / internalZoom,
        y: (mouseY - offset.y) / internalZoom,
      };
      setDots(updatedDots);
      drawCanvas();
    };

    const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isPanning) {
        setIsPanning(false);
        panStart.current = null;
        return;
      }

      // FIN LAZO -> ABRIR MENU
      if (isSelecting) {
        setIsSelecting(false);

        const canvas = canvasRef.current;
        if (canvas) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setMenuPos({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top
            });
          }
        }
        return;
      }

      if (readOnly) return;
      if (draggingIndex !== null) {
        onUpdateCoordinates(dots);
      }
      setDraggingIndex(null);
    };

    // Zoom con rueda del mouse, centrado en el cursor
    const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (event.clientX - rect.left) * scaleX;
      const mouseY = (event.clientY - rect.top) * scaleY;

      const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.05, Math.min(10, internalZoom * zoomFactor));

      // Ajustar offset para que el zoom sea centrado en el cursor
      const imgX = (mouseX - offset.x) / internalZoom;
      const imgY = (mouseY - offset.y) / internalZoom;
      const newOffsetX = mouseX - imgX * newZoom;
      const newOffsetY = mouseY - imgY * newZoom;

      setInternalZoom(newZoom);
      setOffset({ x: newOffsetX, y: newOffsetY });
    };

    // --- ACCIONES DEL MENU FLOTANTE ---

    const executeBatchAction = (actionType: 'delete' | 'update_label', newLabel?: string) => {
      // 1. Convertir el poligono (pantalla) a coordenadas de imagen
      const polygonInImageCoords = selectionPath.map(p => ({
        x: (p.x - offset.x) / internalZoom,
        y: (p.y - offset.y) / internalZoom
      }));

      let newDots = [...dots];

      if (actionType === 'delete') {
        newDots = newDots.filter(dot => !isPointInPolygon({x: dot.x, y: dot.y}, polygonInImageCoords));
      } else if (actionType === 'update_label' && newLabel) {
        newDots = newDots.map(dot => {
          if (isPointInPolygon({x: dot.x, y: dot.y}, polygonInImageCoords)) {
            return { ...dot, label: newLabel as Coordinate["label"] };
          }
          return dot;
        });
      }

      // 3. Actualizar estado y cerrar menu
      setDots(newDots);
      onUpdateCoordinates(newDots);
      setMenuPos(null);
      setSelectionPath([]);
    };

    return (
      <div ref={containerRef} className="relative inline-block" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            maxWidth: "100%",
            height: "auto",
            cursor: getCursorStyle(),
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            ...style,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onMouseLeave={() => {
            if (isPanning) setIsPanning(false);
            if (isSelecting) {
              setIsSelecting(false);
              setSelectionPath([]);
            }
          }}
        />

        {/* MENU FLOTANTE */}
        {menuPos && (
          <div
            className="absolute z-50 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 shadow-xl rounded-lg p-2 flex flex-col gap-1 w-56 animate-in fade-in zoom-in duration-100"
            style={{
              left: Math.min(menuPos.x, (containerRef.current?.clientWidth || 500) - 220),
              top: menuPos.y + 10
            }}
          >
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1 uppercase">
              Acciones de Region
            </div>

            {studyType === "her2" ? (
              <>
                <button
                  onClick={() => executeBatchAction('update_label', 'alta completa')}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors text-gray-700 dark:text-gray-200"
                >
                  <span className="w-3 h-3 rounded-full bg-[#FF0000] shadow-sm border border-white/20"></span>
                  Intensa / Completa (3+)
                </button>
                <button
                  onClick={() => executeBatchAction('update_label', 'moderada completa')}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors text-gray-700 dark:text-gray-200"
                >
                  <span className="w-3 h-3 rounded-full bg-[#FFA500] shadow-sm border border-white/20"></span>
                  Moderada / Completa (2+)
                </button>
                <button
                  onClick={() => executeBatchAction('update_label', 'baja incompleta')}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors text-gray-700 dark:text-gray-200"
                >
                  <span className="w-3 h-3 rounded-full bg-[#FFFF00] shadow-sm border border-white/20"></span>
                  Baja / Incompleta (1+)
                </button>
                <button
                  onClick={() => executeBatchAction('update_label', 'no tincion')}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors text-gray-700 dark:text-gray-200"
                >
                  <span className="w-3 h-3 rounded-full bg-[#0000FF] shadow-sm border border-white/20"></span>
                  No Tincion (0)
                </button>
                <button
                  onClick={() => executeBatchAction('update_label', 'na')}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors text-gray-700 dark:text-gray-200"
                >
                  <span className="w-3 h-3 rounded-full bg-[#808080] shadow-sm border border-white/20"></span>
                  NA (No tumoral / Estroma)
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => executeBatchAction('update_label', 'positivo')}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors text-gray-700 dark:text-gray-200"
                >
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm border border-white/20"></span>
                  Marcar Positivo
                </button>
                <button
                  onClick={() => executeBatchAction('update_label', 'negativo')}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors text-gray-700 dark:text-gray-200"
                >
                  <span className="w-3 h-3 rounded-full bg-lime-500 shadow-sm border border-white/20"></span>
                  Marcar Negativo
                </button>
              </>
            )}

            <div className="h-px bg-gray-200 dark:bg-neutral-700 my-1"></div>

            <button
              onClick={() => executeBatchAction('delete')}
              className="flex items-center gap-2 px-2 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              🗑️ Remove points
            </button>

            <button
              onClick={() => { setMenuPos(null); setSelectionPath([]); }}
              className="text-xs text-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-1 py-1"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }
);

EditableCanvas.displayName = "EditableCanvas";
export default EditableCanvas;
