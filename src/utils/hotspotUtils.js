// src/utils/hotspotUtils.js
import { CONFIG } from '../config';
import { getHotspots } from '../services/projectService';
/**
 * Конвертирует хотспот из формата БД в формат редактора
 * @param {Object} h - Хотспот из API
 * @param {string} projectId - ID проекта для формирования URL
 * @returns {Object} - Хотспот в формате редактора
 */
export const convertHotspotToEditor = (h, projectId) => {
  return {
    id: h.id,
    position: {
      yaw: typeof h.position_yaw === 'number' 
        ? h.position_yaw 
        : parseFloat(h.position_yaw) || 0,
      pitch: typeof h.position_pitch === 'number' 
        ? h.position_pitch 
        : parseFloat(h.position_pitch) || 0,
    },
    title: h.title || '',
    tooltip: h.tooltip || '',
    type: h.target_type === 'panorama' ? 'transition' : 'info',
    targetProjectId: h.target_panorama_id,
    targetFileUrl: h.target_filename
      ? `${CONFIG.MEDIA_BASE_URL}/projects/${projectId}/panoramas/${h.target_filename}`
      : null,
    targetProjectName: h.target_filename || 'Панорама',
    targetFilename: h.target_filename,
    icon: h.icon,
    color: h.color,
    media_url: h.media_url || '',
    content_text: h.content_text || '',
    external_url: h.external_url || '',
    is_active: h.is_active !== undefined ? h.is_active : true,
    // Сохраняем сырые данные для отладки
    _raw: h,
  };
};

/**
 * Конвертирует хотспот из формата редактора в формат для SphereViewer
 * @param {Object} hotspot - Хотспот из редактора
 * @returns {Object} - Маркер для photo-sphere-viewer
 */
export const convertHotspotToMarker = (hotspot) => {
  // 🔹 Определяем URL изображения маркера
  const isCustomImage = hotspot.media_url && hotspot.media_url.trim() !== '';
  const iconUrl = isCustomImage
    ? `${CONFIG.MEDIA_BASE_URL}/${hotspot.media_url}`
    : !hotspot.icon || hotspot.icon === 'default'
      ? '/finger-32.svg'
      : hotspot.icon;

  return {
    id: hotspot.id,
    position: hotspot.position,
    image: iconUrl,
    size: { width: 32, height: 32 },
    tooltip: hotspot.tooltip 
      ? { content: hotspot.tooltip, position: 'top' } 
      : { content: hotspot.title || 'Точка перехода', position: 'top' },
    style: { 
      cursor: 'pointer', 
      transition: 'transform 0.2s',
    },
    className: isCustomImage ? 'hotspot-custom-image' : 'hotspot-default',
    data: { ...hotspot },
  };
};

/**
 * Загружает и конвертирует хотспоты для указанной панорамы
 * @param {string} panoramaId - ID панорамы
 * @param {string} projectId - ID проекта
 * @returns {Promise<Object>} - { success: boolean, hotspots: Array, error?: string }
 */
export const loadHotspotsForPanorama = async (panoramaId, projectId) => {
  // 🔹 1. Лог входа в функцию
  console.log('[hotspotUtils] 🚀 loadHotspotsForPanorama called:', {
    panoramaId,
    projectId,
    timestamp: new Date().toISOString()
  });
  
  // 🔹 2. Валидация параметров
  if (!panoramaId || !projectId) {
    console.warn('[hotspotUtils] ⚠️ Validation failed:', {
      panoramaId: panoramaId || 'MISSING',
      projectId: projectId || 'MISSING'
    });
    return { 
      success: false, 
      error: 'panoramaId и projectId обязательны', 
      hotspots: [] 
    };
  }

  try {
    // 🔹 3. Перед вызовом API
    console.log('[hotspotUtils] 📡 Calling getHotspots API for panorama:', panoramaId);
    
    const response = await getHotspots(panoramaId);
    
    // 🔹 4. Лог ответа от API
    console.log('[hotspotUtils] 🔹 API response:', {
      success: response?.success,
      error: response?.error,
      hotspotsCount: response?.hotspots?.length || 0,
      rawHotspots: response?.hotspots?.map(h => ({
        id: h?.id,
        title: h?.title,
        hasMediaUrl: !!h?.media_url,
        targetPanoramaId: h?.target_panorama_id
      }))
    });
    
    // 🔹 5. Проверка успеха
    if (!response?.success) {
      console.warn('[hotspotUtils] ⚠️ API returned error:', response?.error);
      return { 
        success: false, 
        error: response?.error || 'Неизвестная ошибка', 
        hotspots: [] 
      };
    }

    // 🔹 6. Конвертация хотспотов
    console.log('[hotspotUtils] 🎨 Converting hotspots to editor format...');
    
    const editorHotspots = (response.hotspots || []).map((h, index) => {
      const converted = convertHotspotToEditor(h, projectId);
      
      // Лог каждой конвертации (только первые 5, чтобы не засорять консоль)
      if (index < 5) {
        console.log(`[hotspotUtils] 🎨 Converted hotspot #${index + 1}:`, {
          id: converted?.id,
          title: converted?.title,
          type: converted?.type,
          hasMediaUrl: !!converted?.media_url,
          targetProjectId: converted?.targetProjectId,
          position: converted?.position
        });
      }
      
      return converted;
    });

    // 🔹 7. Итоговый лог
    console.log('[hotspotUtils] ✅ Successfully loaded and converted hotspots:', {
      total: editorHotspots.length,
      withMediaUrl: editorHotspots.filter(h => h.media_url).length,
      transitions: editorHotspots.filter(h => h.type === 'transition').length,
      info: editorHotspots.filter(h => h.type === 'info').length
    });
    
    return { success: true, hotspots: editorHotspots };
    
  } catch (err) {
    // 🔹 8. Обработка ошибок
    console.error('[hotspotUtils] ❌ Error in loadHotspotsForPanorama:', {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
      panoramaId,
      projectId
    });
    
    return { 
      success: false, 
      error: err?.message || 'Ошибка загрузки хотспотов', 
      hotspots: [] 
    };
  }
};
/**
 * Конвертирует массив хотспотов в маркеры для SphereViewer
 * @param {Array} hotspots - Массив хотспотов в формате редактора
 * @returns {Array} - Массив маркеров для photo-sphere-viewer
 */
export const convertHotspotsToMarkers = (hotspots) => {
  if (!Array.isArray(hotspots)) return [];
  return hotspots.map(convertHotspotToMarker);
};

/**
 * Подготовка данных хотспота для отправки на сервер
 * @param {Object} hotspot - Хотспот из редактора
 * @param {string} panoramaId - ID текущей панорамы
 * @returns {Object} - Данные для API
 */
export const prepareHotspotForApi = (hotspot, panoramaId) => {
  const parseCoord = (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/[^\d.\-]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  return {
    panorama_id: panoramaId,
    position_yaw: parseCoord(hotspot.position?.yaw),
    position_pitch: parseCoord(hotspot.position?.pitch),
    target_type: hotspot.type === 'transition' ? 'panorama' : 'info',
    target_panorama_id: hotspot.targetProjectId || null,
    target_filename: hotspot.targetFilename || null,
    title: hotspot.title || null,
    tooltip: hotspot.tooltip || null,
    content_text: hotspot.content_text || null,
    media_url: hotspot.media_url || null,
    external_url: hotspot.external_url || null,
    icon: hotspot.icon || 'default',
    color: hotspot.color || '#3498db',
    is_active: hotspot.is_active !== undefined ? hotspot.is_active : true,
  };
};