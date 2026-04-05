// src/components/MiniMapHotspots.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import './MiniMapHotspots.css';

/**
 * MiniMapHotspots - Мини-карта переходов между панорамами
 * 
 * @param {Object} props
 * @param {Array} props.projectPanoramas - Все панорамы проекта (с полями: id, filename, original_filename, yaw/position_yaw)
 * @param {Array} props.hotspots - Хотспоты текущей панорамы (с полем target_filename)
 * @param {string|number|null} props.currentPanoramaId - ID текущей отображаемой панорамы
 * @param {Function} props.onPanoramaSelect - Callback при клике на панораму: (panorama) => void
 * @param {string} props.projectId - ID проекта (для отладки)
 * @param {boolean} props.debug - Включить подробное логирование в консоль
 */
const MiniMapHotspots = ({
  projectPanoramas = [],
  hotspots = [],
  currentPanoramaId,
  onPanoramaSelect,
  projectId,
  debug = true, // 🔹 Включите для отладки
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, cssWidth: 200, cssHeight: 200 });
  const [hoveredPanorama, setHoveredPanorama] = useState(null);

  // ============================================================================
  // 🔹 ОТЛАДКА: Логирование входящих данных
  // ============================================================================
  useEffect(() => {
    if (!debug) return;

    console.group('🗺️ MiniMapHotspots: Props Debug');
    console.log('📦 projectId:', projectId);
    console.log('🎯 currentPanoramaId:', currentPanoramaId);
    console.log('📸 projectPanoramas:', projectPanoramas.map(p => ({
      id: p.id,
      filename: p.filename,
      original_filename: p.original_filename,
      yaw: p.yaw ?? p.position_yaw ?? 'N/A',
    })));
    console.log('🔗 hotspots:', hotspots.map(h => ({
      id: h.id,
      type: h.type,
      target_filename: h.target_filename,
      targetProjectId: h.targetProjectId,
      position: h.position,
    })));
    console.groupEnd();
  }, [projectPanoramas, hotspots, currentPanoramaId, projectId, debug]);

  // ============================================================================
  // 🔹 Обновление размеров канваса
  // ============================================================================
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        setDimensions({
          width: Math.floor(rect.width * dpr),
          height: Math.floor(rect.height * dpr),
          cssWidth: rect.width,
          cssHeight: rect.height,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // ============================================================================
  // 🔹 Вспомогательная: поиск панорамы по filename (исправление основной проблемы)
  // ============================================================================
  const findPanoramaByFilename = useCallback((targetFilename) => {
    if (!targetFilename) return null;

    // Извлекаем чистое имя файла (убираем путь, если есть)
    const cleanTarget = targetFilename.split('/').pop();

    return projectPanoramas.find((p) => {
      const pFilename = p.filename?.split('/').pop();
      const pOriginal = p.original_filename?.split('/').pop();

      // Прямое совпадение
      if (pFilename === cleanTarget || pOriginal === cleanTarget) {
        return true;
      }

      // Совпадение без расширения (на случай различий в формате)
      const targetBase = cleanTarget?.replace(/\.[^/.]+$/, '');
      const pFilenameBase = pFilename?.replace(/\.[^/.]+$/, '');
      const pOriginalBase = pOriginal?.replace(/\.[^/.]+$/, '');

      if (targetBase && (pFilenameBase === targetBase || pOriginalBase === targetBase)) {
        return true;
      }

      // Содержит ли filename целевое имя (для случаев с префиксами UUID)
      if (cleanTarget && pFilename?.includes(cleanTarget)) {
        return true;
      }

      return false;
    });
  }, [projectPanoramas]);

  // ============================================================================
  // 🔹 Построение графа связей (ИСПРАВЛЕНО: поиск по target_filename)
  // ============================================================================
  const buildConnections = useCallback(() => {
    const connections = [];

    if (debug) {
      console.group('🔗 Building connections');
      console.log('Current panorama:', currentPanoramaId);
    }

    hotspots.forEach((hotspot) => {
      // Обрабатываем только хотспоты-переходы с целевым файлом
      if (hotspot.type !== 'transition' || !hotspot.target_filename) {
        if (debug) console.log('⏭️ Skip hotspot (not transition or no filename):', hotspot.id);
        return;
      }

      // 🔹 Ищем целевую панораму по имени файла
      const targetPanorama = findPanoramaByFilename(hotspot.target_filename);

      if (debug) {
        console.log(`🔍 Looking for "${hotspot.target_filename}":`, 
          targetPanorama ? `✅ Found (id: ${targetPanorama.id})` : '❌ Not found');
      }

      // Если нашли целевую панораму И есть текущая панорама
      if (targetPanorama && currentPanoramaId) {
        connections.push({
          from: currentPanoramaId,
          to: targetPanorama.id,
          hotspotId: hotspot.id,
          targetFilename: hotspot.target_filename, // для отладки
        });
      }
    });

    if (debug) {
      console.log('✅ Total connections found:', connections.length);
      console.groupEnd();
    }

    return connections;
  }, [hotspots, currentPanoramaId, findPanoramaByFilename, debug]);

  // Мемоизируем связи, чтобы не пересчитывать при каждом рендере
  const connections = useMemo(() => buildConnections(), [buildConnections]);

  // ============================================================================
  // 🔹 Преобразование yaw в координаты на карте
  // ============================================================================
  const yawToCoords = useCallback((yaw, radius, centerX, centerY) => {
    // yaw в радианы, 0 градусов = верх карты (12 часов)
    // Вычитаем 90°, чтобы 0° был сверху, а не справа
    const rad = ((yaw - 90) * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad),
    };
  }, []);

  // ============================================================================
  // 🔹 Отрисовка мини-карты на Canvas
  // ============================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20; // отступ от края

    // 🔹 Очистка канваса
    ctx.clearRect(0, 0, width, height);

    // 🔹 Фон: полупрозрачный круг
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 12, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 🔹 Центральная точка "Компас" (север)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius - 5);
    ctx.lineTo(centerX, centerY - radius - 15);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = `${10 * (window.devicePixelRatio || 1)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, centerY - radius - 18);

    // ========================================================================
    // 🔹 Рисуем ЛИНИИ связей (пунктир)
    // ========================================================================
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    connections.forEach((conn, idx) => {
      const fromPanorama = projectPanoramas.find((p) => p.id === conn.from);
      const toPanorama = projectPanoramas.find((p) => p.id === conn.to);

      if (!fromPanorama || !toPanorama) return;

      const fromYaw = fromPanorama.yaw ?? fromPanorama.position_yaw ?? 0;
      const toYaw = toPanorama.yaw ?? toPanorama.position_yaw ?? 0;

      const fromPos = yawToCoords(fromYaw, radius, centerX, centerY);
      const toPos = yawToCoords(toYaw, radius, centerX, centerY);

      // Анимация "потока" по линии
      const offset = (Date.now() / 50 + idx * 10) % 10;
      ctx.lineDashOffset = -offset;

      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      ctx.lineTo(toPos.x, toPos.y);
      ctx.stroke();
    });

    ctx.setLineDash([]);

    // ========================================================================
    // 🔹 Рисуем ТОЧКИ панорам
    // ========================================================================
    projectPanoramas.forEach((panorama) => {
      const yaw = panorama.yaw ?? panorama.position_yaw ?? 0;
      const pos = yawToCoords(yaw, radius, centerX, centerY);
      
      const isCurrent = panorama.id === currentPanoramaId;
      const isHovered = hoveredPanorama === panorama.id;
      const isConnected = connections.some(c => c.to === panorama.id || c.from === panorama.id);

      // Радиус точки
      const baseRadius = 5;
      const pointRadius = isCurrent ? 9 : isHovered ? 7 : baseRadius;

      // 🔹 Внешнее свечение для текущей/наведённой
      if (isCurrent || isHovered) {
        const gradient = ctx.createRadialGradient(pos.x, pos.y, pointRadius, pos.x, pos.y, pointRadius + 12);
        gradient.addColorStop(0, isCurrent ? 'rgba(34, 197, 94, 0.4)' : 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pointRadius + 12, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // 🔹 Основная точка
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pointRadius, 0, 2 * Math.PI);
      ctx.fillStyle = isCurrent 
        ? '#22c55e'  // зелёная для текущей
        : isConnected 
          ? '#3b82f6'  // синяя для связанной
          : '#64748b'; // серая для изолированной
      ctx.fill();

      // 🔹 Обводка
      ctx.strokeStyle = isCurrent ? '#166534' : '#1e293b';
      ctx.lineWidth = isCurrent ? 3 : 2;
      ctx.stroke();

      // 🔹 Подпись названия (только для текущей или наведённой)
      if (isCurrent || isHovered) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `${11 * (window.devicePixelRatio || 1)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        const fullName = panorama.original_filename || panorama.filename || `Панорама #${panorama.id?.slice(0, 8)}`;
        const shortName = fullName.length > 18 ? fullName.substring(0, 15) + '…' : fullName;
        
        // Фон для текста
        const textWidth = ctx.measureText(shortName).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.roundRect?.(pos.x - textWidth/2 - 4, pos.y - pointRadius - 22, textWidth + 8, 18, 4);
        ctx.fill();
        
        // Текст
        ctx.fillStyle = '#f1f5f9';
        ctx.fillText(shortName, pos.x, pos.y - pointRadius - 8);
      }
    });

    // ========================================================================
    // 🔹 Пульсирующий эффект для текущей панорамы
    // ========================================================================
    if (currentPanoramaId) {
      const currentPanorama = projectPanoramas.find(p => p.id === currentPanoramaId);
      if (currentPanorama) {
        const yaw = currentPanorama.yaw ?? currentPanorama.position_yaw ?? 0;
        const pos = yawToCoords(yaw, radius, centerX, centerY);

        // Пульсация через sin
        const pulse = 8 + Math.sin(Date.now() / 300) * 4;
        
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulse, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(34, 197, 94, ${0.6 - Math.sin(Date.now() / 300) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // ========================================================================
    // 🔹 ОТЛАДКА: Визуализация "невидимых" панорам (без yaw)
    // ========================================================================
    if (debug) {
      projectPanoramas.forEach((p) => {
        const yaw = p.yaw ?? p.position_yaw;
        if (yaw === undefined || yaw === null || isNaN(yaw)) {
          // Рисуем красный крестик для панорам без координат
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(centerX - 10, centerY - 10);
          ctx.lineTo(centerX + 10, centerY + 10);
          ctx.moveTo(centerX + 10, centerY - 10);
          ctx.lineTo(centerX - 10, centerY + 10);
          ctx.stroke();
          
          ctx.fillStyle = '#ef4444';
          ctx.font = `${9 * (window.devicePixelRatio || 1)}px monospace`;
          ctx.fillText('no yaw', centerX, centerY + 25);
        }
      });
    }

  }, [dimensions, projectPanoramas, connections, currentPanoramaId, hoveredPanorama, yawToCoords, debug]);

  // ============================================================================
  // 🔹 Обработка клика по карте
  // ============================================================================
  const handleCanvasClick = useCallback((e) => {
    if (!canvasRef.current || !onPanoramaSelect) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const clickX = (e.clientX - rect.left) * dpr;
    const clickY = (e.clientY - rect.top) * dpr;

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    const clickThreshold = 18 * dpr; // радиус захвата клика

    let clickedPanorama = null;

    projectPanoramas.forEach((panorama) => {
      const yaw = panorama.yaw ?? panorama.position_yaw ?? 0;
      const pos = yawToCoords(yaw, radius, centerX, centerY);

      const distance = Math.sqrt(
        Math.pow(clickX - pos.x, 2) + Math.pow(clickY - pos.y, 2)
      );

      if (distance < clickThreshold && panorama.id !== currentPanoramaId) {
        clickedPanorama = panorama;
      }
    });

    if (clickedPanorama) {
      if (debug) {
        console.log('🖱️ Clicked panorama:', {
          id: clickedPanorama.id,
          filename: clickedPanorama.filename,
        });
      }
      onPanoramaSelect(clickedPanorama);
    }
  }, [dimensions, projectPanoramas, currentPanoramaId, onPanoramaSelect, yawToCoords, debug]);

  // ============================================================================
  // 🔹 Обработка наведения мыши
  // ============================================================================
  const handleCanvasMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const mouseX = (e.clientX - rect.left) * dpr;
    const mouseY = (e.clientY - rect.top) * dpr;

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    const hoverThreshold = 20 * dpr;

    let foundPanorama = null;

    projectPanoramas.forEach((panorama) => {
      const yaw = panorama.yaw ?? panorama.position_yaw ?? 0;
      const pos = yawToCoords(yaw, radius, centerX, centerY);

      const distance = Math.sqrt(
        Math.pow(mouseX - pos.x, 2) + Math.pow(mouseY - pos.y, 2)
      );

      if (distance < hoverThreshold) {
        foundPanorama = panorama.id;
      }
    });

    setHoveredPanorama(foundPanorama);
  }, [dimensions, projectPanoramas, yawToCoords]);

  const handleCanvasMouseLeave = () => {
    setHoveredPanorama(null);
  };

  // ============================================================================
  // 🔹 Статистика для отображения
  // ============================================================================
  const totalPanoramas = projectPanoramas.length;
  const totalConnections = connections.length;
  const connectedPanoramas = new Set(connections.flatMap(c => [c.from, c.to])).size;

  // ============================================================================
  // 🔹 Рендер компонента
  // ============================================================================
  return (
    <div className="mini-map-container" ref={containerRef}>
      {/* 🔹 Заголовок со статистикой */}
      <div className="mini-map-header">
        <div className="mini-map-title-wrapper">
          <span className="mini-map-icon">🗺️</span>
          <span className="mini-map-title">Карта переходов</span>
        </div>
        <div className="mini-map-stats">
          <span className="stat-badge">{totalPanoramas}</span>
          <span className="stat-label">панорам</span>
          <span className="stat-separator">•</span>
          <span className="stat-badge">{totalConnections}</span>
          <span className="stat-label">связей</span>
        </div>
      </div>

      {/* 🔹 Канвас с картой */}
      <div className="mini-map-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          className="mini-map-canvas"
          style={{
            width: dimensions.cssWidth || 200,
            height: dimensions.cssHeight || 200,
            cursor: onPanoramaSelect ? 'pointer' : 'default',
          }}
          aria-label="Интерактивная карта переходов между панорамами"
        />
        
        {/* 🔹 Индикатор отладки */}
        {debug && (
          <div className="mini-map-debug-badge">
            DEBUG
          </div>
        )}
      </div>

      {/* 🔹 Легенда */}
      <div className="mini-map-legend">
        <div className="legend-item">
          <span className="legend-dot legend-dot-current"></span>
          <span>Текущая панорама</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-connected"></span>
          <span>Есть переход</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-isolated"></span>
          <span>Нет связей</span>
        </div>
        <div className="legend-item">
          <span className="legend-line"></span>
          <span>Маршрут перехода</span>
        </div>
      </div>

      {/* 🔹 Список панорам (альтернативная навигация) */}
      <div className="mini-map-panorama-list">
        {projectPanoramas.length === 0 ? (
          <div className="mini-map-empty">
            <span className="empty-icon">📭</span>
            <p>Нет панорам</p>
          </div>
        ) : (
          projectPanoramas.map((panorama) => {
            const isCurrent = panorama.id === currentPanoramaId;
            const isConnected = connections.some(
              c => (c.from === panorama.id || c.to === panorama.id)
            );
            const hasNoYaw = (panorama.yaw ?? panorama.position_yaw) === undefined;

            return (
              <button
                key={panorama.id}
                onClick={() => !isCurrent && onPanoramaSelect?.(panorama)}
                className={`mini-map-list-item 
                  ${isCurrent ? 'current' : ''} 
                  ${!isCurrent && onPanoramaSelect ? 'clickable' : ''}
                  ${hasNoYaw ? 'no-coords' : ''}`}
                disabled={isCurrent || !onPanoramaSelect}
                title={
                  hasNoYaw 
                    ? '⚠️ Нет координат yaw — отображается в центре' 
                    : panorama.original_filename || panorama.filename || `Панорама ${panorama.id}`
                }
              >
                <span className={`list-item-dot 
                  ${isCurrent ? 'current' : isConnected ? 'connected' : 'isolated'}`} 
                />
                
                <span className="list-item-name">
                  {(panorama.original_filename || panorama.filename || `Панорама #${panorama.id?.slice(0, 8)}`).slice(0, 22)}
                  {(panorama.original_filename || panorama.filename || '').length > 22 ? '…' : ''}
                </span>
                
                {isCurrent && <span className="list-item-badge active">✓</span>}
                {hasNoYaw && <span className="list-item-badge warn">!</span>}
              </button>
            );
          })
        )}
      </div>

      {/* 🔹 Блок отладочной информации (виден только при debug=true) */}
      {debug && (
        <details className="mini-map-debug-panel">
          <summary>🔧 Отладочная информация</summary>
          <div className="debug-content">
            <p><strong>Связи найдены:</strong> {connections.length}</p>
            {connections.length > 0 && (
              <ul className="debug-connections">
                {connections.map((conn, i) => (
                  <li key={i}>
                    <code>{conn.from?.slice(0, 8)}</code> → 
                    <code>{conn.to?.slice(0, 8)}</code>
                    <small> via {conn.targetFilename?.slice(0, 20)}</small>
                  </li>
                ))}
              </ul>
            )}
            {connections.length === 0 && hotspots.length > 0 && (
              <p className="debug-warning">
                ⚠️ Хотспоты есть, но связи не найдены.<br/>
                Проверьте: <code>target_filename</code> в хотспотах совпадает с <code>filename</code> в панорамах?
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
};

export default MiniMapHotspots;