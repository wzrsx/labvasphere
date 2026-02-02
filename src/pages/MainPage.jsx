// src/pages/MainPage.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./MainPage.css";
import ExitIcon from "../exit.svg";
import { useNavigate } from "react-router-dom";

const MainPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Функция для проверки активности маршрута
  const isActive = (path) => location.pathname === path;

  // Навигация к проекту
  const handleViewProject = (projectId) => {
    navigate(`/project/${projectId}`);
  };

  const projects = [
    { id: 1, name: "Офис на Тверской", updatedAt: "2026-01-20" },
    { id: 2, name: 'Квартира в ЖК "Небо"', updatedAt: "2026-01-24" },
    { id: 3, name: 'Ресторан "Лето"', updatedAt: "2026-01-15" },
  ];

  // Обработчик выхода (заглушка)
  const handleLogout = () => {
    // Например: очистить токен, редирект на /auth
    window.location.href = "/auth";
  };

  return (
    <div className="dashboard">
      {/* Main Content */}
      <main className="dashboard-main">
        <div className="hero-section">
          <h1>Добро пожаловать, Name!</h1>
          <p>
            Создайте свою первую 360° панораму или продолжите работу над
            проектом.
          </p>
          <button className="btn-primary">+ Новый проект</button>
        </div>

        <div className="projects-section">
          <div className="projects-header">
            <h2>Мои проекты</h2>
            <input
              type="text"
              placeholder="Поиск по проектам..."
              className="project-search"
            />
          </div>

          {projects.length > 0 ? (
            <div className="projects-grid">
              {projects.map((project) => (
                <div key={project.id} className="project-card">
                  <div className="project-thumbnail">
                    <div className="thumbnail-placeholder">360°</div>
                  </div>
                  <div className="project-info">
                    <h3>{project.name}</h3>
                    <p>Обновлено: {project.updatedAt}</p>
                  </div>
                  <div className="project-actions">
                    <button onClick={() => handleViewProject(project.id)}>
                      👁️ Просмотр
                    </button>
                    <button>📤 Поделиться</button>
                    <button>✏️ Редактировать</button>
                    <button>🗑️ Удалить</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>У вас пока нет проектов.</p>
              <p>
                Нажмите «+ Новый проект», чтобы загрузить первую 360° панораму.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MainPage;
