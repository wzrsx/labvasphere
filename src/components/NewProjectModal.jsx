// src/components/NewProjectModal.jsx
import React, { useState } from "react";

const NewProjectModal = ({ isOpen, onClose, onCreate }) => {
  const [projectName, setProjectName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (projectName.trim() && selectedFile) {
      onCreate(projectName.trim(), selectedFile);
      setProjectName("");
      setSelectedFile(null);
    } else {
      alert("Пожалуйста, укажите название и выберите файл панорамы.");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Опционально: проверка типа
      if (!file.type.match("image/(jpeg|jpg|png)")) {
        alert("Пожалуйста, загрузите изображение в формате JPG или PNG.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.match("image/(jpeg|jpg|png)")) {
      setSelectedFile(file);
    } else {
      alert("Поддерживаются только JPG и PNG.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content ${dragActive ? "drag-over" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <h2>Создать новый проект</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Название проекта"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="modal-input"
            autoFocus
            required
          />

          {/* Загрузка файла */}
          <div className="file-upload">
            <label className="file-upload-label">
              {selectedFile
                ? selectedFile.name
                : "Выберите файл панорамы (JPG/PNG)"}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="modal-cancel">
              Отмена
            </button>
            <button
              type="submit"
              className="modal-create"
              disabled={!projectName || !selectedFile}
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectModal;
