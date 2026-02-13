import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getProjects, deleteProject } from "../services/projectService";
import { getCurrentUser } from "../services/authService";
import Header from "../components/Header";
import NewProjectModal from "../components/NewProjectModal";
import "./MainPage.css";
import ViewIcon from '../show.svg';
import ShareIcon from '../share.svg';
import EditIcon from '../edit.svg';
import DeleteIcon from '../delete.svg';
const MainPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userName, setUserName] = useState("");
  
  // Состояние для модального окна подтверждения удаления
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    projectId: null,
    projectName: '',
    isLoading: false
  });

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
    loadProjects();
  };

  const handleViewProject = (projectId) => {
    navigate(`/project/${projectId}`);
  };
  const handleEditProject = (projectId) => {
    navigate(`/editor/${projectId}`);
  };
  // Открываем модальное окно подтверждения удаления
  const handleDeleteClick = (projectId, projectName) => {
    setDeleteModal({
      isOpen: true,
      projectId: projectId,
      projectName: projectName,
      isLoading: false
    });
  };

  // Подтверждаем удаление
  const handleConfirmDelete = async () => {
    if (!deleteModal.projectId) return;
    
    setDeleteModal(prev => ({ ...prev, isLoading: true }));
    
    try {
      const result = await deleteProject(deleteModal.projectId);
      
      if (result.success) {
        // Обновляем список проектов
        loadProjects();
        // Закрываем модальное окно
        setDeleteModal({ isOpen: false, projectId: null, projectName: '', isLoading: false });
      } else {
        setError(result.error);
        setDeleteModal(prev => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      console.error("Ошибка удаления проекта:", err);
      setError("Не удалось удалить проект");
      setDeleteModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Закрываем модальное окно удаления
  const handleCloseDeleteModal = () => {
    setDeleteModal({ isOpen: false, projectId: null, projectName: '', isLoading: false });
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

        {/* Модальное окно подтверждения удаления */}
        {deleteModal.isOpen && (
          <div className="modal-overlay" onClick={handleCloseDeleteModal}>
            <div className="delete-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Подтверждение удаления</h2>
                <button className="modal-close" onClick={handleCloseDeleteModal}>
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <p>Вы действительно хотите удалить проект?</p>
                <p className="project-name"><strong>"{deleteModal.projectName}"</strong></p>
                <p className="warning-text">Это действие нельзя отменить.</p>
              </div>
              
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseDeleteModal}
                  disabled={deleteModal.isLoading}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleConfirmDelete}
                  disabled={deleteModal.isLoading}
                >
                  {deleteModal.isLoading ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                    <p>
                      Просмотров: {project.views_count || 0}
                    </p>
                    <p>
                      Статус: {project.status || 'draft'}
                    </p>
                  </div>
                  <div className="project-actions">
                    {/* Просмотр */}
                    <button 
                      onClick={() => handleViewProject(project.id)}
                      className="action-button"
                    >
                      <span className="button-text">Просмотр</span>
                      <span className="button-icon">
                        <img src={ViewIcon} alt="Просмотр" />
                      </span>
                    </button>
                    
                    {/* Поделиться */}
                    <button className="action-button">
                      <span className="button-text">Поделиться</span>
                      <span className="button-icon">
                        <img src={ShareIcon} alt="Поделиться" />
                      </span>
                    </button>
                    
                    {/* Редактировать */}
                    <button 
                      onClick={() => handleEditProject(project.id)}
                      className="action-button">
                      <span className="button-text">Редактировать</span>
                      <span className="button-icon">
                        <img src={EditIcon} alt="Редактировать" />
                      </span>
                    </button>
                    
                    {/* Удалить */}
                    <button 
                      onClick={() => handleDeleteClick(project.id, project.title)}
                      className="action-button btn-delete"
                    >
                      <span className="button-text">Удалить</span>
                      <span className="button-icon">
                        <img src={DeleteIcon} alt="Удалить" />
                      </span>
                    </button>
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