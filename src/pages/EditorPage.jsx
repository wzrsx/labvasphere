import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getProjects,
  updateProject,
  deleteProject,
  uploadPanorama,
  getHotspots,
  createHotspot,
  updateHotspotApi,
  deleteHotspotApi,
  registerPanorama,
  getMainPanorama,  
} from "../services/projectService";
import SphereViewer from '../components/SphereViewer';
import "./EditorPage.css";
import { CONFIG } from '../config';

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
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [transitionError, setTransitionError] = useState(null);
  const [currentPanoramaId, setCurrentPanoramaId] = useState(null);

  const fileInputRef = useRef(null);
  const sphereViewerRef = useRef(null);
  const activeToolRef = useRef(activeTool);
  
  // Состояние редактора
  const [editorData, setEditorData] = useState({
    title: '',
    description: '',
    hotspots: [],
    media: [],
    settings: { autoRotate: false, rotationSpeed: 0.5, zoomLevel: 1 }
  });

  // Формирование полного URL для медиафайлов
  const getMediaUrl = (relativePath) => {
    if (!relativePath) return null;
    if (relativePath.startsWith('http')) return relativePath;
    return `${CONFIG.MEDIA_BASE_URL}/${relativePath}`;
  };

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
        JSON.stringify(editorData.hotspots) !== JSON.stringify(project.hotspots || []) ||
        JSON.stringify(editorData.media) !== JSON.stringify(project.media || []) ||
        JSON.stringify(editorData.settings) !== JSON.stringify(project.settings || {});
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
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedChanges]);
  // добавляем маркеры загруженных хотспотов в viewer
  
  // Загрузка проекта + основной панорамы + хотспотов
