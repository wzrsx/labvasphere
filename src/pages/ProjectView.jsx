// src/pages/ProjectView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ProjectView.css';
import SphereViewer from '../components/SphereViewer';
import api from '../services/api';
import { CONFIG } from '../config';
import {
  getMainPanorama,
  getHotspots,
  getPanoramasByProject,
  toggleLike,
  getLikeStatus,
  incrementProjectViews,
} from '../services/projectService';
import { convertHotspotsToMarkers } from '../utils/hotspotUtils';
import { panoramaCache } from '../utils/panoramaCache';
import { getPublicProfile } from '../services/userService';

const ProjectView = ({ mode = 'public' }) => {
  const { id } = useParams();
  const isPublic = mode === 'public';
  const navigate = useNavigate();
  const sphereViewerRef = useRef(null);

  const [project, setProject] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [allPanoramas, setAllPanoramas] = useState([]);
  const [currentPanoramaId, setCurrentPanoramaId] = useState(null);
  const [currentPanoramaUrl, setCurrentPanoramaUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preloading, setPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState({}); // { url: percent }
  const [preloadStats, setPreloadStats] = useState({
    total: 0,
    loaded: 0,
    failed: 0,
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0); // ← ← ← ДОЛЖНО БЫТЬ ЗДЕСЬ!
  const [transitionError, setTransitionError] = useState(null);
  const [showAuthorCard, setShowAuthorCard] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(project?.likes_count || 0);
  const [authorData, setAuthorData] = useState(null); // Доп. данные автора
  const [authorLoading, setAuthorLoading] = useState(false); // Загрузка профиля
  const [authorError, setAuthorError] = useState(null); // Ошибка загрузки
  const getMediaUrl = (relativePath) => {
    if (!relativePath) return null;
    if (relativePath.startsWith('http')) return relativePath;
    return `${CONFIG.MEDIA_BASE_URL}/${relativePath}`;
  };
  const getRoleLabel = (roleCode) => {
    const labels = {
      designer: 'Дизайнер интерьера',
      architect: 'Архитектор',
      user: 'Пользователь',
      admin: 'Администратор',
    };
    return labels[roleCode] || 'Автор';
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
        const apiUrl = isPublic ? `/projects/public/${id}` : `/projects/${id}`;
        const response = await api.get(apiUrl);
        console.log('[ProjectView] ✅ Project loaded:', response.data?.id);
        const projectData = response.data;
        // 🔹 Инкремент счетчика просмотров (только для публичных проектов)
        if (isPublic && id) {
          // Проверяем, был ли уже учтен просмотр в этой сессии
          const viewedKey = `viewed_project_${id}`;
          const hasViewed = sessionStorage.getItem(viewedKey);

          if (!hasViewed) {
            console.log(
              '[ProjectView] 👁️ Incrementing view count for project:',
              id,
            );
            await incrementProjectViews(id);
            // Помечаем, что просмотр уже учтен в этой сессии
            sessionStorage.setItem(viewedKey, 'true');
          } else {
            console.log(
              '[ProjectView] ℹ️ View already counted for this session',
            );
          }
        }
        // 2. Загружаем основную панораму
        let mainPanorama = projectData.main_panorama;
        if (!mainPanorama) {
          console.log(
            '[ProjectView] 🔍 No main_panorama in project, fetching separately...',
          );
          const mainResult = await getMainPanorama(id);
          if (mainResult.success) {
            mainPanorama = mainResult.panorama;
            console.log(
              '[ProjectView] ✅ Main panorama fetched:',
              mainPanorama?.id,
            );
          }
        }

        setProject({ ...projectData, main_panorama: mainPanorama });
        // 🔹 Загружаем статус лайка текущего пользователя
        if (projectData.id) {
          const likeResult = await getLikeStatus(projectData.id);
          if (likeResult.success) {
            setIsLiked(likeResult.liked);
            setLikesCount(likeResult.likesCount); // ← счётчик из БД!
          }
        }
        // 🔹 3. ПРЕДЗАГРУЗКА ПРОФИЛЯ АВТОРА (фоновая, не блокирует рендер)
        if (projectData.author_id) {
          console.log(
            '[ProjectView] 👤 Preloading author profile:',
            projectData.author_id,
          );
          // Запускаем без await, чтобы не блокировать основной поток
          fetchAuthorProfile(projectData.author_id, true); // true = silent mode
        }
        // 4. Инициализируем текущую панораму
        if (mainPanorama?.id) {
          console.log(
            '[ProjectView] 🎯 Setting current panorama:',
            mainPanorama.id,
          );
          setCurrentPanoramaId(mainPanorama.id);

          const panoramaUrl = getMediaUrl(
            `projects/${projectData.id}/panoramas/${mainPanorama.filename}`,
          );
          console.log('[ProjectView] 🔗 Panorama URL:', panoramaUrl);
          setCurrentPanoramaUrl(panoramaUrl);

          // 🔹 Предзагружаем основную панораму в кэш
          try {
            await panoramaCache.preload(panoramaUrl);
          } catch (err) {
            console.warn(
              '[ProjectView] ⚠️ Failed to preload main panorama:',
              err,
            );
          }

          // 5. Загружаем хотспоты для текущей панорамы
          console.log(
            '[ProjectView] 📍 Loading hotspots for panorama:',
            mainPanorama.id,
          );
          await loadHotspots(mainPanorama.id, projectData.id);
        }

        // 6. Загружаем все панорамы проекта (для переходов + кэширования)
        console.log('[ProjectView] 📸 Fetching all project panoramas...');
        const panoramasResponse = await getPanoramasByProject(projectData.id);
        if (panoramasResponse.success) {
          setAllPanoramas(panoramasResponse.panoramas);
          console.log(
            '[ProjectView] ✅ Loaded',
            panoramasResponse.panoramas.length,
            'panoramas',
          );

          // 🔹 Предзагружаем ВСЕ панорамы проекта в кэш (фоновая загрузка)
          preloadAllPanoramas(panoramasResponse.panoramas, projectData.id);
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
  // 🔹 Предзагрузка всех панорам проекта в кэш
  const preloadAllPanoramas = async (panoramas, projectId) => {
    if (!panoramas?.length || !projectId) return;

    console.log(`[ProjectView] 🔄 Preloading ${panoramas.length} panoramas...`);
    setPreloading(true);
    setPreloadStats({ total: panoramas.length, loaded: 0, failed: 0 });

    const urls = panoramas
      .map((p) => getMediaUrl(`projects/${projectId}/panoramas/${p.filename}`))
      .filter((url) => url); // Убираем null/undefined

    try {
      const result = await panoramaCache.preloadMany(urls, (url, percent) => {
        // Обновляем прогресс для конкретного URL
        setPreloadProgress((prev) => ({ ...prev, [url]: percent }));
      });

      setPreloadStats({
        total: panoramas.length,
        loaded: result.successful,
        failed: result.failed,
      });

      console.log(
        `[ProjectView] ✅ Preload complete: ${result.successful}/${panoramas.length}`,
      );
    } catch (err) {
      console.error('[ProjectView] ❌ Preload error:', err);
    } finally {
      setPreloading(false);
    }
  };
  // 🔹 Загрузка хотспотов для указанной панорамы
  const loadHotspots = async (panoramaId, projectId) => {
    console.log('[ProjectView] 📍 loadHotspots called:', {
      panoramaId,
      projectId,
    });

    if (!panoramaId || !projectId) {
      console.warn(
        '[ProjectView] ⚠️ loadHotspots: missing panoramaId or projectId',
      );
      return;
    }

    try {
      const hotspotResponse = await getHotspots(panoramaId);
      console.log('[ProjectView] 🔹 getHotspots response:', {
        success: hotspotResponse?.success,
        count: hotspotResponse?.hotspots?.length,
      });

      if (hotspotResponse.success) {
        // 🔹 Конвертируем хотспоты из БД в формат редактора (с media_url!)
        const hotspots = hotspotResponse.hotspots.map((h) => {
          console.log('[ProjectView] 🎨 Converting hotspot:', {
            id: h?.id,
            media_url: h?.media_url,
            target_panorama_id: h?.target_panorama_id,
          });

          return {
            id: h.id,
            position: {
              yaw:
                typeof h.position_yaw === 'number'
                  ? h.position_yaw
                  : parseFloat(h.position_yaw) || 0,
              pitch:
                typeof h.position_pitch === 'number'
                  ? h.position_pitch
                  : parseFloat(h.position_pitch) || 0,
            },
            title: h.title || '',
            tooltip: h.tooltip || '',
            type: h.target_type === 'panorama' ? 'transition' : 'info',
            targetProjectId: h.target_panorama_id,
            targetFileUrl: h.target_filename
              ? getMediaUrl(
                  `projects/${projectId}/panoramas/${h.target_filename}`,
                )
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
        console.warn(
          '[ProjectView] ⚠️ Failed to load hotspots:',
          hotspotResponse.error,
        );
        setHotspots([]);
      }
    } catch (err) {
      console.error('[ProjectView] ❌ Error in loadHotspots:', err);
      setHotspots([]);
    }
  };

  // 🔹 Обновление маркеров после изменения хотспотов
  useEffect(() => {
    console.log(
      '[ProjectView] 🔁 useEffect: hotspots changed, count:',
      hotspots.length,
    );

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
      const markersPlugin =
        viewer.getPlugin?.('markers') || viewer.getPlugin?.('MarkersPlugin');
      if (markersPlugin && typeof markersPlugin.setMarkers === 'function') {
        console.log('[ProjectView] 🔄 Calling markersPlugin.setMarkers()');
        markersPlugin.setMarkers(hotspots);
      } else {
        console.warn(
          '[ProjectView] ⚠️ MarkersPlugin not found or setMarkers not available',
        );
      }
    } catch (err) {
      console.warn(
        '[ProjectView] ⚠️ Could not update markers via plugin:',
        err,
      );
    }
  }, [hotspots]);

  // 🔹 Обработка клика по хотспоту
  const handleHotspotClick = async (hotspot) => {
    console.log('[ProjectView] 👆 Hotspot clicked:', {
      id: hotspot?.id,
      type: hotspot?.type, // ← ← ← ИСПРАВЛЕНО: не .data?.type
      targetFileUrl: hotspot?.targetFileUrl,
      targetProjectId: hotspot?.targetProjectId,
      media_url: hotspot?.media_url,
    });

    // 🔹 ИСПРАВЛЕНО: обращаемся к свойствам напрямую, не через .data
    if (hotspot?.type === 'transition' && hotspot?.targetFileUrl) {
      console.log('[ProjectView] 🔄 Transition hotspot, navigating...');

      await handlePanoramaTransition(
        hotspot.targetFileUrl, // ← не .data.targetFileUrl
        hotspot.targetProjectName || 'Панорама', // ← не .data.targetProjectName
        hotspot.targetProjectId, // ← ← ← КЛЮЧЕВОЕ: не .data.targetProjectId
      );
    } else if (hotspot?.type === 'link' && hotspot?.external_url) {
      console.log(
        '[ProjectView] 🔗 Opening external link:',
        hotspot.external_url,
      );
      window.open(hotspot.external_url, '_blank');
    } else {
      console.log('[ProjectView] ℹ️ Info hotspot clicked (no action)');
    }
  };

  // 🔹 Переход к другой панораме (с использованием кэша)
  const handlePanoramaTransition = async (
    targetUrl,
    targetName,
    targetPanoramaId,
  ) => {
    console.log('[ProjectView] 🔄 handlePanoramaTransition called:', {
      targetUrl,
      targetName,
      targetPanoramaId,
    });

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
      // 🔹 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Очищаем хотспоты ДО начала перехода!
      // Это предотвратит отображение старых маркеров на новой панораме
      setHotspots([]);

      // 🔹 ПРОВЕРКА КЭША
      const cachedImage = panoramaCache.get(absoluteUrl);
      console.log('[ProjectView] 🗃️ Cache check:', {
        url: absoluteUrl,
        cached: !!cachedImage,
        isComplete: cachedImage?.complete,
        naturalWidth: cachedImage?.naturalWidth,
      });
      if (!cachedImage) {
        console.log('[ProjectView] 📥 Cache miss, loading...');
        await panoramaCache.preload(absoluteUrl, (url, percent) => {
          setTransitionProgress(percent);
        });
      } else {
        console.log('[ProjectView] ⚡ Cache hit!');
      }

      // 🔹 Сначала меняем панораму в SphereViewer
      console.log('[ProjectView] 🎬 Calling changePanorama()...');
      await sphereViewerRef.current?.changePanorama(absoluteUrl, {
        transition: 'fade',
        duration: 800,
      });
      console.log('[ProjectView] ✅ Panorama changed');

      // 🔹 Обновляем ID и URL текущей панорамы
      if (targetPanoramaId && project?.id) {
        console.log(
          '[ProjectView] 🔄 Updating current panorama to:',
          targetPanoramaId,
        );
        setCurrentPanoramaId(targetPanoramaId);
        setCurrentPanoramaUrl(absoluteUrl);

        // 🔹 Загружаем хотспоты НОВОЙ панорамы (они появятся плавно после загрузки)
        await loadHotspots(targetPanoramaId, project.id);
      }

      setIsTransitioning(false);
      setTransitionProgress(0);
    } catch (err) {
      console.error('[ProjectView] ❌ Transition error:', err);
      setError(err.message || 'Ошибка загрузки панорамы');
      setIsTransitioning(false);
      setTransitionProgress(0);
      // 🔹 В случае ошибки тоже очищаем хотспоты, чтобы не было рассинхрона
      setHotspots([]);
    }
  };
  // 🔹 Загрузка профиля автора (с опцией silent для фоновой загрузки)
  const fetchAuthorProfile = async (authorId, silent = false) => {
    if (!authorId) return;

    // Если данные уже есть — не загружаем повторно
    if (authorData?.id === authorId) return;

    if (!silent) {
      setAuthorLoading(true);
      setAuthorError(null);
    }

    try {
      const result = await getPublicProfile(authorId);
      if (result.success) {
        setAuthorData(result.user);
        if (!silent) console.log('[ProjectView] ✅ Author profile loaded');
      } else {
        if (!silent) setAuthorError(result.error);
        console.warn('[ProjectView] ⚠️ Author profile error:', result.error);
      }
    } catch (err) {
      if (!silent) {
        console.error('Error fetching author profile:', err);
        setAuthorError('Не удалось загрузить данные автора');
      }
    } finally {
      if (!silent) setAuthorLoading(false);
    }
  };
  const handleAuthorToggle = () => {
    setShowAuthorCard(!showAuthorCard);
  };
  const handleLike = async (e) => {
    e.stopPropagation();

    // 🔹 ПРОВЕРКА: есть ли токен авторизации?
    const token = localStorage.getItem('token');
    console.log('TOKEN: ', token);
    if (!token) {
      // 🔹 Редирект на авторизацию с возвратом на текущую страницу
      const redirect = `/project/public/${id}`;
      window.location.href = `/auth?redirect=${encodeURIComponent(redirect)}`;
      return;
    }

    // 🔹 Оптимистичное обновление UI (для мгновенного отклика)
    const previousLiked = isLiked;
    const previousCount = likesCount;

    setIsLiked(!isLiked);
    setLikesCount((prev) => (isLiked ? prev - 1 : prev + 1));

    try {
      const result = await toggleLike(id); // ← API-запрос

      if (result.success) {
        // Синхронизируем с ответом сервера
        setIsLiked(result.liked);
        setLikesCount(result.likesCount);
        console.log('[ProjectView] ❤️ Like toggled:', result);
      } else {
        // Откат при ошибке
        setIsLiked(previousLiked);
        setLikesCount(previousCount);

        // Если 401 — редирект на логин
        if (
          result.error?.includes('авторизация') ||
          result.error?.includes('токен')
        ) {
          localStorage.removeItem('auth_token');
          const redirect = `/projects/public/${id}`;
          window.location.href = `/auth?redirect=${encodeURIComponent(redirect)}`;
        } else {
          console.warn('[ProjectView] ⚠️ Like error:', result.error);
        }
      }
    } catch (err) {
      // Откат при сетевой ошибке
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      console.error('[ProjectView] ❌ Like failed:', err);
    }
  };

  // 🔹 Обработчик сохранения в избранное
  const handleSave = async (e) => {
    e.stopPropagation();
    try {
      // TODO: API-запрос
      // await api.post(`/projects/${id}/save`);
      setIsSaved(!isSaved);
    } catch (err) {
      console.error('Error toggling save:', err);
    }
  };

  // 🔹 Закрытие карточки автора при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showAuthorCard && !e.target.closest('.author-profile-container')) {
        setShowAuthorCard(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showAuthorCard]);
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
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <span>Назад</span>
      </button>

      {/* 🔹 Заголовок проекта — плавающий */}
      <div className="project-title-overlay">
        <h1>{project.title}</h1>
      </div>

      {/* 🔹 SphereViewer на весь экран */}
      <div className="panorama-container-fullscreen">
        <SphereViewer
          ref={sphereViewerRef}
          src={currentPanoramaUrl}
          hotspots={hotspots}
          onHotspotClick={handleHotspotClick}
          autoRotate={false}
          navbar={false}
        />
      </div>

      {/* 🔹 Оверлей перехода 
      {isTransitioning && (
        <div className="transition-overlay-fullscreen">
          <div className="transition-spinner">
            <div className="spinner-ring" />
          </div>
          <p>Загрузка панорамы...</p>
        </div>
      )}*/}
      {/* 🔹 Левый нижний угол: Лайк и Избранное */}
      <div className="actions-bar">
        <button
          className={`action-btn ${isLiked ? 'liked' : ''}`}
          onClick={handleLike}
          title={isLiked ? 'Убрать лайк' : 'Нравится'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isLiked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span className="action-count">{likesCount}</span>
        </button>

        <button
          className={`action-btn ${isSaved ? 'saved' : ''}`}
          onClick={handleSave}
          title={isSaved ? 'Убрать из избранного' : 'Сохранить'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isSaved ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      {/* 🔹 Правый нижний угол: Профиль автора */}
      <div className="author-profile-container">
        <button
          className="author-trigger"
          onClick={() => setShowAuthorCard(!showAuthorCard)}
          title="Об авторе"
        >
          <div className="author-avatar">
            {project?.author_avatar ? (
              <img
                src={getMediaUrl(project.author_avatar)}
                alt={project.author_name}
              />
            ) : (
              <span>
                {project?.author_name?.charAt(0)?.toUpperCase() || 'A'}
              </span>
            )}
          </div>
          <span className="author-name-short">
            {authorData?.full_name?.split(' ')[0]}
          </span>
        </button>

        {/* Выпадающая карточка */}
        {showAuthorCard && (
          <div className="author-card">
            <div className="author-card-header">
              <div className="author-avatar-large">
                {authorData?.avatar_url || project?.author_avatar ? (
                  <img
                    src={getMediaUrl(
                      authorData?.avatar_url || project.author_avatar,
                    )}
                    alt={authorData?.full_name || project?.author_name}
                  />
                ) : (
                  <span>
                    {(authorData?.full_name || project?.author_name)
                      ?.charAt(0)
                      ?.toUpperCase() || 'A'}
                  </span>
                )}
              </div>
              <div>
                <h4 className="author-full-name">
                  {authorData?.full_name || project?.author_name || 'Автор'}
                </h4>
                <p className="author-role">
                  {getRoleLabel(authorData?.role || project?.author_role)}
                </p>
              </div>
            </div>

            {authorLoading && !authorData && (
              <div className="author-loading">
                <div className="mini-spinner" />
                <span>Загрузка данных...</span>
              </div>
            )}

            {authorError && !authorData && (
              <p className="author-error">{authorError}</p>
            )}

            {(!authorLoading || authorData) && !authorError && (
              <>
                {(authorData?.bio || project?.author_bio) && (
                  <p className="author-bio">
                    {authorData?.bio || project.author_bio}
                  </p>
                )}

                <div className="author-actions">
                  <a
                    href={`mailto:${authorData?.email || project?.author_email}`}
                    className="author-contact-btn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Написать
                  </a>
                  {(authorData?.portfolio_url ||
                    project?.author_portfolio_url) && (
                    <a
                      href={
                        authorData?.portfolio_url ||
                        project.author_portfolio_url
                      }
                      className="author-portfolio-btn"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      Портфолио
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectView;
