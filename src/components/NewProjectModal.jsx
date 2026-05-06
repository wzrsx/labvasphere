import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import SphereViewer from './SphereViewer';
import {
  createProject,
  uploadPanorama,
  uploadCover,
  updateProject,
  registerPanorama,
} from '../services/projectService';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const ASPECT_RATIO = 16 / 9;
const COVER_WIDTH = 1280;
const COVER_HEIGHT = Math.round(COVER_WIDTH / ASPECT_RATIO);

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
          } else reject(new Error('Failed to create preview'));
        },
        'image/jpeg',
        0.75,
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

const NewProjectModal = ({ isOpen, onClose, onCreate }) => {
  const { t } = useTranslation(); 
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [panoramaFile, setPanoramaFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [panoramaPreview, setPanoramaPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewerStep, setViewerStep] = useState(false);

  const sphereViewerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragTimeoutRef = useRef(null);

  const handleViewerReady = useCallback(
    (viewer) => console.log('✅ Viewer ready'),
    [],
  );
  const handleViewerError = useCallback((err) => {
    console.error('❌ Viewer error:', err);
    setError(`Ошибка: ${err.message}`);
  }, []);

  const viewerStyle = useMemo(
    () => ({ height: '225px', borderRadius: '8px' }),
    [],
  );

  useEffect(() => {
    return () => {
      if (coverPreview && coverPreview.startsWith('blob:'))
        URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        dragTimeoutRef.current = setTimeout(() => {
          isDraggingRef.current = false;
        }, 200);
      }
    };
    const handleGlobalMouseDown = () => {
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    };
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mousedown', handleGlobalMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousedown', handleGlobalMouseDown);
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    };
  }, []);

  const captureCoverImage = useCallback(async () => {
    const viewer = sphereViewerRef.current?.getInstance?.();
    if (!viewer) {
      setError('Viewer ещё не готов');
      return;
    }

    try {
      const screenshot = await new Promise((resolve, reject) => {
        const onRender = () => {
          try {
            const canvas = viewer.renderer?.renderer?.domElement;
            if (!canvas) {
              reject(new Error('Canvas not found'));
              return;
            }
            resolve(canvas.toDataURL('image/jpeg', 0.92));
          } catch (err) {
            reject(err);
          }
        };
        viewer.addEventListener('render', onRender, { once: true });
        viewer.needsUpdate();
        setTimeout(() => {
          viewer.removeEventListener('render', onRender);
          reject(new Error('Render timeout'));
        }, 3000);
      });

      const blob = await fetch(screenshot).then((r) => r.blob());
      const file = new File([blob], `cover_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
      setError('');
    } catch (err) {
      console.error('[Cover] Error:', err);
      setError('Не удалось создать обложку');
    }
  }, []);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isDraggingRef.current) return;
    if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
    if (coverPreview && coverPreview.startsWith('blob:'))
      URL.revokeObjectURL(coverPreview);
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!projectName.trim()) {
      setError('Название проекта обязательно');
      return;
    }
    if (!panoramaFile) {
      setError('Выберите файл панорамы');
      return;
    }
    if (!coverFile) {
      setError('Выберите обложку проекта');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔹 Шаг 1: Создаём проект (без файлов)...');

      // 1. Сначала создаём проект — получаем project_id
      const projectResult = await createProject({
        title: projectName.trim(),
        description: description.trim() || null,
        cover_image_url: null,
        panorama_filename: null,
        panorama_original_name: null,
        status: 'draft',
      });

      console.log('🔹 Ответ от createProject:', projectResult);

      if (!projectResult.success) {
        throw new Error(`createProject failed: ${projectResult.error}`);
      }

      const project = projectResult.project;
      const projectId = project?.id;

      console.log('🔹 Проект создан, ID:', projectId);

      if (!projectId) {
        throw new Error('Project ID is missing in response');
      }

      // 2. Загружаем панораму с project_id
      console.log('🔹 Шаг 2: Загружаем панораму...', { projectId });

      const panoramaResult = await uploadPanorama(panoramaFile, projectId);
      console.log('🔹 Ответ от uploadPanorama:', panoramaResult);

      if (!panoramaResult.success) {
        throw new Error(`uploadPanorama failed: ${panoramaResult.error}`);
      }

      const panoramaFilename = panoramaResult.filename;

      // 3. Загружаем обложку с project_id
      console.log('🔹 Шаг 3: Загружаем обложку...', { projectId });

      const coverResult = await uploadCover(coverFile, projectId);
      console.log('🔹 Ответ от uploadCover:', coverResult);

      if (!coverResult.success) {
        throw new Error(`uploadCover failed: ${coverResult.error}`);
      }

      // 4. Регистрируем основную панораму в БД (is_main: true)
      console.log('🔹 Шаг 4: Регистрируем основную панораму...');

      const registerResult = await registerPanorama({
        project_id: projectId,
        filename: panoramaFilename,
        original_filename: panoramaFile.name,
        title: `${projectName.trim()} - Основная панорама`,
        description: '',
        is_main: true,
      });

      console.log('🔹 Ответ от registerPanorama:', registerResult);

      if (!registerResult.success) {
        console.warn(
          '⚠️ Не удалось зарегистрировать панораму:',
          registerResult.error,
        );
        // Не прерываем — проект создан, панораму можно добавить позже
      }

      // 5. Обновляем проект с cover_image_url
      console.log('🔹 Шаг 5: Обновляем проект...');

      const updateResult = await updateProject(projectId, {
        cover_image_url: coverResult.fileUrl,
        status: 'published',
      });

      console.log('🔹 Ответ от updateProject:', updateResult);

      if (!updateResult.success) {
        throw new Error(`updateProject failed: ${updateResult.error}`);
      }

      // ✅ Успех
      if (onCreate) onCreate(updateResult.project);
      resetForm();
      onClose();
      alert(`Проект "${projectName.trim()}" успешно создан!`);
    } catch (err) {
      console.error('❌ Ошибка в handleSubmit:', err);
      setError(err.message || 'Ошибка при создании проекта');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setProjectName('');
    setDescription('');
    setPanoramaFile(null);
    setCoverFile(null);
    setPanoramaPreview(null);
    setCoverPreview(null);
    setViewerStep(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateAndSetPanorama = async (file) => {
    if (!file) return;
    if (!file.type.match('image/(jpeg|jpg|png)')) {
      setError('Поддерживаются только JPG и PNG');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('Максимальный размер: 50 МБ');
      return;
    }
    try {
      setError('');
      setViewerStep(true);
      const previewUrl = await createPreview(file);
      setPanoramaFile(file);
      setPanoramaPreview(previewUrl);
    } catch (err) {
      console.error('Error creating preview:', err);
      setError('Не удалось обработать изображение');
      setViewerStep(false);
    }
  };

  const handleFileChange = (e) => validateAndSetPanorama(e.target.files[0]);
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = () => setDragActive(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    validateAndSetPanorama(e.dataTransfer.files[0]);
  };
  const handleViewerMouseDown = (e) => {
    if (e.button === 0) isDraggingRef.current = true;
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className={`modal-content ${dragActive ? 'drag-over' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <h2>{t('newProject.modal.title')}</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="error-message">{error}</div>}

          <input
            type="text"
            placeholder={t('newProject.form.name_placeholder')}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="modal-input"
            disabled={isLoading}
            required
            autoFocus
          />

          <textarea
            placeholder={t('newProject.form.description_placeholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="modal-textarea"
            rows="3"
            disabled={isLoading}
          />

          {!viewerStep && (
            <div className="file-upload-section">
              <label className="file-upload-label">
                {panoramaFile
                  ? panoramaFile.name
                  : t('newProject.form.panorama_placeholder')}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/*"
                  onChange={handleFileChange}
                  hidden
                  aria-label={t('newProject.form.panorama_label')}
                />
              </label>
            </div>
          )}

          {viewerStep && panoramaPreview && (
            <div className="viewer-section">
              <div className="viewer-header">
                <h4>{t('newProject.viewer.title')}</h4>
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
                {!coverFile ? (
                  <button
                    type="button"
                    className="btn-capture"
                    onClick={captureCoverImage}
                    disabled={isLoading}
                  >
                    {t('newProject.viewer.capture_button')}
                  </button>
                ) : (
                  <div className="cover-preview">
                    <span>{t('newProject.viewer.cover_selected')}</span>
                    <button
                      type="button"
                      className="btn-remove-cover"
                      onClick={() => {
                        setCoverFile(null);
                        setCoverPreview(null);
                      }}
                      disabled={isLoading}
                    >
                      {t('newProject.viewer.remove_cover')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              className="modal-cancel"
              disabled={isLoading}
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              className="modal-create"
              disabled={isLoading || !projectName || !coverFile}
            >
              {isLoading ? t('newProject.form.creating') : t('newProject.form.create_button')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectModal;
