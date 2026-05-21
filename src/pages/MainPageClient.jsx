import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPublishedProjects } from '../services/projectService';
import './MainPage.css';
import { useTranslation } from 'react-i18next';
import { CONFIG } from '../config';

const MainPageClient = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [shareModal, setShareModal] = useState({
    isOpen: false,
    projectId: null,
    projectTitle: '',
  });
  const toggleDescription = (projectId) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };
  const truncateText = (text, maxLength = 100) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      const result = await getPublishedProjects(20, 0);

      if (result.success) {
        setProjects(result.projects);
      } else {
        setError(result.error);
      }
      setLoading(false);
    };

    fetchProjects();
  }, []);
  const handleViewProject = (projectId) => {
    navigate(`/project/${projectId}`);
  };
  const handleCloseShareModal = () => {
    setShareModal({ isOpen: false, projectId: null, projectTitle: '' });
  };
  const handleShareClick = (project) => {
    setShareModal({
      projectTitle: project.title,
      isOpen: true,
      projectId: project.id,
    });
  };
  const getMediaUrl = (relativePath) => {
    if (!relativePath) return null;
    if (relativePath.startsWith('http')) return relativePath;
    return `${CONFIG.MEDIA_BASE_URL}/${relativePath}`;
  };
  if (loading) {
    return (
      <div className="dashboard">
        <main className="dashboard-main">
          <div className="empty-state">Загрузка проектов...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <main className="dashboard-main">
          <div className="error-message">⚠️ {error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <main className="dashboard-main">
        <div className="projects-header">
          <h2>Виртуальные туры по проектам</h2>
          <p className="projects-subtitle">
            Исследуйте готовые интерьеры и архитектурные решения в формате 360°
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <p>Пока нет опубликованных проектов</p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <div
                key={project.id}
                className="project-card project-card-client"
                onClick={() => navigate(`/project/${project.id}`)}
                style={{ cursor: 'pointer' }}
              >
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
                  <span className="description-text">
                    {expandedDescriptions[project.id]
                      ? project.description
                      : truncateText(
                          project.description ||
                            t('projects.description.empty'),
                          95,
                        )}
                  </span>
                  {project.description && project.description.length > 95 && (
                    <button
                      className="read-more-btn"
                      onClick={() => toggleDescription(project.id)}
                    >
                      {expandedDescriptions[project.id]
                        ? t('projects.description.collapse')
                        : t('projects.description.read_more')}
                    </button>
                  )}
                </div>
                <div className="project-actions">
                  <button
                    onClick={() => handleViewProject(project.id)}
                    className="action-button"
                    title={'title'}
                  >
                    <span className="button-icon">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <g clip-path="url(#clip0_403_3026)">
                          <path
                            d="M23.2709 9.41885C21.7199 6.89285 18.1919 2.65485 11.9999 2.65485C5.80793 2.65485 2.27993 6.89285 0.728929 9.41885C0.249457 10.1944 -0.0045166 11.0881 -0.0045166 11.9998C-0.0045166 12.9116 0.249457 13.8053 0.728929 14.5808C2.27993 17.1068 5.80793 21.3448 11.9999 21.3448C18.1919 21.3448 21.7199 17.1068 23.2709 14.5808C23.7504 13.8053 24.0044 12.9116 24.0044 11.9998C24.0044 11.0881 23.7504 10.1944 23.2709 9.41885ZM21.5659 13.5338C20.2339 15.6998 17.2189 19.3448 11.9999 19.3448C6.78093 19.3448 3.76593 15.6998 2.43393 13.5338C2.14906 13.0729 1.99818 12.5417 1.99818 11.9998C1.99818 11.458 2.14906 10.9268 2.43393 10.4658C3.76593 8.29985 6.78093 4.65485 11.9999 4.65485C17.2189 4.65485 20.2339 8.29585 21.5659 10.4658C21.8508 10.9268 22.0017 11.458 22.0017 11.9998C22.0017 12.5417 21.8508 13.0729 21.5659 13.5338Z"
                            fill="currentColor"
                          />
                          <path
                            d="M11.9998 6.99982C11.0109 6.99982 10.0442 7.29306 9.22191 7.84247C8.39966 8.39188 7.7588 9.17277 7.38036 10.0864C7.00192 11 6.90291 12.0054 7.09583 12.9753C7.28876 13.9452 7.76496 14.8361 8.46422 15.5354C9.16349 16.2346 10.0544 16.7108 11.0243 16.9037C11.9942 17.0967 12.9995 16.9977 13.9132 16.6192C14.8268 16.2408 15.6077 15.5999 16.1571 14.7777C16.7065 13.9554 16.9998 12.9887 16.9998 11.9998C16.9982 10.6742 16.4709 9.40337 15.5335 8.46604C14.5962 7.5287 13.3254 7.0014 11.9998 6.99982ZM11.9998 14.9998C11.4064 14.9998 10.8264 14.8239 10.333 14.4942C9.8397 14.1646 9.45518 13.696 9.22812 13.1479C9.00106 12.5997 8.94165 11.9965 9.0574 11.4145C9.17316 10.8326 9.45888 10.2981 9.87844 9.8785C10.298 9.45894 10.8325 9.17322 11.4145 9.05746C11.9964 8.94171 12.5996 9.00112 13.1478 9.22818C13.696 9.45524 14.1645 9.83976 14.4942 10.3331C14.8238 10.8265 14.9998 11.4065 14.9998 11.9998C14.9998 12.7955 14.6837 13.5585 14.1211 14.1211C13.5585 14.6837 12.7954 14.9998 11.9998 14.9998Z"
                            fill="currentColor"
                          />
                        </g>
                        <defs>
                          <clipPath id="clip0_403_3026">
                            <rect width="24" height="24" fill="white" />
                          </clipPath>
                        </defs>
                      </svg>
                    </span>
                  </button>
                  <button
                    className="action-button"
                    title="Поделиться"
                    onClick={() => handleShareClick(project)}
                  >
                    <span className="button-icon">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <g clip-path="url(#clip0_403_2908)">
                          <path
                            d="M0 22.9993V15.9993C0.00264685 13.6132 0.951708 11.3255 2.63896 9.63829C4.32622 7.95103 6.61386 7.00197 9 6.99933H13.83V5.41333C13.8301 5.01783 13.9474 4.63123 14.1672 4.30241C14.387 3.97359 14.6993 3.71731 15.0647 3.56597C15.4301 3.41464 15.8322 3.37503 16.2201 3.45216C16.608 3.5293 16.9643 3.71971 17.244 3.99933L23.124 9.87832C23.6864 10.4409 24.0024 11.2038 24.0024 11.9993C24.0024 12.7948 23.6864 13.5577 23.124 14.1203L17.244 19.9993C16.9643 20.2789 16.608 20.4693 16.2201 20.5465C15.8322 20.6236 15.4301 20.584 15.0647 20.4327C14.6993 20.2813 14.387 20.025 14.1672 19.6962C13.9474 19.3674 13.8301 18.9808 13.83 18.5853V16.9993H8C6.40919 17.0009 4.88399 17.6336 3.75911 18.7584C2.63424 19.8833 2.00159 21.4085 2 22.9993C2 23.2645 1.89464 23.5189 1.70711 23.7064C1.51957 23.8939 1.26522 23.9993 1 23.9993C0.734784 23.9993 0.48043 23.8939 0.292893 23.7064C0.105357 23.5189 0 23.2645 0 22.9993ZM15.83 7.99932C15.83 8.26454 15.7246 8.51889 15.5371 8.70643C15.3496 8.89397 15.0952 8.99932 14.83 8.99932H9C7.14414 9.00144 5.36489 9.73962 4.05259 11.0519C2.7403 12.3642 2.00212 14.1435 2 15.9993V17.7133C2.74957 16.8603 3.67249 16.1769 4.70715 15.7089C5.74182 15.2409 6.86441 14.999 8 14.9993H14.83C15.0952 14.9993 15.3496 15.1047 15.5371 15.2922C15.7246 15.4797 15.83 15.7341 15.83 15.9993V18.5853L21.709 12.7063C21.8965 12.5188 22.0018 12.2645 22.0018 11.9993C22.0018 11.7342 21.8965 11.4798 21.709 11.2923L15.83 5.41333V7.99932Z"
                            fill="currentColor"
                          />
                        </g>
                        <defs>
                          <clipPath id="clip0_403_2908">
                            <rect width="24" height="24" fill="white" />
                          </clipPath>
                        </defs>
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MainPageClient;
