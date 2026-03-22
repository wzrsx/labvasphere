// src/pages/ProjectView.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ProjectView.css';
import SphereViewer from '../components/SphereViewer';
import api from '../services/api';
import { CONFIG } from '../config';
import { getMainPanorama } from '../services/projectService';

const ProjectView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getMediaUrl = (relativePath) => {
    if (!relativePath) return null;
    if (relativePath.startsWith('http')) return relativePath;
    return `${CONFIG.MEDIA_BASE_URL}/${relativePath}`;
  };

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/projects/${id}`);
        const projectData = response.data;

        // Если нет main_panorama — запрашиваем отдельно
        if (!projectData.main_panorama) {
          const mainResult = await getMainPanorama(id);
          if (mainResult.success) {
            projectData.main_panorama = mainResult.panorama;
          }
        }

        setProject(projectData);
      } catch (err) {
        console.error('Не удалось загрузить проект:', err);
        const message = err.response?.data?.error || 'Проект не найден';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProject();
  }, [id]);

  if (loading) return <div className="project-view">Загрузка...</div>;
  if (error) return <div className="project-view">Ошибка: {error}</div>;
  if (!project) return <div className="project-view">Проект не найден</div>;

  // 🔹 Формируем URL основной панорамы
  const mainPanoramaUrl = project.main_panorama?.filename
    ? getMediaUrl(
        `projects/${project.id}/panoramas/${project.main_panorama.filename}`,
      )
    : null;

  return (
    <div className="project-view">
      <header className="project-header">
        <button onClick={() => navigate(-1)}>&larr; Назад к проектам</button>
        <h1>{project.title}</h1>
      </header>

      <div className="panorama-container">
        {mainPanoramaUrl ? (
          <SphereViewer src={mainPanoramaUrl} />
        ) : (
          <div className="panorama-placeholder">
            <p>Панорама не найдена</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectView;
