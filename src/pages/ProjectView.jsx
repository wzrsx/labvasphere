// src/pages/ProjectView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ProjectView.css';
import SphereViewer from '../components/SphereViewer';
import api from '../services/api';
import { CONFIG } from '../config';
import { getMainPanorama, getHotspots, getPanoramasByProject } from '../services/projectService';
import { convertHotspotsToMarkers } from '../utils/hotspotUtils';

const ProjectView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const sphereViewerRef = useRef(null);
  
  const [project, setProject] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [allPanoramas, setAllPanoramas] = useState([]);
  const [currentPanoramaId, setCurrentPanoramaId] = useState(null);
  const [currentPanoramaUrl, setCurrentPanoramaUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const getMediaUrl = (relativePath) => {
    if (!relativePath) return null;
    if (relativePath.startsWith('http')) return relativePath;
    return `${CONFIG.MEDIA_BASE_URL}/${relativePath}`;
  };

  // 🔹 Загрузка проекта + панорамы + хотспотов
  useEffect(() => {
    console.log('[ProjectView] 🚀 Component mounted, project ID:', id);
    
    const fetchProject = async () => {
      try {
        console.log('[ProjectView] 📡 Fetching project data...');
        setLoading(true);
        setError(null);
        
        // 1. Загружаем проект
        const response = await api.get(`/projects/${id}`);
        console.log('[ProjectView] ✅ Project loaded:', response.data?.id);
        const projectData = response.data;

        // 2. Загружаем основную панораму
        let mainPanorama = projectData.main_panorama;
        if (!mainPanorama) {
          console.log('[ProjectView] 🔍 No main_panorama in project, fetching separately...');
          const mainResult = await getMainPanorama(id);
          if (mainResult.success) {
            mainPanorama = mainResult.panorama;
            console.log('[ProjectView] ✅ Main panorama fetched:', mainPanorama?.id);
          }
        }

        setProject({ ...projectData, main_panorama: mainPanorama });
        
        // 3. Инициализируем текущую панораму
        if (mainPanorama?.id) {
          console.log('[ProjectView] 🎯 Setting current panorama:', mainPanorama.id);
          setCurrentPanoramaId(mainPanorama.id);
          
          const panoramaUrl = getMediaUrl(
            `projects/${projectData.id}/panoramas/${mainPanorama.filename}`
          );
          console.log('[ProjectView] 🔗 Panorama URL:', panoramaUrl);
          setCurrentPanoramaUrl(panoramaUrl);
          
          // 4. Загружаем хотспоты для текущей панорамы
          console.log('[ProjectView] 📍 Loading hotspots for panorama:', mainPanorama.id);
          await loadHotspots(mainPanorama.id, projectData.id);
        }
        
        // 5. Загружаем все панорамы проекта (для переходов)
        console.log('[ProjectView] 📸 Fetching all project panoramas...');
        const panoramasResponse = await getPanoramasByProject(projectData.id);
        if (panoramasResponse.success) {
          setAllPanoramas(panoramasResponse.panoramas);
          console.log('[ProjectView] ✅ Loaded', panoramasResponse.panoramas.length, 'panoramas');
        }
      } catch (err) {
        console.error('[ProjectView] ❌ Error fetching project:', err);
        const message = err.response?.data?.error || 'Проект не найден';
        setError(message);
      } finally {
        console.log('[ProjectView] 🏁 Loading finished');
        setLoading(false);
      }
    };

    if (id) fetchProject();
  }, [id]);

  // 🔹 Загрузка хотспотов для указанной панорамы
  const loadHotspots = async (panoramaId, projectId) => {
    console.log('[ProjectView] 📍 loadHotspots called:', { panoramaId, projectId });
    
    if (!panoramaId || !projectId) {
      console.warn('[ProjectView] ⚠️ loadHotspots: missing panoramaId or projectId');
      return;
    }
    
    try {
      const hotspotResponse = await getHotspots(panoramaId);
      console.log('[ProjectView] 🔹 getHotspots response:', {
        success: hotspotResponse?.success,
        count: hotspotResponse?.hotspots?.length
      });
      
      if (hotspotResponse.success) {
        // 🔹 Конвертируем хотспоты из БД в формат редактора (с media_url!)
        const hotspots = hotspotResponse.hotspots.map(h => {
          console.log('[ProjectView] 🎨 Converting hotspot:', {
            id: h?.id,
            media_url: h?.media_url,
            target_panorama_id: h?.target_panorama_id
          });
          
          return {
            id: h.id,
            position: {
              yaw: typeof h.position_yaw === 'number' ? h.position_yaw : parseFloat(h.position_yaw) || 0,
              pitch: typeof h.position_pitch === 'number' ? h.position_pitch : parseFloat(h.position_pitch) || 0,
            },
            title: h.title || '',
            tooltip: h.tooltip || '',
            type: h.target_type === 'panorama' ? 'transition' : 'info',
            targetProjectId: h.target_panorama_id,
            targetFileUrl: h.target_filename
              ? getMediaUrl(`projects/${projectId}/panoramas/${h.target_filename}`)
              : null,
            targetProjectName: h.target_filename || 'Панорама',
            icon: h.icon,
            color: h.color,
            // 🔹 КЛЮЧЕВОЕ: добавляем media_url!
            media_url: h.media_url || '',
            content_text: h.content_text || '',
            external_url: h.external_url || '',
          };
        });

        setHotspots(hotspots);
      } else {
        console.warn('[ProjectView] ⚠️ Failed to load hotspots:', hotspotResponse.error);
        setHotspots([]);
      }
    } catch (err) {
      console.error('[ProjectView] ❌ Error in loadHotspots:', err);
      setHotspots([]);
    }
  };

  // 🔹 Обновление маркеров после изменения хотспотов
  useEffect(() => {
    console.log('[ProjectView] 🔁 useEffect: hotspots changed, count:', hotspots.length);
    
    if (!sphereViewerRef.current) {
      console.log('[ProjectView] ⏳ sphereViewerRef not ready yet');
      return;
    }
    
    if (!hotspots?.length) {
      console.log('[ProjectView] ℹ️ No hotspots to update');
      return;
    }
    
    // Если у SphereViewer есть метод обновления маркеров
    if (typeof sphereViewerRef.current.updateHotspots === 'function') {
      console.log('[ProjectView] 🔄 Calling updateHotspots()');
      sphereViewerRef.current.updateHotspots(hotspots);
      return;
    }
    
    // Если используется photo-sphere-viewer с плагином
    try {
      const viewer = sphereViewerRef.current;
      const markersPlugin = viewer.getPlugin?.('markers') || viewer.getPlugin?.('MarkersPlugin');
      if (markersPlugin && typeof markersPlugin.setMarkers === 'function') {
        console.log('[ProjectView] 🔄 Calling markersPlugin.setMarkers()');
        markersPlugin.setMarkers(hotspots);
      } else {
        console.warn('[ProjectView] ⚠️ MarkersPlugin not found or setMarkers not available');
      }
    } catch (err) {
      console.warn('[ProjectView] ⚠️ Could not update markers via plugin:', err);
    }
  }, [hotspots]);

  // 🔹 Обработка клика по хотспоту
  const handleHotspotClick = async (hotspot) => {
  console.log('[ProjectView] 👆 Hotspot clicked:', {
    id: hotspot?.id,
    type: hotspot?.type,  // ← ← ← ИСПРАВЛЕНО: не .data?.type
    targetFileUrl: hotspot?.targetFileUrl,
    targetProjectId: hotspot?.targetProjectId,
    media_url: hotspot?.media_url,
  });
  
  // 🔹 ИСПРАВЛЕНО: обращаемся к свойствам напрямую, не через .data
  if (hotspot?.type === 'transition' && hotspot?.targetFileUrl) {
    console.log('[ProjectView] 🔄 Transition hotspot, navigating...');
    
    await handlePanoramaTransition(
      hotspot.targetFileUrl,              // ← не .data.targetFileUrl
      hotspot.targetProjectName || 'Панорама',  // ← не .data.targetProjectName
      hotspot.targetProjectId           // ← ← ← КЛЮЧЕВОЕ: не .data.targetProjectId
    );
  } else if (hotspot?.type === 'link' && hotspot?.external_url) {
    console.log('[ProjectView] 🔗 Opening external link:', hotspot.external_url);
    window.open(hotspot.external_url, '_blank');
  } else {
    console.log('[ProjectView] ℹ️ Info hotspot clicked (no action)');
  }
};

  // 🔹 Переход к другой панораме
  const handlePanoramaTransition = async (targetUrl, targetName, targetPanoramaId) => {
    console.log('[ProjectView] 🔄 handlePanoramaTransition called:', { targetUrl, targetName, targetPanoramaId });
    
    if (!targetUrl) {
      console.error('[ProjectView] ❌ No targetUrl provided');
      setError('Не указан URL панорамы');
      return;
    }

    let absoluteUrl = targetUrl;
    if (!targetUrl.startsWith('http')) {
      absoluteUrl = `${CONFIG.MEDIA_BASE_URL}/${targetUrl}`;
    }
    console.log('[ProjectView] 🔗 Absolute URL:', absoluteUrl);

    console.log('[ProjectView] ⏳ Starting transition...');
    setIsTransitioning(true);

    try {
      // Предзагрузка изображения
      console.log('[ProjectView] 🖼️ Preloading image...');
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          console.log('[ProjectView] ✅ Image preloaded successfully');
          resolve();
        };
        img.onerror = (err) => {
          console.error('[ProjectView] ❌ Image preload failed:', err);
          reject(new Error('Не удалось загрузить изображение'));
        };
        img.src = absoluteUrl + '?t=' + Date.now();
      });

      // Переход через SphereViewer
      console.log('[ProjectView] 🎬 Calling changePanorama()...');
      await sphereViewerRef.current?.changePanorama(absoluteUrl, {
        transition: 'fade',
        duration: 800
      });
      console.log('[ProjectView] ✅ Panorama changed');
      
      // Обновляем текущую панораму и загружаем её хотспоты
      if (targetPanoramaId && project?.id) {
        console.log('[ProjectView] 🔄 Updating current panorama to:', targetPanoramaId);
        setCurrentPanoramaId(targetPanoramaId);
        setCurrentPanoramaUrl(absoluteUrl);
        
        // 🔹 Загружаем хотспоты новой панорамы (с projectId!)
        await loadHotspots(targetPanoramaId, project.id);
      }

      setTimeout(() => {
        console.log('[ProjectView] 🏁 Transition finished');
        setIsTransitioning(false);
      }, 300);
    } catch (err) {
      console.error('[ProjectView] ❌ Transition error:', err);
      setError(err.message || 'Ошибка загрузки панорамы');
      setIsTransitioning(false);
    }
  };

  // 🔹 Обработчик нажатия клавиш (Esc для выхода)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        console.log('[ProjectView] ⌨️ Escape pressed, navigating back');
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // 🔹 Отладочный лог при рендере
  useEffect(() => {
    console.log('[ProjectView] 🎨 Render:', {
      loading,
      error,
      hasProject: !!project,
      hasPanoramaUrl: !!currentPanoramaUrl,
      hotspotsCount: hotspots.length,
    });
  }, [loading, error, project, currentPanoramaUrl, hotspots]);

  if (loading) {
    return (
      <div className="project-view-loading">
        <div className="loader">
          <div className="spinner"></div>
          <p>Загрузка проекта...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-view-error">
        <div className="error-message">
          <h2>⚠️ {error}</h2>
          <button onClick={() => navigate(-1)}>Вернуться назад</button>
        </div>
      </div>
    );
  }

  if (!project || !currentPanoramaUrl) {
    return (
      <div className="project-view-not-found">
        <h2>Проект не найден</h2>
        <button onClick={() => navigate('/projects')}>К списку проектов</button>
      </div>
    );
  }

  return (
    <div className="project-view-fullscreen">
      
      {/* 🔹 Кнопка назад — левый верхний угол */}
      <button 
        className="back-btn-fixed" 
        onClick={() => navigate(-1)}
        title="Назад (Esc)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        <span>Назад</span>
      </button>

      {/* 🔹 Заголовок проекта — плавающий */}
      <div className="project-title-overlay">
        <h1>{project.title}</h1>
        {project.author_name && (
          <p className="author-name">Автор: {project.author_name}</p>
        )}
      </div>

      {/* 🔹 SphereViewer на весь экран */}
      <div className="panorama-container-fullscreen">
        <SphereViewer
          key={`viewer-${currentPanoramaId}-${hotspots.length}`}  // ✅ Ключ для пересоздания
          ref={sphereViewerRef}
          src={currentPanoramaUrl}
          hotspots={hotspots}
          onHotspotClick={handleHotspotClick}
          autoRotate={false}
          navbar={true}
        />
      </div>

      {/* 🔹 Оверлей перехода */}
      {isTransitioning && (
        <div className="transition-overlay-fullscreen">
          <div className="transition-spinner">
            <div className="spinner-ring" />
          </div>
          <p>Загрузка панорамы...</p>
        </div>
      )}
    </div>
  );
};

export default ProjectView;