// src/pages/ProjectView.jsx
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./ProjectView.css";
import SphereViewer from "../components/SphereViewer";

const ProjectView = () => {
  const { id } = useParams(); // получаем :id из URL
  const navigate = useNavigate();

  // TODO: В реальной версии здесь будет запрос к API:
  const project = {
    id: id,
    name: `Проект #${id}`,
    description: "Интерактивная 360° панорама интерьера",
    imageUrl: "/panoramas/example.jpg",
  };

  return (
    <div className="project-view">
      <header className="project-header">
        <button onClick={() => navigate(-1)}>&larr; Назад к проектам</button>
        <h1>{project.name}</h1>
      </header>

      <div className="panorama-container">
        <img src={project.imageUrl} alt="test" style={{ display: "none" }} />
        <SphereViewer src={project.imageUrl} />
      </div>

      <div className="project-controls">
        <button>📤 Поделиться</button>
        <button>✏️ Редактировать</button>
        <button>🗑️ Удалить</button>
      </div>
    </div>
  );
};

export default ProjectView;
