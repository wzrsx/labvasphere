import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import SphereViewer from "./SphereViewer";
import { createProject, uploadPanorama, uploadCover } from "../services/projectService";
import api from '../services/api';

const ASPECT_RATIO = 16 / 9;
const COVER_WIDTH = 1280;
const COVER_HEIGHT = Math.round(COVER_WIDTH / ASPECT_RATIO);

// 🔹 Функция создания сжатого превью
const createPreview = (file) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      const maxWidth = 2048;
      const scale = Math.min(1, maxWidth / img.width);
      
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          } else {
            reject(new Error('Failed to create preview'));
          }
        },
        'image/jpeg',
        0.75
      );
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

const NewProjectModal = ({ isOpen, onClose, onCreate }) => {
  // 🔹 ВСЕ ХУКИ — СТРОГО В НАЧАЛЕ
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [panoramaFile, setPanoramaFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [panoramaPreview, setPanoramaPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewerStep, setViewerStep] = useState(false);
  
  const handleViewerReady = useCallback((viewer) => {
    console.log('✅ Viewer ready');
  }, []);

  const handleViewerError = useCallback((err) => {
    console.error('❌ Viewer error:', err);
    setError(`Ошибка: ${err.message}`);
  }, [setError]); 

  const sphereViewerRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // 🔹 РЕФ для отслеживания перетаскивания
  const isDraggingRef = useRef(false);
  const dragTimeoutRef = useRef(null);

  // 🔹 Стабилизированный стиль для viewer
  const viewerStyle = useMemo(() => ({ 
    height: '225px', 
    borderRadius: '8px' 
  }), []);

  // 🔹 Очистка объектных URL
  useEffect(() => {
    return () => {
      if (coverPreview && coverPreview.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreview);
      }
    };
  }, [coverPreview]);

  // 🔹 Глобальные слушатели для перетаскивания
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        dragTimeoutRef.current = setTimeout(() => {
          isDraggingRef.current = false;
        }, 200);
      }
    };

    const handleGlobalMouseDown = () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mousedown', handleGlobalMouseDown);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousedown', handleGlobalMouseDown);
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, []);

  // 🔹 Захват обложки 16:9
  const captureCoverImage = useCallback(async () => {
  const viewer = sphereViewerRef.current?.getInstance?.();
  if (!viewer) {
    setError("Viewer ещё не готов. Попробуйте ещё раз.");
    return;
  }

  try {
    console.log('[Cover] Starting capture...');

    // 🔹 Ждём событие render и делаем скриншот
    const screenshot = await new Promise((resolve, reject) => {
      // Слушаем один раз событие render
      const onRender = () => {
        try {
          // 🔹 Правильный путь к canvas: renderer.renderer.domElement
          const canvas = viewer.renderer?.renderer?.domElement;
          
          if (!canvas) {
            reject(new Error('Canvas not found'));
            return;
          }
          
          console.log('[Cover] Canvas:', { width: canvas.width, height: canvas.height });
          
          // Конвертируем в DataURL
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      
      // Подписываемся на render (один раз)
      viewer.addEventListener('render', onRender, { once: true });
      
      // 🔹 Запрашиваем перерисовку — это триггерит событие render
      viewer.needsUpdate();
      
      // 🔹 Таймаут на случай если render не сработает
      setTimeout(() => {
        viewer.removeEventListener('render', onRender);
        reject(new Error('Render timeout'));
      }, 3000);
    });

    console.log('[Cover] Screenshot created, length:', screenshot.length);
    
    // 🔹 Конвертируем DataURL в Blob
    const blob = await fetch(screenshot).then(r => r.blob());
    console.log('[Cover] Blob size:', blob.size);
    
    const file = new File([blob], `cover_${Date.now()}.jpg`, { type: 'image/jpeg' });
    
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError("");
    console.log('[Cover] Success!');
    
  } catch (err) {
    console.error('[Cover] Error:', err);
    setError('Не удалось создать обложку. Попробуйте ещё раз.');
  }
}, []);

  // 🔹 Загрузка файла на сервер
  const uploadFile = async (file, endpoint = '/upload') => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: true, fileUrl: response.data.file_url };
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Ошибка загрузки',
      };
    }
  };

  // 🔹 Ранний возврат
  if (!isOpen) return null;

  // 🔹 Закрытие модалки
  const handleClose = () => {
    if (isDraggingRef.current) return;
    
    if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    resetForm();
    onClose();
  };

  // 🔹 Отправка формы
  const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");

  if (!projectName.trim()) {
    setError("Название проекта обязательно");
    return;
  }
  if (!panoramaFile) {
    setError("Выберите файл панорамы");
    return;
  }
  if (!coverFile) {
    setError("Выберите обложку проекта");
    return;
  }

  setIsLoading(true);

  try {
    // 🔹 1. Загружаем панораму
    const panoramaResult = await uploadPanorama(panoramaFile);
    if (!panoramaResult.success) {
      throw new Error(panoramaResult.error);
    }

    // 🔹 2. Загружаем обложку
    const coverResult = await uploadCover(coverFile);
    if (!coverResult.success) {
      throw new Error(coverResult.error);
    }

    // 🔹 3. Создаём проект с путями из ответов
    const result = await createProject({
      title: projectName.trim(),
      description: description.trim() || null,
      panorama_url: panoramaResult.fileUrl,      // "panoramas/uuid_123.jpg"
      cover_image_url: coverResult.fileUrl,      // "covers/uuid_456.jpg"
    });

    if (result.success) {
      if (onCreate) onCreate(result.project);
      resetForm();
      onClose();
      alert(`Проект "${result.project.title}" успешно создан!`);
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    setError(err.message || "Ошибка при создании проекта");
  } finally {
    setIsLoading(false);
  }
};

  // 🔹 Сброс формы
  const resetForm = () => {
    setProjectName("");
    setDescription("");
    setPanoramaFile(null);
    setCoverFile(null);
    setPanoramaPreview(null);
    setCoverPreview(null);
    setViewerStep(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 🔹 Валидация панорамы
  const validateAndSetPanorama = async (file) => {
    if (!file) return;
    
    if (!file.type.match("image/(jpeg|jpg|png)")) {
      setError("Поддерживаются только JPG и PNG");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Максимальный размер файла: 50 МБ");
      return;
    }
    
    try {
      setError("");
      setViewerStep(true);
      
      const previewStart = Date.now();
      const previewUrl = await createPreview(file);
      
      console.log(`✅ Preview created in ${Date.now() - previewStart}ms`);
      console.log('Preview size:', (previewUrl.length / 1024 / 1024).toFixed(2), 'MB');
      
      setPanoramaFile(file);
      setPanoramaPreview(previewUrl);
      
    } catch (err) {
      console.error('Error creating preview:', err);
      setError('Не удалось обработать изображение');
      setViewerStep(false);
    }
  };

  const handleFileChange = (e) => validateAndSetPanorama(e.target.files[0]);
  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = () => setDragActive(false);
  
  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    validateAndSetPanorama(e.dataTransfer.files[0]);
  };

  // 🔹 Обработчик mousedown на viewer
  const handleViewerMouseDown = (e) => {
    if (e.button === 0) {
      isDraggingRef.current = true;
    }
  };

  // 🔹 Рендер
  return (
    <div className="modal-overlay" onClick={handleClose}>
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
            disabled={isLoading}
            required
            autoFocus
          />
          
          <textarea
            placeholder="Описание проекта (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="modal-textarea"
            rows="3"
            disabled={isLoading}
          />

          {/* Загрузка панорамы */}
          {!viewerStep && (
            <div className="file-upload-section">
              <label className="file-upload-label">
                {panoramaFile ? panoramaFile.name : "Выберите панораму (JPG/PNG)"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/*"
                  onChange={handleFileChange}
                  hidden
                />
              </label>
            </div>
          )}

          {/* Viewer + выбор обложки */}
          {viewerStep && panoramaPreview && (
            <div className="viewer-section">
              <div className="viewer-header">
                <h4>Настройте ракурс для обложки</h4>
              </div>
              
              <div 
                className="viewer-wrapper"
                onMouseDown={handleViewerMouseDown}
              >
                <SphereViewer
                  key={panoramaPreview}
                  ref={sphereViewerRef}
                  src={panoramaPreview}
                  style={viewerStyle}
                  navbar={['zoom', 'fullscreen']}
                  autoRotate={false}
                  mousemove={true}
                  onViewerReady={handleViewerReady}
                  onError={handleViewerError}
                />
                <div className="aspect-hint">
                  <span>16:9</span>
                </div>
              </div>
              
              <div className="viewer-controls">
                {/*Выбрать обложку */}
                {!coverFile ? (
                  <button
                    type="button"
                    className="btn-capture"
                    onClick={captureCoverImage}
                    disabled={isLoading}
                  >
                    Сохранить выбор
                  </button>
                ) : (
                  <div className="cover-preview">
                    <span>Обложка выбрана</span>
                    <button
                      type="button"
                      className="btn-remove-cover"
                      onClick={() => {
                        setCoverFile(null);
                        setCoverPreview(null);
                      }}
                      disabled={isLoading}
                      title="Выбрать другой ракурс"
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="modal-actions">
            <button 
              type="button" 
              onClick={handleClose} 
              className="modal-cancel"
              disabled={isLoading}
            >
              Отмена
            </button>
            
            <button
              type="submit"
              className="modal-create"
              disabled={isLoading || !projectName || !coverFile}
            >
              {isLoading ? "Создание..." : "Создать проект"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectModal;