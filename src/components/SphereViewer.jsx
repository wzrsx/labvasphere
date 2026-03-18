// SphereViewer.jsx
import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState } from "react";
import { Viewer, EquirectangularAdapter } from "@photo-sphere-viewer/core";
import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";

const SphereViewer = forwardRef((props, ref) => {
  const {
    src,
    style = {},
    navbar = true,
    autoRotate = false,
    mousemove = true,
    hotspots = [],
    onHotspotClick,
    onPositionClick,
    onViewerReady,
    onPanoramaLoad,
    onError,
    transitionDuration = 700
  } = props;
  
  const containerRef = useRef(null);
  const viewerInstance = useRef(null);
  const autoRotatePluginRef = useRef(null);
  const markersPluginRef = useRef(null);
  const markerClickedRef = useRef(false);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [isPanoramaLoaded, setIsPanoramaLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [initError, setInitError] = useState(null);

  // Конвертация маркеров с обработкой иконки 'default'
  const convertToMarkers = useCallback((hotspotsList) => {
    return hotspotsList.map(hotspot => {
      // Если icon = 'default' или null/undefined — используем файл из public/
      const iconUrl = !hotspot.icon || hotspot.icon === 'default'
        ? '/finger-32.svg'
        : hotspot.icon;
      
      return {
        id: hotspot.id,
        position: hotspot.position,  // Должен быть { yaw: number, pitch: number }
        image: iconUrl,
        size: { width: 32, height: 32 },
        tooltip: hotspot.tooltip 
          ? { content: hotspot.tooltip, position: 'top' } 
          : { content: hotspot.title || 'Точка перехода', position: 'top' },
        style: { cursor: 'pointer', transition: 'transform 0.2s' },
        data: { ...hotspot }
      };
    });
  }, []);

  // Синхронизация хотспотов (с логированием)
  useEffect(() => {
    console.log('[SV] 🔄 Sync effect:', { 
      isViewerReady, 
      hasMarkersPlugin: !!markersPluginRef.current, 
      hotspotsCount: hotspots.length 
    });
    
    if (!isViewerReady || !markersPluginRef.current) {
      console.log('[SV] ⏳ Waiting for viewer readiness...');
      return;
    }
    
    const markers = convertToMarkers(hotspots);
    console.log('[SV] ✅ Setting markers:', markers.length);
    markersPluginRef.current.setMarkers(markers);
  }, [hotspots, isViewerReady, convertToMarkers]);
  useEffect(() => {
  if (isPanoramaLoaded && isViewerReady && markersPluginRef.current && hotspots.length > 0) {
    console.log('[SV] 🎯 Panorama loaded, syncing', hotspots.length, 'markers');
    const markers = convertToMarkers(hotspots);
    markersPluginRef.current.setMarkers(markers);
  }
}, [isPanoramaLoaded, isViewerReady, hotspots.length, convertToMarkers]);
  // Смена панорамы
  const changePanorama = useCallback(async (newSrc, options = {}) => {
    if (!viewerInstance.current || !newSrc) {
      console.error('[SV] Cannot change: no viewer or src');
      return Promise.reject(new Error('Viewer not initialized'));
    }
    
    console.log('[SV] Changing panorama...', { newSrc, options });
    setIsPanoramaLoaded(false);
    setLoadProgress(0);
    
    try {
      // Поддержка опций перехода
      await viewerInstance.current.setPanorama(newSrc, {
        transition: options.transition || 'fade',  // 'fade' | 'zoom' | 'none'
        duration: options.duration || 700,          // длительность в мс
        ...options
      });
      
      console.log('[SV] Panorama changed');
      setIsPanoramaLoaded(true);
      onPanoramaLoad?.();
      return true;
      
    } catch (err) {
      console.error('[SV] Change error:', err);
      setInitError(err);
      onError?.(err);
      throw err;
    }
  }, [onPanoramaLoad, onError]);

// Обработчик клика по панораме (для добавления новых хотспотов)
const handleViewerClick = useCallback((e) => {
  console.log('[SV] 🖱️ Click event fired!');
  
  // Если только что был клик по маркеру — игнорируем этот клик
  if (markerClickedRef.current) {
    console.log('[SV] ⚠️ Click ignored: marker was just clicked');
    return;
  }
  
  if (!onPositionClick) {
    console.warn('[SV] ❌ onPositionClick callback not provided');
    return;
  }
  
  // Координаты в e.data
  if (e.data?.yaw !== undefined && e.data?.pitch !== undefined) {
    console.log('[SV] ✅ Valid coordinates:', {
      yaw: e.data.yaw.toFixed(4) + 'rad',
      pitch: e.data.pitch.toFixed(4) + 'rad'
    });
    
    // ОТПРАВЛЯЕМ ЧИСЛА
    onPositionClick({
      yaw: e.data.yaw,
      pitch: e.data.pitch
    });
  }
}, [onPositionClick]);

  // Экспорт методов
  useImperativeHandle(ref, () => ({
    startAutoRotate: () => autoRotatePluginRef.current?.start(),
    stopAutoRotate: () => autoRotatePluginRef.current?.stop(),
    getInstance: () => viewerInstance.current,
    getMarkersPlugin: () => markersPluginRef.current,
    changePanorama,
    isReady: () => isViewerReady && isPanoramaLoaded,
    gotoHotspot: (hotspotId) => {
      if (markersPluginRef.current) {
        return markersPluginRef.current.gotoMarker(hotspotId, '4rpm');
      }
      return Promise.reject('Markers plugin not ready');
    }
  }), [changePanorama, isViewerReady, isPanoramaLoaded]);

  // Инициализация Viewer
  useEffect(() => {
    const startTime = Date.now();
    console.log('[SV] === INIT START ===');

    if (!containerRef.current || !src) {
      console.log('[SV] Skip: no container or src');
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.error('[SV] Container has zero size!');
      setInitError(new Error('Container has zero dimensions'));
      return;
    }

    const plugins = [];
    if (autoRotate) {
      plugins.push([AutorotatePlugin, { speed: 0.1, delay: 0, autoplay: true }]);
    }
    plugins.push([MarkersPlugin, {
      markers: convertToMarkers(hotspots),
      clickEventOnMarker: true,
      clickEventOnCanvas: true,
      defaultHoverScale: { amount: 1.2, duration: 150 }
    }]);

    try {
      console.log('[SV] Creating Viewer...');
      viewerInstance.current = new Viewer({
        container: containerRef.current,
        adapter: EquirectangularAdapter,
        panorama: src,
        navbar: navbar,
        caption: false,
        defaultZoomLvl: 0,
        mousewheel: true,
        mousemove: mousemove,
        plugins,
      });

      markersPluginRef.current = viewerInstance.current.getPlugin(MarkersPlugin);
      autoRotatePluginRef.current = viewerInstance.current.getPlugin(AutorotatePlugin);

      let isReadyCalled = false;

      
      const handleReady = () => {
        if (isReadyCalled) return;
        isReadyCalled = true;
        
        setIsViewerReady(true);
        setIsPanoramaLoaded(true);
        
        // Подписка на клик
        if (onPositionClick) {
          viewerInstance.current.addEventListener('click', handleViewerClick);
          console.log('[SV] ✅ Subscribed to click event');
        }
        
        onViewerReady?.(viewerInstance.current);
      };

      const handleLoadProgress = (e) => setLoadProgress(e.detail);
      const handleLoad = () => setIsPanoramaLoaded(true);
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

      viewerInstance.current.addEventListener('ready', handleReady);
      viewerInstance.current.addEventListener('load-progress', handleLoadProgress);
      viewerInstance.current.addEventListener('load', handleLoad);
      viewerInstance.current.addEventListener('load-error', handleLoadError);
      viewerInstance.current.addEventListener('error', handleError);

      const timeout = setTimeout(() => {
        if (!isReadyCalled && viewerInstance.current) {
          console.warn('[SV] ⚠️ Timeout 8s — forcing ready');
          setIsViewerReady(true);
          setIsPanoramaLoaded(true);
          onViewerReady?.(viewerInstance.current);
        }
      }, 8000);
      
      const markersPlugin = viewerInstance.current.getPlugin(MarkersPlugin);
      if (markersPlugin && onHotspotClick) {
        markersPlugin.addEventListener('select-marker', ({ marker, doubleClick, rightClick }) => {
          console.log('[SV] 🎯 select-marker fired:', {
            hasMarker: !!marker,
            markerId: marker?.id,
            hasData: !!marker?.data,
            doubleClick,
            rightClick
          });
          
          // Игнорируем правый/двойной клик
          if (rightClick || doubleClick) {
            console.log('[SV] ⚠️ Ignoring right/double click');
            return;
          }
          
          if (marker?.data) {
            console.log('[SV] ✅ Calling onHotspotClick with:', marker.data);
            onHotspotClick(marker.data);  
          } else {
            console.warn('[SV] ⚠️ marker.data is undefined — check convertToMarkers!');
          }
        });
      }
      return () => {
        console.log('[SV] === CLEANUP ===');
        clearTimeout(timeout);
        
        if (onPositionClick && viewerInstance.current) {
          viewerInstance.current.removeEventListener('click', handleViewerClick);
        }
        
        if (viewerInstance.current) {
          viewerInstance.current.destroy();
        }
        viewerInstance.current = null;
        markersPluginRef.current = null;
        autoRotatePluginRef.current = null;
        setIsViewerReady(false);
        setIsPanoramaLoaded(false);
      };

    } catch (err) {
      console.error('[SV] Init error:', err);
      setInitError(err);
      onError?.(err);
    }
  }, []);

  // Реакция на смену src
  useEffect(() => {
    if (!isViewerReady || !viewerInstance.current || !src) return;
    changePanorama(src).catch(() => {});
  }, [src, isViewerReady, changePanorama]);

  // Рендер
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
      {/*
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
        </div>*/}
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height: "100%", ...style }} />;
});

export default React.memo(SphereViewer, (prevProps, nextProps) => {
  return (
    prevProps.src === nextProps.src &&
    prevProps.navbar === nextProps.navbar &&
    prevProps.autoRotate === nextProps.autoRotate &&
    prevProps.mousemove === nextProps.mousemove &&
    prevProps.hotspots === nextProps.hotspots &&
    prevProps.style === nextProps.style &&
    prevProps.onHotspotClick === nextProps.onHotspotClick &&
    prevProps.onPositionClick === nextProps.onPositionClick &&
    prevProps.onViewerReady === nextProps.onViewerReady &&
    prevProps.onPanoramaLoad === nextProps.onPanoramaLoad &&
    prevProps.onError === nextProps.onError
  );
});