"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X, RotateCcw, Contrast, ZoomIn, ZoomOut, Eye, EyeOff, Filter } from "lucide-react";
import { useRef, useState, useMemo, useEffect } from "react";
import EditableCanvas, { EditableCanvasHandle } from "./editableCanvas";
import { Coordinate } from "./types";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { getLabelNames } from "./translate-labels";

type Label = Coordinate["label"];

const COLORS: Record<string, string> = {
  positivo: "red",
  negativo: "lime",
  tejido_no_tumoral: "cyan",
  tincion_alta: "#FF0000",
  tincion_moderada: "#FFA500",
  no_tincion: "#0000FF",
};

export default function ImageEditorModal({
  open,
  onOpenChange,
  imageSrc,
  coordinates,
  onSave,
  title,
  initialMinAxis,
  studyType,
  onUpdateMinAxis,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imageSrc: string;
  coordinates: Coordinate[];
  onSave: (coords: Coordinate[]) => void;
  title?: string;
  initialMinAxis?: number;
  studyType?: "ki67" | "estrogen" | "progesterone" | "her2";
  onUpdateMinAxis?: (minAxis: number) => void;
}) {
  const t = useTranslations("imageEditorModal");
  const LABEL_NAMES = getLabelNames(t);
  const modalTitle = title || t("editon-mode");

  const canvasRef = useRef<EditableCanvasHandle>(null);
  const [coords, setCoords] = useState<Coordinate[]>(coordinates);
  const [action, setAction] = useState<"add" | "remove" | "pan">("add");
  const [selectedLabel, setSelectedLabel] = useState<Label>(() => {
    return studyType === "her2" ? "tincion_alta" : "positivo";
  });
  const [zoom, setZoom] = useState(1);
  const [initialZoom, setInitialZoom] = useState(1);
  const [showPoints, setShowPoints] = useState(true);
  const [contrast, setContrast] = useState(100);
  const [minAxis, setMinAxis] = useState(initialMinAxis ?? 25);
  const [visibleLabels, setVisibleLabels] = useState<Record<string, boolean>>({
    positivo: true,
    negativo: true,
    tejido_no_tumoral: true,
    tincion_alta: true,
    tincion_moderada: true,
    no_tincion: true,
  });

  const availableLabels: Label[] = useMemo(() => {
    return studyType === "her2"
      ? ["tincion_alta", "tincion_moderada", "no_tincion"]
      : ["positivo", "negativo", "tejido_no_tumoral"];
  }, [studyType]);

  // Calcular zoom dinámico para fit-to-view cuando se abre el modal
  useEffect(() => {
    if (!open || !imageSrc) return;

    const img = new Image();
    img.onload = () => {
      const sidebarWidth = 320;
      const padding = 64;
      const headerHeight = 80;
      const containerW = window.innerWidth * 0.95 - sidebarWidth - padding;
      const containerH = window.innerHeight * 0.95 - headerHeight - padding;

      const fitZoom = Math.min(containerW / img.width, containerH / img.height);

      // Para HER2 queremos empezar bastante más cerca.
      const minZoom = studyType === "her2" ? 0.6 : 0.2;
      // Partimos de un fit-to-view algo ampliado, pero sin pasar de 1x.
      const baseZoom = Math.min(fitZoom * 1.5, 1);

      const calculated = parseFloat(
        Math.max(baseZoom, minZoom).toFixed(2)
      );
      setZoom(calculated);
      setInitialZoom(calculated);
    };
    img.src = imageSrc;
  }, [open, imageSrc, studyType]);

  // Filter function to check if a coordinate should be visible
  const isCoordinateVisible = (c: Coordinate) => {
    const meetsMinAxis = c.minAxis === undefined || c.minAxis >= minAxis;
    const isLabelVisible = visibleLabels[c.label] !== false;
    return meetsMinAxis && isLabelVisible && showPoints;
  };

  // Memoized filtered coordinates for statistics
  const filteredCoords = useMemo(() => {
    return coords.filter((c) => {
      const meetsMinAxis = c.minAxis === undefined || c.minAxis >= minAxis;
      const isLabelVisible = visibleLabels[c.label] !== false;
      return meetsMinAxis && isLabelVisible;
    });
  }, [coords, minAxis, visibleLabels]);

  // Simple coordinate update handler
  const handleUpdateCoordinates = (updatedCoords: Coordinate[]) => {
    setCoords(updatedCoords);
  };

  const handleSave = () => {
    onSave(coords);
    onOpenChange(false);
    toast.success('Cálculos actualizados correctamente.');
  };

  const handleResetView = () => {
    canvasRef.current?.resetView();
    setContrast(100);
    setZoom(initialZoom); // Reset zoom to initial zoom
  };

  const handleContrastChange = (value: number) => {
    setContrast(value);
    canvasRef.current?.setContrast(value);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.2));

  // Statistics for display
  const totalPoints = coords.length;
  const visiblePointsCount = filteredCoords.length;
  const filteredByMinAxis = coords.filter(c => c.minAxis === undefined || c.minAxis >= minAxis).length;

  // Count by label for display
  const getCountByLabel = (label: Label) => {
    const totalCount = coords.filter(c => c.label === label).length;
    const filteredCount = coords.filter(c => 
      c.label === label && 
      (c.minAxis === undefined || c.minAxis >= minAxis) && 
      visibleLabels[label] !== false
    ).length;
    return { totalCount, filteredCount };
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}> 
      <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 dark:bg-black/70" />
      <Dialog.Content className="fixed z-50 top-1/2 left-1/2 w-[95vw] max-w-7xl h-[95vh] -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden dark:bg-gray-900">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {modalTitle}
          </Dialog.Title>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium dark:bg-blue-900 dark:text-blue-200">
            {visiblePointsCount} de {totalPoints} puntos
          </span>
          {filteredByMinAxis < totalPoints && (
            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-medium dark:bg-orange-900 dark:text-orange-200">
              {filteredByMinAxis} filtrados por eje
            </span>
          )}
          </div>
        </div>
        <Dialog.Close asChild>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700">
          <X className="w-5 h-5" />
          </button>
        </Dialog.Close>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 overflow-hidden bg-gray-50 relative dark:bg-gray-900">
          <div className="absolute inset-4 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white dark:border-gray-700 dark:bg-gray-800">
          <EditableCanvas
            ref={canvasRef}
            imageSrc={imageSrc}
            coordinates={coords}
            onUpdateCoordinates={handleUpdateCoordinates}
            action={action}
            selectedLabel={selectedLabel}
            showPoints={showPoints}
            zoom={zoom}
            showControls={false}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            // Pass filter function to canvas
            coordinateFilter={isCoordinateVisible}
            studyType={studyType}
          />
          </div>

          {/* Minimal Controls Overlay */}
          <div className="absolute top-8 right-8">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200 dark:bg-gray-800/95 dark:border-gray-700">
            <div className="flex gap-2">
            <button
              onClick={handleResetView}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors text-sm font-medium dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
              title="Restablecer vista"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={() => setShowPoints(!showPoints)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
              showPoints 
                ? 'bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-200' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200'
              }`}
              title={showPoints ? "Ocultar puntos" : "Mostrar puntos"}
            >
              {showPoints ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showPoints ? 'Ocultar' : 'Mostrar'}
            </button>
            </div>
          </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col dark:bg-gray-900 dark:border-gray-700">
          <div className="p-6 space-y-6 overflow-auto flex-1">
          {/* Action Selection */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 dark:text-gray-100">
            Modo de edición
            </h3>
            <div className="grid grid-cols-1 gap-2">
            {[
              { value: "add", label: "Agregar puntos", icon: "+" },
              { value: "remove", label: "Eliminar puntos", icon: "−" },
              { value: "pan", label: "Navegación", icon: "↔" }
            ].map(({ value, label, icon }) => (
              <label key={value} className="group">
              <input
                type="radio"
                name="action"
                checked={action === value}
                onChange={() => setAction(value as typeof action)}
                className="sr-only"
              />
              <div className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                action === value 
                ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-100' 
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-800'
              }`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                action === value ? 'bg-blue-500 text-white dark:bg-blue-400 dark:text-blue-950' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                {icon}
                </span>
                <span className="font-medium dark:text-gray-100">{label}</span>
              </div>
              </label>
            ))}
            </div>
          </div>

          {/* MinAxis Filter */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 dark:text-gray-100">
            <Filter className="w-4 h-4" />
            Filtro Eje Mínimo
            </h3>
            <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>10</span>
              <span className="font-medium">{minAxis}</span>
              <span>100</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="1"
              value={minAxis}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMinAxis(val);
                onUpdateMinAxis?.(val);
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Mostrando puntos con eje mínimo ≥ {minAxis}
            </div>
            </div>
          </div>

          {/* Label Selection */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Tipo de anotación</h3>
            <div className="space-y-2">
            {availableLabels.map((label) => {
              const { totalCount, filteredCount } = getCountByLabel(label);
              
              return (
                <label key={label} className="group">
                <input
                  type="radio"
                  name="selectedLabel"
                  checked={selectedLabel === label}
                  onChange={() => setSelectedLabel(label)}
                  className="sr-only"
                />
                <div className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedLabel === label 
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-800'
                }`}>
                  <span
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: COLORS[label] }}
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">{LABEL_NAMES[label]}</span>
                  <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                  {filteredCount !== totalCount ? `${filteredCount}/${totalCount}` : totalCount}
                  </span>
                </div>
                </label>
              );
            })}
            </div>
          </div>

          {/* Contrast Control */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 dark:text-gray-100">
            <Contrast className="w-4 h-4" />
            Contraste
            </h3>
            <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>50%</span>
              <span className="font-medium">{contrast}%</span>
              <span>200%</span>
            </div>
            <input
              type="range"
              min="50"
              max="200"
              value={contrast}
              onChange={(e) => handleContrastChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
            />
            </div>
          </div>

          {/* Zoom Control */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 dark:text-gray-100">
            Zoom
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({zoom.toFixed(1)}x)</span>
            </h3>
            <div className="flex gap-2">
            <button
              onClick={handleZoomOut}
              className="flex-1 flex items-center justify-center gap-2 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
              title="Alejar"
            >
              <ZoomOut className="w-4 h-4" />
              Alejar
            </button>
            <button
              onClick={handleZoomIn}
              className="flex-1 flex items-center justify-center gap-2 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
              title="Acercar"
            >
              <ZoomIn className="w-4 h-4" />
              Acercar
            </button>
            </div>
          </div>

          {/* Visibility Control */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Visibilidad</h3>
            <div className="space-y-2">
            {availableLabels.map((label) => {
              const { totalCount} = getCountByLabel(label);
              const countAfterMinAxis = coords.filter(c => 
                c.label === label && 
                (c.minAxis === undefined || c.minAxis >= minAxis)
              ).length;
              
              return (
                <label key={label} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer dark:hover:bg-gray-800">
                <input
                  type="checkbox"
                  checked={visibleLabels[label] !== false}
                  onChange={() =>
                  setVisibleLabels((prev) => ({
                    ...prev,
                    [label]: prev[label] === false,
                  }))
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:checked:bg-blue-600"
                />
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[label] }}
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{LABEL_NAMES[label]}</span>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                  {countAfterMinAxis !== totalCount ? `${countAfterMinAxis}/${totalCount}` : totalCount}
                </span>
                </label>
              );
            })}
            </div>
          </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={handleSave}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-4 focus:ring-blue-200 dark:bg-blue-700 dark:hover:bg-blue-800 dark:focus:ring-blue-900"
          >
            Actualizar cálculos
          </button>
          </div>
        </div>
        </div>
      </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}