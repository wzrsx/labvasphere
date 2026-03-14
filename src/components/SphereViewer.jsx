// SphereViewer.jsx — ФИНАЛЬНАЯ ВЕРСИЯ С ОТЛАДКОЙ
import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState } from "react";
import { Viewer, EquirectangularAdapter } from "@photo-sphere-viewer/core";
import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
import "@photo-sphere-viewer/core/index.css";

const SphereViewer = forwardRef(({ 
  src, 
  style = {}, 
  navbar = true, 
  autoRotate = false, 
  mousemove = true,  
  onViewerReady, 
  onPanoramaLoad,
  onError,
  transitionDuration = 700 
}, ref) => {
  
  const containerRef = useRef(null);
  const viewerInstance = useRef(null);
  const autoRotatePluginRef = useRef(null);
  
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [isPanoramaLoaded, setIsPanoramaLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [initError, setInitError] = useState(null);

  // 🔹 Метод смены панорамы
  const changePanorama = useCallback(async (newSrc, options = {}) => {
    if (!viewerInstance.current || !newSrc) {
      console.error('[SV] Cannot change: no viewer or src');
      return Promise.reject(new Error('Viewer not initialized'));
    }
    
    console.log('[SV] Changing panorama...');
    setIsPanoramaLoaded(false);
    setLoadProgress(0);
    
    try {
      await viewerInstance.current.setPanorama(newSrc, {
        transition: 'fade',
        duration: transitionDuration,
        ...options
      });
      console.log('[SV] Panorama changed');
      setIsPanoramaLoaded(true);
      onPanoramaLoad?.();
    } catch (err) {
      console.error('[SV] Change error:', err);
      setInitError(err);
      onError?.(err);
      throw err;
    }
  }, [transitionDuration, onPanoramaLoad, onError]);

  // 🔹 Экспорт методов
  useImperativeHandle(ref, () => ({
    startAutoRotate: () => autoRotatePluginRef.current?.start(),
    stopAutoRotate: () => autoRotatePluginRef.current?.stop(),
    getInstance: () => viewerInstance.current,
    changePanorama,
    isReady: () => isViewerReady && isPanoramaLoaded,
  }), [changePanorama, isViewerReady, isPanoramaLoaded]);

  // 🔹 Инициализация
  useEffect(() => {
    const startTime = Date.now();
    console.log('[SV] === INIT START ===');
    console.log('[SV] src length:', src?.length);
    console.log('[SV] container:', containerRef.current);

    if (!containerRef.current || !src) {
      console.log('[SV] Skip: no container or src');
      return;
    }

    // 🔹 Проверка размеров контейнера
    const rect = containerRef.current.getBoundingClientRect();
    console.log('[SV] container size:', { width: rect.width, height: rect.height });
    
    if (rect.width === 0 || rect.height === 0) {
      console.error('[SV] Container has zero size!');
      setInitError(new Error('Container has zero dimensions'));
      return;
    }

    const plugins = [];
    if (autoRotate) {
      plugins.push([AutorotatePlugin, { speed: 0.1, delay: 0, autoplay: true }]);
    }

    try {
      // 🔹 Создаём Viewer
      console.log('[SV] Creating Viewer...');
      viewerInstance.current = new Viewer({
        container: containerRef.current,
        adapter: EquirectangularAdapter,  // ← НЕ массив!
        panorama: src,                     // ← на верхнем уровне
        navbar: navbar,
        caption: false,
        defaultZoomLvl: 0,
        mousewheel: true,
        mousemove: mousemove,
        // zoomButtons убран — вызывает warning в вашей версии
        plugins,
      });

      console.log('[SV] Viewer instance created');
      console.log('[SV] Has adapter:', !!viewerInstance.current.adapter);
      console.log('[SV] Has renderer:', !!viewerInstance.current.renderer);

      let isReadyCalled = false;

      // 🔹 ВСЕ события подряд
      const events = ['ready', 'load-start', 'load', 'load-progress', 'load-error', 'error'];
      events.forEach(eventName => {
        const handler = (e) => {
          const time = Date.now() - startTime;
          console.log(`[SV] 📬 EVENT: ${eventName} (${time}ms)`, e?.detail || e?.type || '');
        };
        viewerInstance.current.addEventListener(eventName, handler);
      });

      // 🔹 Конкретные обработчики
      const handleReady = () => {
        if (isReadyCalled) {
          console.log('[SV] ready already called, skipping');
          return;
        }
        isReadyCalled = true;
        const total = Date.now() - startTime;
        console.log(`[SV] ✅✅✅ READY! (${total}ms)`);
        setIsViewerReady(true);
        setIsPanoramaLoaded(true);
        onViewerReady?.(viewerInstance.current);
      };

      const handleLoadProgress = (e) => {
        console.log('[SV] load-progress:', e.detail);
        setLoadProgress(e.detail);
      };

      const handleLoad = () => {
        console.log('[SV] ✓ load event');
        setIsPanoramaLoaded(true);
      };

      const handleLoadError = (e) => {
        console.error('[SV] ❌ load-error:', e);
        setInitError(e);
        onError?.(e);
      };

      const handleError = (e) => {
        console.error('[SV] ❌ error:', e);
        setInitError(e);
        onError?.(e);
      };

      // Подписываемся
      viewerInstance.current.addEventListener('ready', handleReady);
      viewerInstance.current.addEventListener('load-progress', handleLoadProgress);
      viewerInstance.current.addEventListener('load', handleLoad);
      viewerInstance.current.addEventListener('load-error', handleLoadError);
      viewerInstance.current.addEventListener('error', handleError);

      // 🔹 Fallback таймер
      const timeout = setTimeout(() => {
        if (!isReadyCalled && viewerInstance.current) {
          console.warn('[SV] ⚠️ Timeout 8s — forcing ready');
          console.log('[SV] Final state:', {
            hasAdapter: !!viewerInstance.current.adapter,
            hasRenderer: !!viewerInstance.current.renderer,
            hasScene: !!viewerInstance.current.scene,
            hasCamera: !!viewerInstance.current.camera,
          });
          setIsViewerReady(true);
          setIsPanoramaLoaded(true);
          onViewerReady?.(viewerInstance.current);
        }
      }, 8000);

      // 🔹 Cleanup
      return () => {
        console.log('[SV] === CLEANUP ===');
        clearTimeout(timeout);
        if (viewerInstance.current) {
          viewerInstance.current.destroy();
          console.log('[SV] Viewer destroyed');
        }
        viewerInstance.current = null;
        setIsViewerReady(false);
        setIsPanoramaLoaded(false);
      };

    } catch (err) {
      console.error('[SV] Init error:', err);
      setInitError(err);
      onError?.(err);
    }
  }, []); // ← Пустой массив! Только при маунте

  // 🔹 Реакция на смену src
  useEffect(() => {
    console.log('[SV] src changed, ready:', isViewerReady);
    if (!isViewerReady || !viewerInstance.current || !src) return;
    changePanorama(src).catch(() => {});
  }, [src, isViewerReady, changePanorama]);

  // 🔹 Рендер
  if (!isViewerReady || !isPanoramaLoaded) {
    return (
      <div 
        ref={containerRef} 
        style={{ 
          width: "100%", 
          height: "100%", 
          minHeight: "225px",
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#1a1a2e', 
          color: '#fff', 
          ...style 
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '4px solid rgba(74,144,226,0.3)',
            borderTopColor: '#4a90e2', borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <span style={{ fontSize: '14px', color: '#cbd5e1' }}>
            Загрузка... {loadProgress > 0 && `(${Math.round(loadProgress)}%)`}
          </span>
          {initError && <span style={{ fontSize: '12px', color: '#ef4444' }}>Ошибка</span>}
        </div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height: "100%", ...style }} />;
});

export default SphereViewer;