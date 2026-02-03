// src/components/SphereViewer.jsx
import React, { useEffect, useRef } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";

const SphereViewer = ({ src, style = {} }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!src || !containerRef.current) return;

    // Уничтожаем предыдущий viewer (если есть)
    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    // Откладываем инициализацию на следующий кадр (после layout)
    const timer = setTimeout(() => {
      try {
        viewerRef.current = new Viewer({
          container: containerRef.current,
          panorama: src,
          loadingImg: "",
          navbar: true,
          caption: "",
          defaultZoomLvl: 0,
          mousewheel: true,
          touchmoveTwoFingers: true,
        });

        viewerRef.current.addEventListener("error", (e) => {
          console.error("PhotoSphereViewer error:", e);
        });
      } catch (err) {
        console.error("Failed to initialize PhotoSphereViewer:", err);
      }
    }, 0);

    // Cleanup
    return () => {
      clearTimeout(timer);
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
