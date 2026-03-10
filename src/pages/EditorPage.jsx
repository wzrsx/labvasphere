import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProjects, updateProject, deleteProject } from "../services/projectService";
import SphereViewer from '../components/SphereViewer';
import "./EditorPage.css";

const EditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const panoramaContainerRef = useRef(null);

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTool, setActiveTool] = useState('hotspot');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Состояние редактора
  const [editorData, setEditorData] = useState({
    title: '',
    description: '',
    hotspots: [],
    media: [],
    settings: {
      autoRotate: false,
      rotationSpeed: 0.5,
      zoomLevel: 1
    }
  });

  // Загрузка проекта при монтировании
  useEffect(() => {
    loadProject();
  }, [id]);

  // Отслеживание изменений
  useEffect(() => {
    if (project) {
      const hasChanges = 
        editorData.title !== project.title ||
        editorData.description !== project.description ||
        JSON.stringify(editorData.hotspots) !== JSON.stringify(project.hotspots) ||
        JSON.stringify(editorData.media) !== JSON.stringify(project.media) ||
        JSON.stringify(editorData.settings) !== JSON.stringify(project.settings);
      
      setUnsavedChanges(hasChanges);
    }
  }, [editorData, project]);

  // Предупреждение о несохраненных изменениях
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [unsavedChanges]);

  const loadProject = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getProjects();
      
      if (!response.success) {
        throw new Error(response.error || 'Ошибка загрузки проектов');
      }

      // Находим проект по ID среди проектов текущего пользователя
      const foundProject = response.projects.find(p => p.id === id);
      console.log(response.projects);
      console.log(foundProject);
      if (!foundProject) {
        setError('Проект не найден или у вас нет прав на его редактирование');
        setLoading(false);
        return;
      }

      setProject(foundProject);
      
      // Инициализируем данные редактора
      setEditorData({
        title: foundProject.title || '',
        description: foundProject.description || '',
        hotspots: foundProject.hotspots || [],
        media: foundProject.media || [],
        settings: foundProject.settings || {
          autoRotate: false,
          rotationSpeed: 0.5,
          zoomLevel: 1
        }
      });

      setLoading(false);
    } catch (err) {
      console.error('Ошибка загрузки проекта:', err);
      setError(err.message || 'Не удалось загрузить проект');
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditorData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updateData = {
        title: editorData.title,
        description: editorData.description,
        hotspots: editorData.hotspots,
        media: editorData.media,
        settings: editorData.settings
      };

      const response = await updateProject(id, updateData);

      if (response.success) {
        setProject(response.project);
        setUnsavedChanges(false);
        alert('Проект успешно сохранен!');
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      alert(err.message || 'Не удалось сохранить проект');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить этот проект? Это действие нельзя отменить.')) {
      return;
    }

    try {
      const response = await deleteProject(id);

      if (response.success) {
        alert('Проект успешно удален');
        navigate('/projects');
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      console.error('Ошибка удаления:', err);
      alert(err.message || 'Не удалось удалить проект');
    }
  };

  const handlePreview = () => {
    // Открыть предпросмотр в новом окне или на отдельной странице
    window.open(`/preview/${id}`, '_blank');
  };

  const handleToolClick = (tool) => {
    setActiveTool(tool);
    
    switch(tool) {
      case 'hotspot':
        console.log('Режим добавления точек перехода');
        // Логика добавления хотспота
        break;
      case 'annotation':
        console.log('Режим аннотаций');
        // Логика добавления аннотаций
        break;
      case 'media':
        console.log('Добавление медиа');
        // Логика добавления медиа
        break;
      case 'settings':
        console.log('Настройки панорамы');
        // Логика настроек
        break;
      default:
        break;
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };
  
  if (loading) {
    return (
      <div className="editor-loading">
        <div className="spinner"></div>
        <p>Загрузка проекта...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editor-error">
        <svg className="error-icon" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <p>{error}</p>
        <button onClick={() => navigate('/projects')} className="back-btn">
          Вернуться к проектам
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="editor-error">
        <p>Проект не найден</p>
        <button onClick={() => navigate('/projects')} className="back-btn">
          Вернуться к проектам
        </button>
      </div>
    );
  }

  return (
    <div className="editor-container">
      {/* Основная область панорамы */}
      <div className="panorama-viewer">
        {project.panorama_url ? (
          <SphereViewer 
            src={project.panorama_url} 
            hotspots={editorData.hotspots}
            onHotspotClick={(hotspotId) => console.log('Hotspot clicked:', hotspotId)}
          />
        ) : (
          <div className="panorama-placeholder">
            <div className="empty-state">
              <svg className="empty-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
              <p>Панорама не загружена</p>
            </div>
          </div>
        )}
      </div>

      {/* Боковая панель инструментов */}
      <div className={`editor-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <button 
          className={`collapse-btn ${isSidebarCollapsed ? 'collapsed' : ''}`}
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
        >
          {isSidebarCollapsed ? (
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
          )}
        </button>
          <h3>Редактор проекта</h3>
        </div>

        <div className="project-info">
          <div className="form-group">
            <label>Название</label>
            <input 
              type="text" 
              value={editorData.title} 
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Название проекта"
              className="project-title-input"
            />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea 
              value={editorData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Описание проекта"
              className="project-description-input"
            />
          </div>
        </div>

        <div className="tools-section">
          <h4>Инструменты</h4>
          <div className="tools-grid">
            <button 
              className={`tool-btn ${activeTool === 'hotspot' ? 'active' : ''}`}
              onClick={() => handleToolClick('hotspot')}
              title="Точки перехода"
            >
              <svg className="tool-icon" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="12" r="4" fill="currentColor"/>
              </svg>
              <span>Точки перехода</span>
            </button>

            <button 
              className={`tool-btn ${activeTool === 'annotation' ? 'active' : ''}`}
              onClick={() => handleToolClick('annotation')}
              title="Аннотации"
            >
              <svg className="tool-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span>Текст</span>
            </button>

            <button 
              className={`tool-btn ${activeTool === 'media' ? 'active' : ''}`}
              onClick={() => handleToolClick('media')}
              title="Медиа"
            >
              <svg className="tool-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15h2v2H8zm0-4h2v2H8zm0-4h2v2H8zm4 8h2v2h-2zm0-4h2v2h-2zm0-4h2v2h-2zm4 8h2v2h-2zm0-4h2v2h-2zm0-4h2v2h-2z"/>
              </svg>
              <span>Медиа</span>
            </button>

            <button 
              className={`tool-btn ${activeTool === 'settings' ? 'active' : ''}`}
              onClick={() => handleToolClick('settings')}
              title="Настройки"
            >
              <svg className="tool-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
              </svg>
              <span>Настройки</span>
            </button>
          </div>
        </div>

        <div className="actions-section">
          <h4>Действия</h4>
          <div className="actions-buttons">
            <button 
              className={`action-btn primary ${saving ? 'loading' : ''}`}
              onClick={handleSave}
              disabled={!unsavedChanges || saving}
            >
              {saving ? (
                <>
                  <div className="spinner-small"></div>
                  <span>Сохранение...</span>
                </>
              ) : unsavedChanges ? (
                <>
                  <svg className="action-icon" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                  </svg>
                  <span>Сохранить изменения</span>
                </>
              ) : (
                <>
                  <svg className="action-icon" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                  </svg>
                  <span>Сохранено</span>
                </>
              )}
            </button>
            
            <button 
              className="action-btn secondary"
              onClick={handlePreview}
            >
              <svg className="action-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
              <span>Предпросмотр</span>
            </button>
            
            <button 
              className="action-btn danger"
              onClick={handleDelete}
            >
              <svg className="action-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
              <span>Удалить проект</span>
            </button>
          </div>
        </div>

        <div className="project-stats">
          <div className="stat-item">
            <span className="stat-label">Точки перехода:</span>
            <span className="stat-value">{editorData.hotspots.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Медиа-элементы:</span>
            <span className="stat-value">{editorData.media.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">ID проекта:</span>
            <span className="stat-value">{project.id}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Статус:</span>
            <span className={`stat-value status-${project.status}`}>
              {project.status === 'published' ? 'Опубликован' : 'Черновик'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;