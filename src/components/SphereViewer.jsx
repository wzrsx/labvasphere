// src/components/SphereViewer.jsx
import React, { useEffect, useRef } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";

const SphereViewer = ({ src, style = {} }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!src || !containerRef.current) return;

    // Уничтожаем предыдущий экземпляр (на случай повторного рендера)
    if (viewerRef.current) {
      viewerRef.current.destroy();
    }

    // Создаём новый просмотрщик
    viewerRef.current = new Viewer({
      container: containerRef.current,
      panorama: src,
      loadingImg: "",
      navbar: true, // панель управления (zoom, fullscreen и т.д.)
      caption: "",
      defaultZoomLvl: 0, // 0 = авто, 1 = 100%
      mousewheel: true,
      touchmoveTwoFingers: true,
    });
    // Подписка на ошибки (опционально)
    viewerRef.current.addEventListener("error", (e) => {
      console.error("PhotoSphereViewer error:", e);
    });
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
};

export default SphereViewer;
