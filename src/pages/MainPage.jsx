import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  getProjects,
  deleteProject,
  updateProjectStatus,
} from '../services/projectService';
import { getCurrentUser } from '../services/authService';
import Header from '../components/Header';
import NewProjectModal from '../components/NewProjectModal';
import './MainPage.css';
import ViewIcon from '../show.svg';
import ShareIcon from '../share.svg';
import EditIcon from '../edit.svg';
import DeleteIcon from '../delete.svg';
import LikeIcon from '../likes.png';
import FavLogo from '../favourites.png';
import { CONFIG } from '../config';

const MainPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userName, setUserName] = useState('');
  const [toggleLoading, setToggleLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  // Состояние для модального окна подтверждения удаления
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    projectId: null,
    projectName: '',
    isLoading: false,
  });
  const getMediaUrl = (relativePath) => {
    if (!relativePath) return null;
    if (relativePath.startsWith('http')) return relativePath;
    return `${CONFIG.MEDIA_BASE_URL}/${relativePath}`;
  };
  const isActive = (path) => location.pathname === path;
  const handleToggleStats = (projectId) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, showStats: !p.showStats } : p,
      ),
    );
  };
  const toggleDescription = (projectId) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };
  const truncateText = (text, maxLength = 200) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
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
      console.error('Ошибка загрузки проектов:', err);
      setError('Не удалось загрузить список проектов');
    } finally {
      setLoading(false);
    }
  };
  const handleToggleStatus = async (e, projectId) => {
    e.stopPropagation();
    setToggleLoading(true);

    try {
      const project = projects.find((p) => p.id === projectId);
      const newStatus = project.status === 'published' ? 'draft' : 'published';

      const result = await updateProjectStatus(projectId, newStatus);

      if (result.success) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, status: newStatus } : p,
          ),
        );
      }
    } catch (err) {
      console.error('Ошибка переключения статуса:', err);
    } finally {
      setToggleLoading(false);
    }
  };
  const handleCreateProject = (project) => {
    console.log('Создан проект:', project);
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
      isLoading: false,
    });
  };

  // Подтверждаем удаление
  const handleConfirmDelete = async () => {
    if (!deleteModal.projectId) return;

    setDeleteModal((prev) => ({ ...prev, isLoading: true }));

    try {
      const result = await deleteProject(deleteModal.projectId);

      if (result.success) {
        // Обновляем список проектов
        loadProjects();
        // Закрываем модальное окно
        setDeleteModal({
          isOpen: false,
          projectId: null,
          projectName: '',
          isLoading: false,
        });
      } else {
        setError(result.error);
        setDeleteModal((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      console.error('Ошибка удаления проекта:', err);
      setError('Не удалось удалить проект');
      setDeleteModal((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // Закрываем модальное окно удаления
  const handleCloseDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      projectId: null,
      projectName: '',
      isLoading: false,
    });
  };

  // Фильтрация по поиску
  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()),
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
            <div
              className="delete-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Подтверждение удаления</h2>
                <button
                  className="modal-close"
                  onClick={handleCloseDeleteModal}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <p>Вы действительно хотите удалить проект?</p>
                <p className="project-name">
                  <strong>"{deleteModal.projectName}"</strong>
                </p>
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

          {error && <div className="error-message">{error}</div>}


          {loading ? (
            <div className="empty-state">Загрузка проектов...</div>
          ) : filteredProjects.length > 0 ? (
            <div className="projects-grid">
              {filteredProjects.map((project) => (
                <div key={project.id} className="project-card">
                  {/* ... содержимое карточки проекта без изменений ... */}
                  <div className="project-thumbnail">
                    {project.cover_image_url ? (
                      <img
                        src={getMediaUrl(project.cover_image_url)}
                        alt={project.title}
                        className="thumbnail-img"
                      />
                    ) : (
                      <div className="thumbnail-placeholder">360°</div>
                    )}
                  </div>
                  <div className="project-info">
                    <h3>{project.title}</h3>
                    {project.showStats ? (
                      <div className="project-stats-main-page">
                        <div className="stats-row">
                          <div className="stat-block">
<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="24px" height="24px" viewBox="0 0 512.000000 512.000000"
 preserveAspectRatio="xMidYMid meet">

<g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)"
fill="currentColor" stroke="none">
<path d="M2569 4858 c-184 -65 -264 -178 -298 -423 -51 -360 -151 -696 -268
-903 -84 -148 -233 -270 -505 -412 l-138 -72 -27 20 c-58 41 -87 43 -578 40
-441 -3 -472 -4 -509 -22 -53 -27 -104 -80 -130 -135 l-21 -46 0 -1155 0
-1155 28 -57 c16 -33 45 -70 67 -88 77 -61 79 -61 601 -58 528 3 512 1 585 74
l33 33 88 -30 c291 -99 569 -169 823 -206 169 -24 1518 -32 1627 -9 115 24
198 68 278 150 116 118 166 245 166 424 l1 102 41 22 c23 11 72 51 108 87 113
114 175 276 168 440 l-4 79 44 23 c67 35 162 136 203 215 92 176 97 387 13
556 l-24 48 30 64 c103 219 60 489 -106 665 -66 69 -122 106 -222 144 -57 21
-68 22 -680 25 -343 1 -623 4 -623 5 0 2 9 30 21 62 67 189 99 461 80 663 -42
430 -229 714 -540 819 -112 37 -244 42 -332 11z m241 -270 c135 -41 240 -152
300 -317 43 -116 60 -225 60 -375 0 -219 -40 -401 -130 -596 -54 -115 -59
-143 -34 -197 35 -72 -13 -67 794 -73 l725 -5 50 -23 c63 -29 110 -73 143
-137 24 -44 27 -61 27 -145 0 -105 -13 -145 -77 -228 -46 -61 -46 -123 -2
-179 57 -71 77 -121 82 -208 8 -157 -68 -273 -205 -314 -143 -43 -165 -91
-118 -261 30 -112 -2 -228 -87 -306 -44 -41 -73 -55 -145 -74 -52 -13 -100
-60 -108 -104 -4 -21 1 -57 14 -101 65 -208 -33 -391 -227 -425 -86 -16 -1335
-8 -1462 9 -259 34 -458 81 -748 176 l-202 66 0 1012 0 1012 154 78 c253 128
428 256 543 397 72 88 183 313 239 484 73 225 105 373 160 734 6 42 57 99 98
111 34 10 101 5 156 -11z m-1630 -2838 l0 -1090 -405 0 -405 0 0 1090 0 1090
405 0 405 0 0 -1090z"/>
</g>
</svg>

                            <span>{project.likes_count || 0}</span>
                          </div>
                          <div className="stat-block">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_403_3026)">
<path d="M23.2709 9.41885C21.7199 6.89285 18.1919 2.65485 11.9999 2.65485C5.80793 2.65485 2.27993 6.89285 0.728929 9.41885C0.249457 10.1944 -0.0045166 11.0881 -0.0045166 11.9998C-0.0045166 12.9116 0.249457 13.8053 0.728929 14.5808C2.27993 17.1068 5.80793 21.3448 11.9999 21.3448C18.1919 21.3448 21.7199 17.1068 23.2709 14.5808C23.7504 13.8053 24.0044 12.9116 24.0044 11.9998C24.0044 11.0881 23.7504 10.1944 23.2709 9.41885ZM21.5659 13.5338C20.2339 15.6998 17.2189 19.3448 11.9999 19.3448C6.78093 19.3448 3.76593 15.6998 2.43393 13.5338C2.14906 13.0729 1.99818 12.5417 1.99818 11.9998C1.99818 11.458 2.14906 10.9268 2.43393 10.4658C3.76593 8.29985 6.78093 4.65485 11.9999 4.65485C17.2189 4.65485 20.2339 8.29585 21.5659 10.4658C21.8508 10.9268 22.0017 11.458 22.0017 11.9998C22.0017 12.5417 21.8508 13.0729 21.5659 13.5338Z" fill="currentColor"/>
<path d="M11.9998 6.99982C11.0109 6.99982 10.0442 7.29306 9.22191 7.84247C8.39966 8.39188 7.7588 9.17277 7.38036 10.0864C7.00192 11 6.90291 12.0054 7.09583 12.9753C7.28876 13.9452 7.76496 14.8361 8.46422 15.5354C9.16349 16.2346 10.0544 16.7108 11.0243 16.9037C11.9942 17.0967 12.9995 16.9977 13.9132 16.6192C14.8268 16.2408 15.6077 15.5999 16.1571 14.7777C16.7065 13.9554 16.9998 12.9887 16.9998 11.9998C16.9982 10.6742 16.4709 9.40337 15.5335 8.46604C14.5962 7.5287 13.3254 7.0014 11.9998 6.99982ZM11.9998 14.9998C11.4064 14.9998 10.8264 14.8239 10.333 14.4942C9.8397 14.1646 9.45518 13.696 9.22812 13.1479C9.00106 12.5997 8.94165 11.9965 9.0574 11.4145C9.17316 10.8326 9.45888 10.2981 9.87844 9.8785C10.298 9.45894 10.8325 9.17322 11.4145 9.05746C11.9964 8.94171 12.5996 9.00112 13.1478 9.22818C13.696 9.45524 14.1645 9.83976 14.4942 10.3331C14.8238 10.8265 14.9998 11.4065 14.9998 11.9998C14.9998 12.7955 14.6837 13.5585 14.1211 14.1211C13.5585 14.6837 12.7954 14.9998 11.9998 14.9998Z" fill="currentColor"/>
</g>
<defs>
<clipPath id="clip0_403_3026">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>
</svg>

                            <span>{project.views_count || 0}</span>
                          </div>
                          <div className="stat-block">
                            
<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="24px" height="24px" viewBox="0 0 512.000000 512.000000"
 preserveAspectRatio="xMidYMid meet">

<g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)"
fill="currentColor" stroke="none">
<path d="M1072 5100 c-189 -50 -346 -199 -404 -383 l-23 -72 0 -2185 0 -2185
27 -57 c34 -74 113 -152 186 -186 48 -22 72 -26 147 -26 77 -1 98 3 145 25 30
14 354 239 720 499 366 261 674 475 685 478 14 2 226 -143 690 -474 369 -262
694 -488 724 -502 177 -82 395 5 483 193 l23 50 0 2185 0 2185 -22 70 c-42
135 -153 270 -272 334 -33 17 -94 40 -137 51 -75 19 -115 20 -1488 19 -1357 0
-1414 -1 -1484 -19z m2928 -321 c55 -25 105 -71 133 -124 l22 -40 3 -2120 c1
-1166 0 -2130 -3 -2142 -15 -62 -17 -60 -730 447 -373 265 -698 492 -724 504
-65 30 -216 30 -281 0 -25 -11 -351 -238 -723 -503 -716 -509 -717 -510 -732
-448 -3 12 -4 976 -3 2142 l3 2120 22 40 c28 53 78 99 133 124 45 20 59 21
1440 21 1381 0 1395 -1 1440 -21z"/>
<path d="M1914 4039 c-91 -11 -141 -26 -229 -69 -333 -161 -489 -575 -355
-942 39 -107 87 -183 178 -280 377 -404 951 -1004 976 -1019 40 -25 112 -25
152 0 25 15 599 615 976 1019 127 136 194 271 219 441 45 309 -111 632 -370
770 -279 148 -614 102 -843 -117 l-58 -55 -58 56 c-118 112 -252 176 -412 197
-84 11 -91 11 -176 -1z m252 -343 c45 -22 88 -59 184 -157 142 -145 174 -163
253 -140 34 10 66 37 162 136 101 104 132 130 190 157 64 30 78 33 160 32 124
-1 189 -27 271 -108 161 -162 178 -409 41 -591 -41 -54 -857 -923 -867 -923
-10 0 -826 869 -867 923 -132 174 -121 415 25 577 46 51 82 76 151 105 48 20
69 23 147 20 75 -2 100 -8 150 -31z"/>
</g>
</svg>

                            <span>{project.favourites_count || 0}</span>
                          </div>
                        </div>
                        <div className="stats-row">
                          <button
                            className={`stat-block status-button ${project.status === 'published' ? 'status-published' : 'status-draft'}`}
                            onClick={(e) => handleToggleStatus(e, project.id)}
                            disabled={toggleLoading}
                          >
                            <span className="status-icon">
                              {project.status === 'published' ? '✅' : '⏳'}
                            </span>
                            <span>
                              {project.status === 'published'
                                ? 'Опубликован'
                                : 'Черновик'}
                            </span>
                          </button>
                          <div className="stat-block">
                            <span className="date-icon">📅</span>
                            <span>
                              {new Date(project.updated_at).toLocaleDateString(
                                'ru-RU',
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="project-description">
                        <span className="description-label">Описание: </span>
                        <span className="description-text">
                          {expandedDescriptions[project.id]
                            ? project.description
                            : truncateText(
                                project.description || 'Без описания',
                                200,
                              )}
                        </span>
                        {project.description &&
                          project.description.length > 200 && (
                            <button
                              className="read-more-btn"
                              onClick={() => toggleDescription(project.id)}
                            >
                              {expandedDescriptions[project.id]
                                ? 'Свернуть'
                                : 'Читать далее'}
                            </button>
                          )}
                      </p>
                    )}
                  </div>
                  <button
                    className="toggle-stats-btn"
                    onClick={() => handleToggleStats(project.id)}
                  >
                    {project.showStats ? '📝 Описание' : '📊 Статистика'}
                  </button>
                  <div className="project-actions">
                    <button
                      onClick={() => handleViewProject(project.id)}
                      className="action-button"
                      title="Просмотр"
                    >
                      <span className="button-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_403_3026)">
<path d="M23.2709 9.41885C21.7199 6.89285 18.1919 2.65485 11.9999 2.65485C5.80793 2.65485 2.27993 6.89285 0.728929 9.41885C0.249457 10.1944 -0.0045166 11.0881 -0.0045166 11.9998C-0.0045166 12.9116 0.249457 13.8053 0.728929 14.5808C2.27993 17.1068 5.80793 21.3448 11.9999 21.3448C18.1919 21.3448 21.7199 17.1068 23.2709 14.5808C23.7504 13.8053 24.0044 12.9116 24.0044 11.9998C24.0044 11.0881 23.7504 10.1944 23.2709 9.41885ZM21.5659 13.5338C20.2339 15.6998 17.2189 19.3448 11.9999 19.3448C6.78093 19.3448 3.76593 15.6998 2.43393 13.5338C2.14906 13.0729 1.99818 12.5417 1.99818 11.9998C1.99818 11.458 2.14906 10.9268 2.43393 10.4658C3.76593 8.29985 6.78093 4.65485 11.9999 4.65485C17.2189 4.65485 20.2339 8.29585 21.5659 10.4658C21.8508 10.9268 22.0017 11.458 22.0017 11.9998C22.0017 12.5417 21.8508 13.0729 21.5659 13.5338Z" fill="currentColor"/>
<path d="M11.9998 6.99982C11.0109 6.99982 10.0442 7.29306 9.22191 7.84247C8.39966 8.39188 7.7588 9.17277 7.38036 10.0864C7.00192 11 6.90291 12.0054 7.09583 12.9753C7.28876 13.9452 7.76496 14.8361 8.46422 15.5354C9.16349 16.2346 10.0544 16.7108 11.0243 16.9037C11.9942 17.0967 12.9995 16.9977 13.9132 16.6192C14.8268 16.2408 15.6077 15.5999 16.1571 14.7777C16.7065 13.9554 16.9998 12.9887 16.9998 11.9998C16.9982 10.6742 16.4709 9.40337 15.5335 8.46604C14.5962 7.5287 13.3254 7.0014 11.9998 6.99982ZM11.9998 14.9998C11.4064 14.9998 10.8264 14.8239 10.333 14.4942C9.8397 14.1646 9.45518 13.696 9.22812 13.1479C9.00106 12.5997 8.94165 11.9965 9.0574 11.4145C9.17316 10.8326 9.45888 10.2981 9.87844 9.8785C10.298 9.45894 10.8325 9.17322 11.4145 9.05746C11.9964 8.94171 12.5996 9.00112 13.1478 9.22818C13.696 9.45524 14.1645 9.83976 14.4942 10.3331C14.8238 10.8265 14.9998 11.4065 14.9998 11.9998C14.9998 12.7955 14.6837 13.5585 14.1211 14.1211C13.5585 14.6837 12.7954 14.9998 11.9998 14.9998Z" fill="currentColor"/>
</g>
<defs>
<clipPath id="clip0_403_3026">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>
</svg>
                      </span>
                    </button>
                    <button className="action-button" title="Поделиться">
                      <span className="button-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_403_2908)">
<path d="M0 22.9993V15.9993C0.00264685 13.6132 0.951708 11.3255 2.63896 9.63829C4.32622 7.95103 6.61386 7.00197 9 6.99933H13.83V5.41333C13.8301 5.01783 13.9474 4.63123 14.1672 4.30241C14.387 3.97359 14.6993 3.71731 15.0647 3.56597C15.4301 3.41464 15.8322 3.37503 16.2201 3.45216C16.608 3.5293 16.9643 3.71971 17.244 3.99933L23.124 9.87832C23.6864 10.4409 24.0024 11.2038 24.0024 11.9993C24.0024 12.7948 23.6864 13.5577 23.124 14.1203L17.244 19.9993C16.9643 20.2789 16.608 20.4693 16.2201 20.5465C15.8322 20.6236 15.4301 20.584 15.0647 20.4327C14.6993 20.2813 14.387 20.025 14.1672 19.6962C13.9474 19.3674 13.8301 18.9808 13.83 18.5853V16.9993H8C6.40919 17.0009 4.88399 17.6336 3.75911 18.7584C2.63424 19.8833 2.00159 21.4085 2 22.9993C2 23.2645 1.89464 23.5189 1.70711 23.7064C1.51957 23.8939 1.26522 23.9993 1 23.9993C0.734784 23.9993 0.48043 23.8939 0.292893 23.7064C0.105357 23.5189 0 23.2645 0 22.9993ZM15.83 7.99932C15.83 8.26454 15.7246 8.51889 15.5371 8.70643C15.3496 8.89397 15.0952 8.99932 14.83 8.99932H9C7.14414 9.00144 5.36489 9.73962 4.05259 11.0519C2.7403 12.3642 2.00212 14.1435 2 15.9993V17.7133C2.74957 16.8603 3.67249 16.1769 4.70715 15.7089C5.74182 15.2409 6.86441 14.999 8 14.9993H14.83C15.0952 14.9993 15.3496 15.1047 15.5371 15.2922C15.7246 15.4797 15.83 15.7341 15.83 15.9993V18.5853L21.709 12.7063C21.8965 12.5188 22.0018 12.2645 22.0018 11.9993C22.0018 11.7342 21.8965 11.4798 21.709 11.2923L15.83 5.41333V7.99932Z" fill="currentColor"/>
</g>
<defs>
<clipPath id="clip0_403_2908">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>
</svg>


                      </span>
                    </button>
                    <button
                      onClick={() => handleEditProject(project.id)}
                      className="action-button"
                      title="Редактировать"
                    >
                      <span className="button-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_403_3224)">
<path d="M22.8531 1.14801C22.1733 0.469212 21.2518 0.0879517 20.2911 0.0879517C19.3304 0.0879517 18.409 0.469212 17.7291 1.14801L1.46514 17.412C0.999388 17.8751 0.630099 18.426 0.378635 19.0328C0.127171 19.6396 -0.00147591 20.2902 0.000137052 20.947V23C0.000137052 23.2652 0.105494 23.5196 0.29303 23.7071C0.480567 23.8947 0.734921 24 1.00014 24H3.05314C3.7099 24.0019 4.36051 23.8734 4.96729 23.6221C5.57408 23.3708 6.12499 23.0017 6.58814 22.536L22.8531 6.27101C23.5316 5.59121 23.9127 4.66998 23.9127 3.70951C23.9127 2.74905 23.5316 1.82782 22.8531 1.14801ZM5.17414 21.122C4.61014 21.6823 3.8481 21.9977 3.05314 22H2.00014V20.947C1.99913 20.5529 2.07629 20.1625 2.22717 19.7985C2.37806 19.4344 2.59965 19.1039 2.87914 18.826L15.2221 6.48301L17.5221 8.78302L5.17414 21.122ZM21.4381 4.85701L18.9321 7.36401L16.6321 5.06901L19.1391 2.56201C19.2902 2.41132 19.4694 2.29185 19.6666 2.21042C19.8638 2.129 20.0751 2.0872 20.2884 2.08744C20.5017 2.08767 20.713 2.12992 20.91 2.21178C21.107 2.29363 21.2859 2.41349 21.4366 2.56451C21.5873 2.71553 21.7068 2.89476 21.7882 3.09195C21.8697 3.28914 21.9114 3.50044 21.9112 3.71378C21.911 3.92713 21.8687 4.13833 21.7869 4.33535C21.705 4.53236 21.5852 4.71132 21.4341 4.86201L21.4381 4.85701Z" fill="currentColor"/>
</g>
<defs>
<clipPath id="clip0_403_3224">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>
</svg>

                      </span>
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteClick(project.id, project.title)
                      }
                      className="action-button btn-delete"
                      title="Удалить"
                    >
                      <span className="button-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_403_3667)">
<path d="M18.9649 8.46398L23.9939 3.43498L22.5649 2.00598L17.5189 7.05098L15.3129 4.89498C14.9509 4.54313 14.4698 4.3403 13.9651 4.32678C13.4605 4.31325 12.9692 4.49002 12.5889 4.82198C10.7327 6.50283 8.57316 7.81456 6.2259 8.68698L-0.00610352 10.514V11.27C0.0350478 14.6829 1.42795 17.9403 3.86717 20.3278C6.3064 22.7152 9.59285 24.038 13.0059 24.006H14.2469L14.5079 23.824C16.5468 22.5169 18.2383 20.735 19.4376 18.6309C20.6369 16.5268 21.3082 14.1633 21.3939 11.743C21.4015 11.4643 21.3511 11.187 21.2459 10.9288C21.1407 10.6706 20.9831 10.4371 20.7829 10.243L18.9649 8.46398ZM13.8999 6.33998L19.3769 11.681C19.347 12.7007 19.1939 13.713 18.9209 14.696L11.9409 7.89998C12.6199 7.41345 13.2737 6.89278 13.8999 6.33998ZM13.6059 21.985H13.0059C11.5322 21.9851 10.0731 21.6931 8.7129 21.126C10.4606 20.2479 11.9567 18.9404 13.0609 17.326L13.5789 16.566L11.9099 15.43L11.3919 16.191C10.479 17.5224 9.24305 18.6004 7.7999 19.324L6.5709 19.942C5.57165 19.2386 4.6978 18.3722 3.9859 17.379C5.617 16.8267 7.10514 15.9192 8.3429 14.722L6.9319 13.277C5.81432 14.3596 4.45059 15.1547 2.9579 15.594C2.44016 14.4668 2.12824 13.256 2.0369 12.019L6.7919 10.625C7.99439 10.2389 9.14422 9.70482 10.2149 9.03498L18.1259 16.735C17.0798 18.8334 15.527 20.6379 13.6079 21.985H13.6059Z" fill="currentColor"/>
</g>
<defs>
<clipPath id="clip0_403_3667">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>
</svg>

                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 🔍 Логика пустого состояния */
            <div className="empty-state">
              {projects.length > 0 && searchQuery.trim() !== '' ? (
                // Случай: проекты есть, но поиск не дал результатов
                <p>Проект "{searchQuery}" не найден.</p>
              ) : (
                // Случай: проектов вообще нет
                <>
                  <p>У вас пока нет проектов.</p>
                  <p>
                    Нажмите «+ Новый проект», чтобы загрузить первую 360° панораму.
                  </p>
                </>
              )}
            </div>
          )}
          </div>
      </main>
    </div>
  );
};

export default MainPage;
