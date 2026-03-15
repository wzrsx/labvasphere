import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [activeTool, setActiveTool] = useState('');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const sphereViewerRef = useRef(null);
  const activeToolRef = useRef(activeTool);
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

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  
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

      const foundProject = response.projects.find(p => p.id === id);
      
      if (!foundProject) {
        setError('Проект не найден или у вас нет прав на его редактирование');
        setLoading(false);
        return;
      }

      setProject(foundProject);
      
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
    window.open(`/preview/${id}`, '_blank');
  };

  const handleToolClick = (tool) => {
    setActiveTool(tool);
    // Сбрасываем выбранный хотспот при переключении на обычный режим
    if (tool === 'hotspot' && selectedHotspot) {
      setSelectedHotspot(null);
    }
    
    switch(tool) {
      case 'hotspot':
        console.log('Режим добавления точек перехода');
        break;
      case 'annotation':
        console.log('Режим аннотаций');
        break;
      case 'media':
        console.log('Добавление медиа');
        break;
      case 'settings':
        console.log('Настройки панорамы');
        break;
      default:
        break;
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };
  
  // 🔹 Обработчик клика по хотспоту
  const handleHotspotClick = (hotspot) => {
    console.log('Hotspot clicked:', hotspot);
    setSelectedHotspot(hotspot);
    setActiveTool('hotspot-edit');
  };

  // 🔹 Обработчик клика по панораме для добавления нового хотспота
  const handlePositionClick = useCallback(async (position) => {
  console.log('[Editor] 🎯 handlePositionClick called', { 
    activeTool: activeToolRef.current,  // ← ✅ Актуальное значение из ref
    selectedHotspot: !!selectedHotspot 
  });
  
  // 🔹 Проверка: только в режиме добавления — ИСПОЛЬЗУЕМ REF!
  if (activeToolRef.current !== 'hotspot') {  // ← ✅ Всегда актуально!
    console.log('[Editor] ⚠️ Click ignored: activeTool is', activeToolRef.current);
    return;
  }
  
  const newHotspot = {
    id: `hotspot_${Date.now()}`,
    position,
    image: '/logo.jpg',
    title: 'Новая точка',
    description: '',
    type: 'transition',
    targetProjectId: null,
    icon: null,
    tooltip: 'Новая точка перехода',
    linkUrl: ''
  };
  
  // 1. Обновляем состояние
  setEditorData(prev => ({
    ...prev,
    hotspots: [...prev.hotspots, newHotspot]
  }));
  
  // 2. Мгновенно добавляем маркер в viewer
  if (sphereViewerRef.current?.isReady?.() && sphereViewerRef.current?.getMarkersPlugin) {
    const plugin = sphereViewerRef.current.getMarkersPlugin();
    if (plugin) {
      plugin.addMarker({
        id: newHotspot.id,
        position: newHotspot.position,
        image: '/logo.jpg',
        size: { width: 40, height: 40 },
        anchor: [50, 100],
        tooltip: { content: '✨ Новая точка', position: 'top center' },
        style: { cursor: 'pointer' },
        data: { ...newHotspot }
      });
      
      // Анимация подтверждения
      requestAnimationFrame(() => {
        const el = document.getElementById(`psv-marker-${newHotspot.id}`);
        if (el) {
          el.animate(
            [
              { transform: 'scale(1)', opacity: 1, offset: 0 },
              { transform: 'scale(1.4)', opacity: 1, offset: 0.5 },
              { transform: 'scale(1)', opacity: 1, offset: 1 }
            ],
            { duration: 250, easing: 'ease-out' }
          );
        }
      });
    }
  }
  
  // 3. Переключаем режим
  console.log('[Editor] 🔄 Setting activeTool to hotspot-edit');
  setSelectedHotspot(newHotspot);
  setActiveTool('hotspot-edit');
  
}, []); // ← Пустой массив — функция не пересоздаётся, но ref всегда актуален!

  // 🔹 Обновление хотспота
  const updateHotspot = (id, updates) => {
    setEditorData(prev => ({
      ...prev,
      hotspots: prev.hotspots.map(h => 
        h.id === id ? { ...h, ...updates } : h
      )
    }));
  };

  // 🔹 Удаление хотспота
  const deleteHotspot = (hotspotId) => {
    if (window.confirm('Удалить эту точку перехода?')) {
      // Удаляем из состояния
      setEditorData(prev => ({
        ...prev,
        hotspots: prev.hotspots.filter(h => h.id !== hotspotId)
      }));
      
      // Мгновенно удаляем из viewer
      if (sphereViewerRef.current?.getMarkersPlugin) {
        const plugin = sphereViewerRef.current.getMarkersPlugin();
        if (plugin) {
          plugin.removeMarker(hotspotId);
        }
      }
      
      setSelectedHotspot(null);
    }
  };

  // 🔹 Переход к хотспоту (для предпросмотра)
  const goToHotspot = async (hotspotId) => {
    if (sphereViewerRef.current?.gotoHotspot) {
      await sphereViewerRef.current.gotoHotspot(hotspotId);
    }
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
            ref={sphereViewerRef}
            src={project.panorama_url} 
            hotspots={editorData.hotspots}
            onHotspotClick={handleHotspotClick}
            onPositionClick={handlePositionClick}
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

          {/* 🔹 Панель редактирования хотспота */}
          {(activeTool === 'hotspot' || activeTool === 'hotspot-edit') && selectedHotspot && (
            <div className="hotspot-editor-panel" style={{ 
              marginTop: '16px', 
              paddingTop: '16px', 
              borderTop: '1px solid #e2e8f0' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>✏️ Редактирование точки</h4>
                <button 
                  onClick={() => { setSelectedHotspot(null); setActiveTool(''); }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#64748b', 
                    cursor: 'pointer', 
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Закрыть"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
              
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Название</label>
                <input 
                  type="text" 
                  value={selectedHotspot.title || ''} 
                  onChange={(e) => {
                    setSelectedHotspot(prev => ({ ...prev, title: e.target.value }));
                    updateHotspot(selectedHotspot.id, { title: e.target.value });
                  }}
                  placeholder="Название точки"
                  style={{ 
                    width: '100%', 
                    padding: '8px 12px', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '6px',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Подсказка (tooltip)</label>
                <textarea 
                  value={selectedHotspot.tooltip || ''}
                  onChange={(e) => {
                    setSelectedHotspot(prev => ({ ...prev, tooltip: e.target.value }));
                    updateHotspot(selectedHotspot.id, { tooltip: e.target.value });
                  }}
                  placeholder="Текст подсказки при наведении"
                  rows={2}
                  style={{ 
                    width: '100%', 
                    padding: '8px 12px', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '6px',
                    fontSize: '13px',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Тип точки</label>
                <select 
                  value={selectedHotspot.type || 'transition'}
                  onChange={(e) => {
                    setSelectedHotspot(prev => ({ ...prev, type: e.target.value }));
                    updateHotspot(selectedHotspot.id, { type: e.target.value });
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '8px 12px', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'white',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="transition">🔄 Переход к панораме</option>
                  <option value="info">ℹ️ Информационная</option>
                  <option value="media">🎬 Медиа-контент</option>
                  <option value="link">🔗 Внешняя ссылка</option>
                </select>
              </div>
                            
              {selectedHotspot.type === 'link' && (
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>URL ссылки</label>
                  <input 
                    type="url" 
                    value={selectedHotspot.linkUrl || ''}
                    onChange={(e) => {
                      setSelectedHotspot(prev => ({ ...prev, linkUrl: e.target.value }));
                      updateHotspot(selectedHotspot.id, { linkUrl: e.target.value });
                    }}
                    placeholder="https://example.com"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '6px',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
              
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Координаты</label>
                <code style={{ 
                  fontSize: '10px', 
                  display: 'block', 
                  background: '#f8fafc', 
                  padding: '6px 8px', 
                  borderRadius: '4px',
                  color: '#475569',
                  fontFamily: 'monospace'
                }}>
                  yaw: {selectedHotspot.position?.yaw || '—'}<br/>
                  pitch: {selectedHotspot.position?.pitch || '—'}
                </code>
              </div>
              
              <div className="actions-buttons" style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="action-btn secondary"
                  onClick={() => goToHotspot(selectedHotspot.id)}
                  style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }}
                >
                  🔍 Перейти
                </button>
                <button 
                  className="action-btn danger"
                  onClick={() => deleteHotspot(selectedHotspot.id)}
                  style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }}
                >
                  🗑️ Удалить
                </button>
              </div>
            </div>
          )}

          {/* 🔹 Подсказка для режима добавления */}
          {activeTool === 'hotspot' && !selectedHotspot && (
            <div className="hotspot-hint" style={{ 
              marginTop: '12px', 
              padding: '10px 12px', 
              background: '#eff6ff', 
              border: '1px solid #bfdbfe', 
              borderRadius: '6px',
              fontSize: '12px',
              color: '#1e40af'
            }}>
              💡 Кликните по панораме, чтобы добавить новую точку перехода
            </div>
          )}
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