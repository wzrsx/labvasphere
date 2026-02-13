// src/pages/ProjectView.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./ProjectView.css";
import SphereViewer from "../components/SphereViewer";
import api from '../services/api';

const ProjectView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        // Используем axios вместо fetch
        const response = await api.get(`/projects/${id}`);
        setProject(response.data);
      } catch (err) {
        console.error("Не удалось загрузить проект:", err);
        const message = err.response?.data?.error || 'Проект не найден';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProject();
    }
  }, [id]);

  if (loading) return <div className="project-view">Загрузка...</div>;
  if (error) return <div className="project-view">Ошибка: {error}</div>;
  if (!project) return <div className="project-view">Проект не найден</div>;

  return (
    <div className="project-view">
      <header className="project-header">
        <button onClick={() => navigate(-1)}>&larr; Назад к проектам</button>
        <h1>{project.title}</h1> 
      </header>

      <div className="panorama-container">
        <SphereViewer src={project.panorama_url} /> 
      </div>
    </div>
  );
};

export default ProjectView;