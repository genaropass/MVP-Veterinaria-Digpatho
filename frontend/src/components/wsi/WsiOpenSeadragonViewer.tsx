"use client";

import { useEffect, useRef } from "react";
import { buildMetadataUrl, buildTileUrl } from "@/services/tiles_wsi";

type WsiOpenSeadragonViewerProps = {
  wsiName: string;
};

export default function WsiOpenSeadragonViewer({ wsiName }: WsiOpenSeadragonViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const initViewer = async () => {
      const OpenSeadragon = (await import("openseadragon")).default;

      if (viewerRef.current) return;

      // Obtenemos metadata real del backend usando URL completa del API
      const res = await fetch(buildMetadataUrl(wsiName));
      if (!res.ok) {
        console.error("Error al obtener metadata del WSI:", res.statusText);
        return;
      }
      const metadata = await res.json();

      // Configurar prefixUrl para que OpenSeadragon encuentre las imágenes de los controles
      // Usamos CDN de jsDelivr para asegurar que las imágenes estén disponibles
      const prefixUrl = "https://cdn.jsdelivr.net/npm/openseadragon@5.0.1/build/openseadragon/images/";

      viewerRef.current = OpenSeadragon({
        element: containerRef.current!,
        prefixUrl: prefixUrl,
        showZoomControl: true,
        showHomeControl: true,
        showFullPageControl: false,
        gestureSettingsMouse: {
          scrollToZoom: true,
          clickToZoom: false,
        },
        defaultZoomLevel: 1,
        minZoomLevel: 0.8,
        maxZoomLevel: 4,

        tileSources: {
          width: metadata.width,
          height: metadata.height,
          tileSize: metadata.tileSize,
          minLevel: metadata.minLevel,
          maxLevel: metadata.maxLevel,
          getTileUrl: (level: number, x: number, y: number) =>
            buildTileUrl(wsiName, level, x, y),
        },
      });
    };

    initViewer();

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [wsiName]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
