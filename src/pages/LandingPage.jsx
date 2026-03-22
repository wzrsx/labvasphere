import React, { useState, useEffect, useRef, useCallback } from 'react';
import SphereViewer from '../components/SphereViewer';
import { getPublishedProjects } from '../services/projectService';
import { preloadPanorama } from '../services/preload.js';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api'; // Добавили импорт api, если понадобится для доп. запросов
import { CONFIG } from '../config'; // Добавили импорт конфига
import '../App.css';
import './LandingPage.css';

const PRELOAD_AHEAD = 3;
const TRANSITION_DURATION = 700;

const LandingPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [initialLoading, setInitialLoading] = useState(true);
  const [preloading, setPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);

  const [error, setError] = useState(null);

  // Refs
  const viewerRef = useRef(null);
  const preloadedUrls = useRef(new Set());
  const currentIndexRef = useRef(0);
  const autoSwitchTimerRef = useRef(null);

  // 🔹 1. Функция формирования URL (как в ProjectView)
  const getMediaUrl = (relativePath) => {
    if (!relativePath) return null;
    if (relativePath.startsWith('http')) return relativePath;
    return `${CONFIG.MEDIA_BASE_URL}/${relativePath}`;
  };

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const handleAuthPage = (projectId) => {
    navigate(`/auth`);
  };

  // 2. Загрузка списка проектов
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setInitialLoading(true);
        const result = await getPublishedProjects(10, 0);

        if (result.success && result.projects?.length > 0) {
          setProjects(result.projects);
          // Префетчинг для первого элемента
          handlePreloadForIndex(0, result.projects);
        } else {
          setError(result.error || 'Нет проектов');
        }
      } catch (err) {
        setError('Ошибка сети');
        console.error(err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // 3. Логика предзагрузки (обновлена для работы с новым URL)
  const handlePreloadForIndex = useCallback(
    (index, projectsList) => {
      if (!projectsList || projectsList.length === 0) return;

      const indicesToPreload = [];
      for (let i = 0; i < PRELOAD_AHEAD + 1; i++) {
        const targetIdx = (index + i) % projectsList.length;
        const project = projectsList[targetIdx];

        // 🔹 Формируем URL так же, как для отображения
        let urlToPreload = null;
        if (project.main_panorama?.filename) {
          urlToPreload = getMediaUrl(
            `projects/${project.id}/panoramas/${project.main_panorama.filename}`,
          );
        } else if (project.panorama_url) {
          // Фолбэк, если вдруг есть прямая ссылка
          urlToPreload = project.panorama_url;
        }

        if (urlToPreload && !preloadedUrls.current.has(urlToPreload)) {
          indicesToPreload.push({ idx: targetIdx, url: urlToPreload });
        }
      }

      if (indicesToPreload.length === 0) return;

      setPreloading(true);
      let completed = 0;
      const total = indicesToPreload.length;

      indicesToPreload.forEach(({ url }) => {
        preloadPanorama(url)
          .then(() => {
            preloadedUrls.current.add(url);
            completed++;
            setPreloadProgress(Math.round((completed / total) * 100));
          })
          .catch((err) => {
            console.warn(`Preload failed for ${url}`, err);
            completed++;
            setPreloadProgress(Math.round((completed / total) * 100));
          })
          .finally(() => {
            if (completed === total) {
              setPreloading(false);
            }
          });
      });
    },
    [getMediaUrl],
  ); // Добавили зависимость

  useEffect(() => {
    if (projects.length > 0) {
      handlePreloadForIndex(currentIndex, projects);
    }
  }, [currentIndex, projects, handlePreloadForIndex]);

  // 4. Автопереключение
  useEffect(() => {
    if (projects.length === 0) return;

    if (autoSwitchTimerRef.current) {
      clearInterval(autoSwitchTimerRef.current);
    }

    autoSwitchTimerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % projects.length);
    }, 5000);

    return () => {
      if (autoSwitchTimerRef.current) {
        clearInterval(autoSwitchTimerRef.current);
      }
    };
  }, [projects.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      viewerRef.current?.startAutoRotate?.();
    }, 0);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % (projects.length || 1));
    if (autoSwitchTimerRef.current) {
      clearInterval(autoSwitchTimerRef.current);
    }
  }, [projects.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex(
      (prev) => (prev - 1 + (projects.length || 1)) % (projects.length || 1),
    );
    if (autoSwitchTimerRef.current) {
      clearInterval(autoSwitchTimerRef.current);
    }
  }, [projects.length]);

  const handleDotClick = useCallback((index) => {
    setCurrentIndex(index);
    if (autoSwitchTimerRef.current) {
      clearInterval(autoSwitchTimerRef.current);
    }
  }, []);

  const currentProject = projects[currentIndex];

  // 🔹 5. Формирование URL текущей панорамы (как в ProjectView)
  const mainPanoramaUrl = currentProject?.main_panorama?.filename
    ? getMediaUrl(
        `projects/${currentProject.id}/panoramas/${currentProject.main_panorama.filename}`,
      )
    : currentProject?.panorama_url; // Фолбэк на старое поле, если вдруг оно есть

  // --- RENDER STATES ---
  if (initialLoading) {
    return (
      <div className="hero-container loading">
        <div className="loader">
          <div className="spinner"></div>
          <p>Загрузка каталога...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hero-container error">
        <div className="error-message">
          <h2>⚠️ {error}</h2>
          <button onClick={() => window.location.reload()}>Обновить</button>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="hero-container empty">
        <p>Нет проектов для показа</p>
      </div>
    );
  }

  return (
    <div className="hero-container">
      <div className="viewer-container">
        {/* 🔹 Проверка: рендерим SphereViewer только если есть URL */}
        {mainPanoramaUrl ? (
          <SphereViewer
            ref={viewerRef}
            src={mainPanoramaUrl}
            style={{ width: '100%', height: '100%' }}
            navbar={false}
            autoRotate={true}
            mousemove={false}
            touchmove={false}
            transitionDuration={TRANSITION_DURATION}
          />
        ) : (
          <div
            className="panorama-placeholder"
            style={{
              width: '100%',
              height: '100%',
              background: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
            }}
          >
            Панорама не найдена
          </div>
        )}
      </div>

      <div className="center-title-overlay">
        <h1 className="center-title">LABVASPHERE</h1>
      </div>

      <div className="center-button-overlay">
        <button className="sign-btn" onClick={handleAuthPage}>
          Войти
        </button>
      </div>

      {preloading && !initialLoading && (
        <div className="preload-overlay">
          <div className="preload-mini-spinner"></div>
          <span>{preloadProgress}%</span>
        </div>
      )}

      <button className="nav-btn prev" onClick={handlePrev} aria-label="Назад">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <button className="nav-btn next" onClick={handleNext} aria-label="Вперед">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <div className="info-overlay" key={currentProject?.id}>
        <h1 className="project-title">{currentProject?.title}</h1>
        <p className="designer-name">Автор: {currentProject?.author_name}</p>
      </div>

      <div className="indicators">
        {projects.map((_, index) => (
          <button
            key={index}
            className={`dot ${index === currentIndex ? 'active' : ''}`}
            onClick={() => handleDotClick(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default LandingPage;
