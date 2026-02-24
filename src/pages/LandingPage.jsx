// src/pages/LandingPage.jsx
import React, { useState, useEffect, useRef } from "react";
import SphereViewer from "../components/SphereViewer";
import { getPublishedProjects } from "../services/projectService";
import "./LandingPage.css";

const LandingPage = () => {
  const [projects, setProjects] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [preloading, setPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [error, setError] = useState(null);

  // Ref для управления вьювером (вращение)
  const viewerRef = useRef(null);

  // Функция предзагрузки изображений
  const preloadImages = (urls) => {
    return Promise.all(
      urls.map(
        (url) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.src = url;
            img.onload = () => resolve(url);
            img.onerror = () => reject(url);
          })
      )
    );
  };

  // 1. Загрузка опубликованных проектов
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const result = await getPublishedProjects(10, 0);

        if (result.success) {
          const loadedProjects = result.projects || [];
          setProjects(loadedProjects);

          // Если есть проекты - начинаем предзагрузку панорам
          if (loadedProjects.length > 0) {
            setPreloading(true);
            const panoramaUrls = loadedProjects.map((p) => p.panorama_url);

            try {
              // Загружаем с отслеживанием прогресса
              let loaded = 0;
              await Promise.all(
                panoramaUrls.map(
                  (url) =>
                    new Promise((resolve, reject) => {
                      const img = new Image();
                      img.src = url;
                      img.onload = () => {
                        loaded++;
                        setPreloadProgress(Math.round((loaded / panoramaUrls.length) * 100));
                        resolve(url);
                      };
                      img.onerror = () => {
                        loaded++;
                        setPreloadProgress(Math.round((loaded / panoramaUrls.length) * 100));
                        console.warn(`Failed to load: ${url}`);
                        resolve(url); // Продолжаем даже при ошибке
                      };
                    })
                )
              );
            } catch (err) {
              console.warn("Some images failed to load:", err);
            }

            setPreloading(false);
            setError(null);
          } else {
            setPreloading(false);
          }
        } else {
          setError(result.error);
          setPreloading(false);
        }
      } catch (err) {
        setError("Не удалось загрузить проекты");
        console.error(err);
        setPreloading(false);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // 2. Авто-переключение слайдов (каждые 8 секунд)
  useEffect(() => {
    if (projects.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % projects.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [projects.length]);

  // 3. Управление авто-вращением при смене слайда
  useEffect(() => {
    if (viewerRef.current && projects.length > 0) {
      const timer = setTimeout(() => {
        viewerRef.current.startAutoRotate();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, projects.length]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % projects.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + projects.length) % projects.length);
  };

  const currentProject = projects[currentIndex];

  // --- LOADING STATE (Загрузка списка проектов) ---
  if (loading) {
    return (
      <div className="hero-container loading">
        <div className="loader">
          <div className="spinner"></div>
          <p>Загрузка проектов...</p>
        </div>
      </div>
    );
  }

  // --- PRELOADING STATE (Предзагрузка панорам) ---
  if (preloading) {
    return (
      <div className="hero-container preloading">
        <div className="preloader">
          <div className="spinner"></div>
          <p>Загрузка панорам...</p>
          <div className="preload-progress-bar">
            <div
              className="preload-progress-fill"
              style={{ width: `${preloadProgress}%` }}
            />
          </div>
          <p className="preload-progress-text">{preloadProgress}%</p>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (error) {
    return (
      <div className="hero-container error">
        <div className="error-message">
          <h2>⚠️ {error}</h2>
          <button onClick={() => window.location.reload()}>Попробовать снова</button>
        </div>
      </div>
    );
  }

  // --- EMPTY STATE ---
  if (projects.length === 0) {
    return (
      <div className="hero-container empty">
        <div className="empty-message">
          <h2>Нет опубликованных проектов</h2>
          <p>Загляните позже!</p>
        </div>
      </div>
    );
  }

  // --- MAIN CONTENT ---
  return (
    <div className="hero-container">
      {/* 360 VIEWER */}
      <div className="viewer-container">
        <SphereViewer
          ref={viewerRef}
          src={currentProject?.panorama_url}
          style={{ width: "100%", height: "100%" }}
          navbar={false}
        />
      </div>

      {/* СТРЕЛКИ НАВИГАЦИИ */}
      <button className="nav-btn prev" onClick={handlePrev} aria-label="Предыдущий">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>

      <button className="nav-btn next" onClick={handleNext} aria-label="Следующий">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>

      {/* ИНФОРМАЦИЯ (ЛЕВЫЙ НИЖНИЙ УГОЛ) */}
      <div className="info-overlay" key={currentProject?.id}>
        <h1 className="project-title">{currentProject?.title}</h1>
        <p className="designer-name">Автор ID: {currentProject?.author_id}</p>
      </div>

      {/* ИНДИКАТОРЫ (ТОЧКИ) */}
      <div className="indicators">
        {projects.map((_, index) => (
          <button
            key={index}
            className={`dot ${index === currentIndex ? "active" : ""}`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Перейти к проекту ${index + 1}`}
          />
        ))}
      </div>

      {/* ПРОГРЕСС БАР */}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${((currentIndex + 1) / projects.length) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default LandingPage;