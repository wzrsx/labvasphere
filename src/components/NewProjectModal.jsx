import React, { useState } from "react";
import { createProject } from "../services/projectService";

const NewProjectModal = ({ isOpen, onClose, onCreate }) => {
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Валидация
    if (!projectName.trim()) {
      setError("Название проекта обязательно");
      return;
    }

    if (!selectedFile) {
      setError("Пожалуйста, выберите файл панорамы");
      return;
    }

    // Проверка типа файла
    if (!selectedFile.type.match("image/(jpeg|jpg|png)")) {
      setError("Поддерживаются только файлы формата JPG или PNG");
      return;
    }

    // Ограничение размера файла (например, 50 МБ)
    const maxSize = 50 * 1024 * 1024; // 50 МБ
    if (selectedFile.size > maxSize) {
      setError("Файл слишком большой. Максимальный размер: 50 МБ");
      return;
    }

    setIsLoading(true);

    // Сначала загружаем файл на сервер
    const uploadResult = await uploadFile(selectedFile);
    
    if (!uploadResult.success) {
      setError(uploadResult.error || "Ошибка при загрузке файла");
      setIsLoading(false);
      return;
    }

    // Затем создаём проект с полученным URL
    const result = await createProject({
      title: projectName.trim(),
      description: description.trim() || null,
      panorama_url: uploadResult.fileUrl,
    });

    setIsLoading(false);

    if (result.success) {
      // Вызываем колбэк для обновления списка проектов
      if (onCreate) {
        onCreate(result.project);
      }
      
      // Закрываем модалку и сбрасываем форму
      setProjectName("");
      setDescription("");
      setSelectedFile(null);
      onClose();
      
      // Показываем уведомление
      alert(`Проект "${projectName}" успешно создан!`);
    } else {
      setError(result.error || "Ошибка при создании проекта");
    }
  };

  // Загрузка файла на сервер
  const uploadFile = async (file) => {
    // Создаем форму для загрузки файла
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8080/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Ошибка при загрузке файла',
        };
      }

      const data = await response.json();
      return {
        success: true,
        fileUrl: data.file_url,
      };
    } catch (error) {
      console.error('Ошибка загрузки файла:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу',
      };
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Опционально: проверка типа
      if (!file.type.match("image/(jpeg|jpg|png)")) {
        setError("Пожалуйста, загрузите изображение в формате JPG или PNG.");
        return;
      }
      setSelectedFile(file);
      setError("");
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
      setError("");
    } else {
      setError("Поддерживаются только файлы формата JPG и PNG.");
    }
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
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
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="error-message">{error}</div>}
          <input
            type="text"
            placeholder="Название проекта *"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="modal-input"
            autoFocus
            required
            disabled={isLoading}
          />
          
            <textarea
              id="description"
              placeholder="Опишите ваш проект"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="modal-textarea"
              rows="3"
              disabled={isLoading}
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
