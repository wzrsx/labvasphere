// src/components/SphereViewer.jsx
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
import "@photo-sphere-viewer/core/index.css";

const SphereViewer = forwardRef(({ src, style = {}, navbar = true }, ref) => {
  const containerRef = useRef(null);
  const viewerInstance = useRef(null);
  const autoRotatePluginRef = useRef(null);

  // Передаем методы управления родителю
  useImperativeHandle(ref, () => ({
    startAutoRotate: () => {
      if (autoRotatePluginRef.current) {
        autoRotatePluginRef.current.start();
      }
    },
    stopAutoRotate: () => {
      if (autoRotatePluginRef.current) {
        autoRotatePluginRef.current.stop();
      }
    },
    getInstance: () => viewerInstance.current,
  }));

  useEffect(() => {
    if (!src || !containerRef.current) return;

    // Безопасное уничтожение предыдущего viewer
    if (viewerInstance.current) {
      try {
        viewerInstance.current.destroy();
      } catch (err) {
        console.warn("Error destroying viewer:", err);
      }
      viewerInstance.current = null;
      autoRotatePluginRef.current = null;
    }

    // Откладываем инициализацию
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      try {

        viewerInstance.current = new Viewer({
          container: containerRef.current,
          panorama: src,
          loadingImg: "",
          navbar: navbar,
          caption: false,
          zoomButtons: !navbar,
          defaultZoomLvl: 0,
          mousewheel: true,
          touchmoveTwoFingers: true,
          plugins: [
              AutorotatePlugin.withConfig({
                  autostartDelay: 1000,
              }),
          ],

        });

        viewerInstance.current.addEventListener("error", (e) => {
          console.error("PhotoSphereViewer error:", e);
        });
      } catch (err) {
        console.error("Failed to initialize PhotoSphereViewer:", err);
      }
    }, 0);

    // Cleanup
    return () => {
      clearTimeout(timer);
      if (viewerInstance.current) {
        try {
          viewerInstance.current.destroy();
        } catch (err) {
          console.warn("Error destroying viewer on cleanup:", err);
        }
        viewerInstance.current = null;
        autoRotatePluginRef.current = null;
      }
    };
  }, [src, navbar]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
});

export default SphereViewer;