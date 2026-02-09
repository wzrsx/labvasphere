import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getProjects } from "../services/projectService";
import { getCurrentUser } from "../services/authService";
import Header from "../components/Header";
import NewProjectModal from "../components/NewProjectModal";
import "./MainPage.css";

const MainPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userName, setUserName] = useState("");

  const isActive = (path) => location.pathname === path;

  // Получаем имя пользователя из ФИО
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (userData && userData.full_name) {
          const words = userData.full_name.trim().split(/\s+/);
          setUserName(words.length >= 2 ? words[1] : words[0]);
        }
      } catch (error) {
        console.error('Ошибка получения имени:', error);
      }
    }
  }, []);

  // Загрузка проектов
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getProjects();
      
      if (result.success) {
        setProjects(result.projects || []);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error("Ошибка загрузки проектов:", err);
      setError("Не удалось загрузить список проектов");
    } finally {
      setLoading(false);
    }
  };


  const handleCreateProject = (project) => {
    console.log("Создан проект:", project);
    // Обновляем список проектов
    loadProjects();
  };

  const handleViewProject = (projectId) => {
    navigate(`/project/${projectId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  // Фильтрация по поиску 
  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard">
      
      <main className="dashboard-main">
        <div className="hero-section">
          <h1>Добро пожаловать, {userName}!</h1>
          <p>
            Создайте свою первую 360° панораму или продолжите работу над
            проектом.
          </p>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            + Новый проект
          </button>
        </div>

        <NewProjectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreate={handleCreateProject}
        />

        <div className="projects-section">
          <div className="projects-header">
            <h2>Мои проекты</h2>
            <input
              type="text"
              placeholder="Поиск по проектам..."
              className="project-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {loading ? (
            <div className="empty-state">Загрузка проектов...</div>
          ) : filteredProjects.length > 0 ? (
            <div className="projects-grid">
              {filteredProjects.map((project) => (
                <div key={project.id} className="project-card">
                  <div className="project-thumbnail">
                    {project.cover_image_url ? (
                      <img
                        src={project.cover_image_url}
                        alt={project.title}
                        className="thumbnail-img"
                      />
                    ) : (
                      <div className="thumbnail-placeholder">360°</div>
                    )}
                  </div>
                  <div className="project-info">
                    <h3>{project.title}</h3>
                    <p>
                      Обновлено:{" "}
                      {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                    <p>
                      Описание: {project.description || 'Без описания'}
                    </p>
                    {/*Сделать иконками*/}
                    <p>
                      Просмотров: {project.views_count || 0}
                    </p>
                    <p>
                      Статус: {project.status || 'draft'}
                    </p>
                  </div>
                  <div className="project-actions">
                    <button onClick={() => handleViewProject(project.id)}>
                      Просмотр
                    </button>
                    <button>Поделиться</button>
                    <button>Редактировать</button>
                    <button>Удалить</button>
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