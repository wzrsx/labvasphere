import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
import "@photo-sphere-viewer/core/index.css";

const SphereViewer = forwardRef(({ src, style = {}, navbar = true, autoRotate = false, mousemove = true,  touchmove = true, onViewerReady, transitionDuration = 700 }, ref) => {
  const containerRef = useRef(null);
  const viewerInstance = useRef(null);
  const autoRotatePluginRef = useRef(null);
  const isViewerReady = useRef(false);

  // Метод плавной смены панорамы
  const changePanorama = useCallback((newSrc, options = {}) => {
    if (viewerInstance.current && newSrc) {
      return viewerInstance.current.setPanorama(newSrc, {
        transition: 'fade',
        duration: transitionDuration, // Используем проп
        ...options
      });
    }
    return Promise.resolve();
  }, [transitionDuration]);

  useImperativeHandle(ref, () => ({
    startAutoRotate: () => autoRotatePluginRef.current?.start(),
    stopAutoRotate: () => autoRotatePluginRef.current?.stop(),
    getInstance: () => viewerInstance.current,
    changePanorama, // Экспортируем метод для плавного перехода
  }));

  // Инициализация (только один раз)
  useEffect(() => {
    if (!containerRef.current) return;

    const plugins = [];
    if (autoRotate) {
      plugins.push([
        AutorotatePlugin,
        {
          speed: 0.1, // град/сек
          delay: 0,
          autoplay: true,
        }
      ]);
    }

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
        mousemove: mousemove,  
        touchmove: touchmove,
        touchmoveTwoFingers: true,
        plugins,
      });
      console.log(src);
      // Сообщаем родителю, что вьювер готов
      isViewerReady.current = true;
      onViewerReady?.(viewerInstance.current);

      viewerInstance.current.addEventListener("error", (e) => {
        console.error("PhotoSphereViewer error:", e);
      });

    } catch (err) {
      console.error("Failed to initialize PhotoSphereViewer:", err);
    }

    return () => {
      if (viewerInstance.current) {
        try {
          viewerInstance.current.destroy();
        } catch (err) {
          console.warn("Error destroying viewer:", err);
        }
        viewerInstance.current = null;
        autoRotatePluginRef.current = null;
        isViewerReady.current = false;
      }
    };
  }, []); // Пустой массив — инициализация только при маунте

  // Реакция на смену src (плавный переход вместо пересоздания)
  useEffect(() => {
    if (isViewerReady.current && viewerInstance.current && src) {
      changePanorama(src);
    }
  }, [src, changePanorama]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
});

export default SphereViewer;