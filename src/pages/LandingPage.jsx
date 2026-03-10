import React, { useState, useEffect, useRef, useCallback } from "react";
import SphereViewer from "../components/SphereViewer";
import { getPublishedProjects } from "../services/projectService";
import { preloadPanorama } from "../services/preload.js";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./LandingPage.css";

const PRELOAD_AHEAD = 3;
const TRANSITION_DURATION = 700; // Уменьшили для более отзывчивого интерфейса

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
  const currentIndexRef = useRef(0); // Ref для актуального индекса в интервале
  const autoSwitchTimerRef = useRef(null); // Ref для управления таймером

  // Синхронизируем ref с состоянием
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const handleAuthPage = (projectId) => {
    navigate(`/auth`);
  };
  // 1. Загрузка списка проектов
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setInitialLoading(true);
        const result = await getPublishedProjects(10, 0);

        if (result.success && result.projects?.length > 0) {
          setProjects(result.projects);
          handlePreloadForIndex(0, result.projects);
        } else {
          setError(result.error || "Нет проектов");
        }
      } catch (err) {
        setError("Ошибка сети");
        console.error(err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // 2. Логика предзагрузки
  const handlePreloadForIndex = useCallback((index, projectsList) => {
    if (!projectsList || projectsList.length === 0) return;

    const indicesToPreload = [];
    for (let i = 0; i < PRELOAD_AHEAD + 1; i++) {
      const targetIdx = (index + i) % projectsList.length;
      const url = projectsList[targetIdx]?.panorama_url;
      
      if (url && !preloadedUrls.current.has(url)) {
        indicesToPreload.push({ idx: targetIdx, url });
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
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      handlePreloadForIndex(currentIndex, projects);
    }
  }, [currentIndex, projects, handlePreloadForIndex]);

  // 3. Автопереключение (ИСПРАВЛЕНО)
  useEffect(() => {
    if (projects.length === 0) return;
    
    // Очищаем предыдущий таймер при пересоздании эффекта
    if (autoSwitchTimerRef.current) {
      clearInterval(autoSwitchTimerRef.current);
    }
    
    autoSwitchTimerRef.current = setInterval(() => {
      // Используем ref, чтобы получить актуальный индекс без перезапуска эффекта
      setCurrentIndex((prev) => (prev + 1) % projects.length);
    }, 5000);
    
    return () => {
      if (autoSwitchTimerRef.current) {
        clearInterval(autoSwitchTimerRef.current);
      }
    };
  }, [projects.length]); // Убрали currentIndex из зависимостей!

  // 4. Управление авторотацией
  useEffect(() => {
    const timer = setTimeout(() => {
      viewerRef.current?.startAutoRotate?.();
    }, 0);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  // --- Handlers (БЕЗ isTransitioning) ---
  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % (projects.length || 1));
    // Сбрасываем таймер автопереключения, если пользователь кликнул вручную
    if (autoSwitchTimerRef.current) {
      clearInterval(autoSwitchTimerRef.current);
    }
  }, [projects.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + (projects.length || 1)) % (projects.length || 1));
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
        <SphereViewer
          ref={viewerRef}
          src={currentProject?.panorama_url}
          style={{ width: "100%", height: "100%" }}
          navbar={false}
          autoRotate={true}
          mousemove={false}
          touchmove={false}
          transitionDuration={TRANSITION_DURATION} // Передаем длительность перехода
        />
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
        <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <button className="nav-btn next" onClick={handleNext} aria-label="Вперед">
        <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M9 18l6-6-6-6"/>
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
            className={`dot ${index === currentIndex ? "active" : ""}`}
            onClick={() => handleDotClick(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default LandingPage;