const loadProject = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const response = await getProjects();
    if (!response.success) throw new Error(response.error);
    
    const foundProject = response.projects.find(p => p.id === id);
    if (!foundProject) {
      setError('Проект не найден');
      setLoading(false);
      return;
    }

    // 1. Загружаем основную панораму
    let mainPanorama = foundProject.main_panorama;
    if (!mainPanorama) {
      const mainResult = await getMainPanorama(id);
      if (mainResult.success) {
        mainPanorama = mainResult.panorama;
      }
    }

    setProject({ ...foundProject, main_panorama: mainPanorama });
    
    // СОХРАНЯЕМ ID основной панорамы как текущей
    setCurrentPanoramaId(mainPanorama?.id || null);
    
    // 2. Загружаем хотспоты для основной панорамы
    const hotspotPanoramaId = mainPanorama?.id;
    
    if (hotspotPanoramaId) {
      const hotspotResponse = await getHotspots(hotspotPanoramaId);
      if (hotspotResponse.success) {
        const editorHotspots = hotspotResponse.hotspots.map(h => ({
          id: h.id,
          position: {
            yaw: typeof h.position_yaw === 'number' ? h.position_yaw : parseFloat(h.position_yaw) || 0,
            pitch: typeof h.position_pitch === 'number' ? h.position_pitch : parseFloat(h.position_pitch) || 0,
          },
          title: h.title || '',
          tooltip: h.tooltip || '',
          type: h.target_type === 'panorama' ? 'transition' : 'info',
          targetProjectId: h.target_panorama_id,
          targetFileUrl: h.target_filename
            ? getMediaUrl(`projects/${foundProject.id}/panoramas/${h.target_filename}`)
            : null,
          targetProjectName: h.target_filename || 'Панорама',
          icon: h.icon,
          color: h.color,
        }));
        
        setEditorData(prev => ({ ...prev, hotspots: editorHotspots }));
      }
    }
    
    // 3. Обновляем метаданные
    setEditorData(prev => ({
      ...prev,
      title: foundProject.title || '',
      description: foundProject.description || '',
      media: foundProject.media || [],
      settings: foundProject.settings || { autoRotate: false, rotationSpeed: 0.5, zoomLevel: 1 }
    }));

    setLoading(false);
  } catch (err) {
    console.error('Ошибка загрузки проекта:', err);
    setError(err.message || 'Не удалось загрузить проект');
    setLoading(false);
  }
};

  const handleInputChange = (field, value) => {
    setEditorData(prev => ({ ...prev, [field]: value }));
  };

  // Сохранение проекта (только метаданные, хотспоты уже в БД)
  const handleSave = async () => {
    try {
      setSaving(true);
      const updateData = {
        title: editorData.title,
        description: editorData.description,
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
    if (!window.confirm('Вы уверены, что хотите удалить этот проект?')) return;
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
    // Если кликнули по уже активному инструменту — выключаем его
    if (activeTool === tool) {
      setActiveTool('');
      setSelectedHotspot(null);
      return;
    }
    
    setActiveTool(tool);
    
    // Сбрасываем выбранный хотспот при переключении режимов
    if (tool !== 'hotspot-edit') {
      setSelectedHotspot(null);
    }
    
    // Логи для отладки
    switch(tool) {
      case 'hotspot':
        console.log('🛠️ Режим: добавление новых точек');
        break;
      case 'transition':
        console.log('👁️ Режим: тестирование переходов (клик по хотспоту = переход)');
        break;
      case 'hotspot-edit':
        console.log('✏️ Режим: редактирование хотспота');
        break;
      default:
        console.log('🔓 Режим: обычный просмотр');
    }
  };

  // Обработка выбора файла панорамы для хотспота-перехода
  const handleFileSelect = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    alert('Пожалуйста, выберите изображение (JPG, PNG, WebP)');
    if (fileInputRef.current) fileInputRef.current.value = '';
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    alert('Файл слишком большой. Максимальный размер: 50MB');
    if (fileInputRef.current) fileInputRef.current.value = '';
    return;
  }

  const projectId = project?.id;
  const panoramaId = currentPanoramaId || project?.main_panorama?.id;
  
  if (!projectId || !panoramaId) {
    alert('❌ Проект или панорама не загружены');
    return;
  }

  setUploadingFile(true);
  
  try {
    const uploadResult = await uploadPanorama(file, projectId);
    if (!uploadResult.success) throw new Error(uploadResult.error);
    
    const fileUrl = uploadResult.fileUrl;
    const filename = fileUrl.split('/').pop();
    
    const registerResult = await registerPanorama({
      project_id: projectId,
      filename: filename,
      original_filename: file.name,
      title: `Панорама: ${file.name}`,
      description: '',
      is_main: false,  // это доп. панорама для перехода
    });
    
    if (!registerResult.success) {
      throw new Error(`Не удалось зарегистрировать панораму: ${registerResult.error}`);
    }
    
    const targetPanoramaId = registerResult.panorama.panorama_id;
    
    if (selectedHotspot) {
      const parseCoord = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const num = parseFloat(val.replace(/[^\d.\-]/g, ''));
          return isNaN(num) ? 0 : num;
        }
        return 0;
      };
      
      const hotspotData = {
        panorama_id: panoramaId,  // ← ← ← Текущая панорама
        position_yaw: parseCoord(selectedHotspot.position?.yaw),
        position_pitch: parseCoord(selectedHotspot.position?.pitch),
        target_type: 'panorama',
        target_panorama_id: targetPanoramaId,
        target_filename: filename,  
        title: selectedHotspot.title || null,
        tooltip: selectedHotspot.tooltip || null,
        icon: selectedHotspot.icon || 'default',
        color: selectedHotspot.color || '#3498db',
        is_active: true,
      };
      
      const saveResult = await createHotspot(hotspotData);
      if (!saveResult.success) {
        throw new Error(`Не удалось создать хотспот: ${saveResult.error}`);
      }
      
      const dbHotspot = saveResult.hotspot;
      const updatedHotspot = {
        ...selectedHotspot,
        id: dbHotspot.id,
        targetProjectId: targetPanoramaId,
        targetProjectName: file.name,
        targetFileUrl: fileUrl,
        type: 'transition',
      };
      
      setSelectedHotspot(updatedHotspot);
      updateHotspotLocal(selectedHotspot.id, updatedHotspot);
      alert('✅ Точка перехода сохранена!');
    }
    } catch (err) {
      console.error('[Editor] ❌ Error:', err);
      alert(`❌ ${err.message}`);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);
  
  // Обработчик клика по хотспоту
const handleHotspotClick = async (hotspot) => {
  console.log('Hotspot clicked:', {
    id: hotspot.id,
    type: hotspot.type,
    activeTool: activeToolRef.current,
    targetFileUrl: hotspot.targetFileUrl,
    targetProjectId: hotspot.targetProjectId
  });
  
  // РЕЖИМ ПЕРЕХОДОВ
  if (activeToolRef.current === 'transition' && 
      hotspot.type === 'transition' && 
      hotspot.targetFileUrl) {
    console.log('[Editor] 🔄 Transition mode: navigating to', hotspot.targetFileUrl);
    // Передаём targetPanoramaId для обновления currentPanoramaId
    await handlePanoramaTransition(
      hotspot.targetFileUrl, 
      hotspot.targetProjectName || 'Панорама',
      hotspot.targetProjectId  // ← ← ← КЛЮЧЕВОЕ: ID целевой панорамы
    );
    return;
  }
  
  // Открытие редактора
  setSelectedHotspot(hotspot);
  setActiveTool('hotspot-edit');
};

  // Переход к другой панораме
const handlePanoramaTransition = async (targetUrl, targetName, targetPanoramaId = null) => {
  if (!targetUrl) {
    setTransitionError('Не указан URL панорамы');
    return;
  }
  
  let absoluteUrl = targetUrl;
  if (!targetUrl.startsWith('http')) {
    absoluteUrl = `${CONFIG.MEDIA_BASE_URL}/${targetUrl}`;
  }
  
  console.log('[Transition] 📍 Loading:', absoluteUrl);
  
  setIsTransitioning(true);
  setTransitionProgress(0);
  setTransitionError(null);
  
  try {
    // Предзагрузка с проверкой
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve();
      img.onerror = (err) => reject(new Error('Не удалось загрузить изображение'));
      img.src = absoluteUrl + '?t=' + Date.now();
    });
    
    // Переход
    await sphereViewerRef.current.changePanorama(absoluteUrl, {
      transition: 'fade',
      duration: 800
    });
    
    setTransitionProgress(100);
    setTimeout(() => {
      setIsTransitioning(false);
      setTransitionProgress(0);
    }, 300);
    
    // Обновляем currentPanoramaId и загружаем хотспоты новой панорамы
    if (targetPanoramaId) {
      console.log('[Transition] 🔄 Updating current panorama:', targetPanoramaId);
      
      // Обновляем текущую панораму
      setCurrentPanoramaId(targetPanoramaId);
      
      // Загружаем хотспоты для новой панорамы
      const hotspotResponse = await getHotspots(targetPanoramaId);
      if (hotspotResponse.success) {
        const newHotspots = hotspotResponse.hotspots.map(h => ({
          id: h.id,
          position: {
            yaw: typeof h.position_yaw === 'number' ? h.position_yaw : parseFloat(h.position_yaw) || 0,
            pitch: typeof h.position_pitch === 'number' ? h.position_pitch : parseFloat(h.position_pitch) || 0,
          },
          title: h.title || '',
          tooltip: h.tooltip || '',
          type: h.target_type === 'panorama' ? 'transition' : 'info',
          targetProjectId: h.target_panorama_id,
          targetFileUrl: h.target_filename
            ? getMediaUrl(`projects/${project.id}/panoramas/${h.target_filename}`)
            : null,
          targetProjectName: h.target_filename || 'Панорама',
          icon: h.icon,
          color: h.color,
        }));
        
        console.log('[Transition] ✅ Loaded', newHotspots.length, 'hotspots for new panorama');
        setEditorData(prev => ({ ...prev, hotspots: newHotspots }));
        
        // Сбрасываем выбранный хотспот
        setSelectedHotspot(null);
        setActiveTool('');
      } else {
        console.warn('[Transition] ⚠️ Failed to load hotspots:', hotspotResponse.error);
        setEditorData(prev => ({ ...prev, hotspots: [] }));
      }
    }
    
  } catch (err) {
    console.error('[Transition] ❌ Error:', err);
    setTransitionError(err.message || 'Ошибка загрузки панорамы');
    setIsTransitioning(false);
    setTransitionProgress(0);
  }
};

  // 🔹 Клик по панораме для добавления хотспота
  const handlePositionClick = useCallback(async (position) => {
    console.log('[Editor] 🎯 handlePositionClick called', {
      activeTool: activeToolRef.current,
      selectedHotspot: !!selectedHotspot
    });
    // Проверка: только в режиме добавления новых хотспотов
      if (activeToolRef.current !== 'hotspot') {
        console.log('[Editor] ⚠️ Click ignored: activeTool is', activeToolRef.current);
        return;  // ← просто игнорируем клик, не вызываем handleHotspotClick!
      }
  
    // Парсим координаты в ЧИСЛА (убираем "rad" если есть)
    const parseCoord = (val) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const num = parseFloat(val.replace(/[^\d.\-]/g, ''));
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };
  
    const newHotspot = {
      id: `hotspot_${Date.now()}`,
      position: {
        yaw: parseCoord(position.yaw),
        pitch: parseCoord(position.pitch),
      },
      title: 'Новая точка',
      tooltip: 'Новая точка перехода',
      type: 'transition',
      targetProjectId: null,
      icon: null,
      color: '#3498db',
      targetFileUrl: null,
      linkUrl: ''
    };
    
    console.log('[Editor] 📍 New hotspot position:', newHotspot.position);
    
    // 1. Обновляем состояние — SphereViewer синхронизирует маркеры автоматически
    setEditorData(prev => ({
      ...prev,
      hotspots: [...prev.hotspots, newHotspot]
    }));
    
    // 2. Переключаем в режим редактирования НОВОГО хотспота
    setSelectedHotspot(newHotspot);
    setActiveTool('hotspot-edit');  // ← ← ← переключаем в режим редактирования!
  }, []);

  // Локальное обновление хотспота (без отправки на сервер)
  const updateHotspotLocal = (id, updates) => {
    setEditorData(prev => ({
      ...prev,
      hotspots: prev.hotspots.map(h => h.id === id ? { ...h, ...updates } : h)
    }));
  };

  // Удаление хотспота
  const deleteHotspot = async (hotspotId) => {
    if (!window.confirm('Удалить эту точку перехода?')) return;
    
    try {
      // Если хотспот в БД — удаляем там
      if (!hotspotId.startsWith('hotspot_')) {
        const result = await deleteHotspotApi(hotspotId);
        if (!result.success) throw new Error(result.error);
      }
      
      // Удаляем из локального состояния
      setEditorData(prev => ({
        ...prev,
        hotspots: prev.hotspots.filter(h => h.id !== hotspotId)
      }));
      
      // Удаляем маркер из viewer
      if (sphereViewerRef.current?.getMarkersPlugin) {
        const plugin = sphereViewerRef.current.getMarkersPlugin();
        plugin?.removeMarker(hotspotId);
      }
      
      setSelectedHotspot(null);
    } catch (err) {
      console.error('Ошибка удаления хотспота:', err);
      alert(err.message || 'Не удалось удалить точку');
    }
  };

  // Переход к хотспоту (для предпросмотра)
  const goToHotspot = async (hotspotId) => {
    if (sphereViewerRef.current?.gotoHotspot) {
      await sphereViewerRef.current.gotoHotspot(hotspotId);
    }
  };

  if (loading) return <div className="editor-loading"><div className="spinner"></div><p>Загрузка проекта...</p></div>;
  if (error) return <div className="editor-error"><p>{error}</p><button onClick={() => navigate('/projects')}>Вернуться к проектам</button></div>;
  if (!project) return <div className="editor-error"><p>Проект не найден</p><button onClick={() => navigate('/projects')}>Вернуться к проектам</button></div>;

  // Формируем URL основной панорамы
  const mainPanoramaUrl = project.main_panorama?.filename
    ? getMediaUrl(`projects/${project.id}/panoramas/${project.main_panorama.filename}`)
    : null;
  return (
    <div className="editor-container">
      {/* Основная область панорамы */}
      <div className="panorama-viewer">
        {mainPanoramaUrl ? (
          <SphereViewer 
            ref={sphereViewerRef}
            src={mainPanoramaUrl}  // ← main_panorama.filename
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
        
        {/* 🔹 Оверлей перехода между панорамами */}
        {isTransitioning && (
          <div className="transition-overlay">
            <div className="transition-content">
              <div className="transition-spinner">
                <div className="spinner-ring" />
              </div>
              <p className="transition-text">
                Загрузка: {Math.round(transitionProgress)}%
              </p>
              <p className="transition-subtext">
                {editorData.hotspots.find(h => h.targetFileUrl === project.panorama_url)?.targetProjectName || 'Панорама'}
              </p>
            </div>
            
            {/* Прогресс-бар */}
            <div className="transition-progress-bar">
              <div 
                className="transition-progress-fill"
                style={{ width: `${transitionProgress}%` }}
              />
            </div>
            
            {/* Кнопка отмены */}
            <button 
              className="transition-cancel-btn"
              onClick={() => {
                setIsTransitioning(false);
                setTransitionProgress(0);
              }}
            >
              Отмена
            </button>
          </div>
        )}
        
        {/* 🔹 Сообщение об ошибке перехода */}
        {transitionError && (
          <div className="transition-error">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span>{transitionError}</span>
            <button onClick={() => setTransitionError(null)}>✕</button>
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
          {/* 🔹 Кнопка переключения режима переходов */}
          <div className="mode-toggle" style={{ 
            marginTop: '12px', 
            padding: '8px', 
            background: '#f8fafc', 
            borderRadius: '6px',
            border: '1px solid #e2e8f0'
          }}>
            <label style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={activeTool === 'transition'}
                onChange={(e) => handleToolClick(e.target.checked ? 'transition' : '')}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>👁️ Режим переходов</span>
            </label>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginTop: '4px', marginLeft: '24px' }}>
              {activeTool === 'transition' 
                ? 'Клик по хотспоту = переход к панораме' 
                : 'Клик по хотспоту = открыть редактор'}
            </span>
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
                    updateHotspotLocal(selectedHotspot.id, { title: e.target.value });
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
                    updateHotspotLocal(selectedHotspot.id, { tooltip: e.target.value });
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
                    updateHotspotLocal(selectedHotspot.id, { type: e.target.value });
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
              {selectedHotspot.type === 'transition' && (
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    🔄 Целевая панорама
                  </label>
                  
                  {/* 🔹 Скрытый input для файла */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={uploadingFile}
                    style={{ display: 'none' }}
                  />
                  
                  {/* 🔹 Кнопка загрузки */}
                  <button
                    onClick={() => !uploadingFile && fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: uploadingFile ? '#94a3b8' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      cursor: uploadingFile ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                    }}
                  >
                    {uploadingFile ? (
                      <>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid white',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />
                        Загрузка...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Загрузить файл панорамы
                      </>
                    )}
                  </button>
                  
                  {/* 🔹 Индикатор загруженного файла */}
                  {selectedHotspot.targetFileUrl && (
                    <div style={{ 
                      padding: '8px', 
                      background: '#f0fdf4', 
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#166534',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>✓ {selectedHotspot.targetProjectName}</span>
                      <button
                        onClick={() => {
                          setSelectedHotspot(prev => ({
                            ...prev,
                            targetProjectId: null,
                            targetProjectName: null,
                            targetFileUrl: null
                          }));
                          updateHotspotLocal(selectedHotspot.id, {
                            targetProjectId: null,
                            targetProjectName: null,
                            targetFileUrl: null
                          });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '0 4px'
                        }}
                        title="Удалить выбор"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}              
              {selectedHotspot.type === 'link' && (
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>URL ссылки</label>
                  <input 
                    type="url" 
                    value={selectedHotspot.linkUrl || ''}
                    onChange={(e) => {
                      setSelectedHotspot(prev => ({ ...prev, linkUrl: e.target.value }));
                      updateHotspotLocal(selectedHotspot.id, { linkUrl: e.target.value });
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