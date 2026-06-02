import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  getPanoramasByProject,
  uploadHotspotImage,
} from '../services/projectService';
import { getUserSettings } from '../services/userSettingsService.js';
import {
  convertHotspotToEditor,
  convertHotspotsToMarkers,
  loadHotspotsForPanorama,
  prepareHotspotForApi,
} from '../utils/hotspotUtils';
import SphereViewer from '../components/SphereViewer';
import './EditorPage.css';
import { CONFIG } from '../config';
import MiniMapHotspots from '../components/MiniMap/MiniMapHotspots.jsx';
console.log('🔍 [Import Debug] getUserSettings =', typeof getUserSettings);
const EditorPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const panoramaContainerRef = useRef(null);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    projectId: null,
    projectName: '',
    isLoading: false,
  });
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [projectPanoramas, setProjectPanoramas] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedPanoramaForTransition, setSelectedPanoramaForTransition] =
    useState(null);
  const [userDefaultIcon, setUserDefaultIcon] = useState('pin');
  const [userDefaultColor, setUserDefaultColor] = useState('#99582A');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const sphereViewerRef = useRef(null);
  const activeToolRef = useRef(activeTool);

  // Состояние редактора
  const [editorData, setEditorData] = useState({
    title: '',
    description: '',
    hotspots: [],
    media: [],
    settings: { autoRotate: false, rotationSpeed: 0.5, zoomLevel: 1 },
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
  }, [id, t]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  //Загрузка пользовательских настроек
  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        console.log('⚙️ [Settings] Calling getUserSettings()...');
        const response = await getUserSettings();
        console.log('⚙️ [Settings] Response:', response);

        if (response?.success && response?.settings?.default_icon) {
          if (isMounted) {
            setUserDefaultIcon(response.settings.default_icon);
            console.log(
              '✅ [Settings] Icon set to:',
              response.settings.default_icon,
            );
          }
        }
        if (isMounted && response.settings.default_color) {
          setUserDefaultColor(response.settings.default_color);
          console.log(
            '✅ [Settings] Color set to:',
            response.settings.default_color,
          );
        }
      } catch (err) {
        console.error('❌ [Settings] Error:', err);
      } finally {
        if (isMounted) {
          console.log('✅ [Settings] settingsLoaded = true');
          setSettingsLoaded(true);
        }
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []); 
  // Отслеживание изменений
  useEffect(() => {
    if (project) {
      const hasChanges =
        editorData.title !== project.title ||
        editorData.description !== project.description ||
        JSON.stringify(editorData.hotspots) !==
          JSON.stringify(project.hotspots || []) ||
        JSON.stringify(editorData.media) !==
          JSON.stringify(project.media || []) ||
        JSON.stringify(editorData.settings) !==
          JSON.stringify(project.settings || {});
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

      const foundProject = response.projects.find((p) => p.id === id);
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
          const editorHotspots = hotspotResponse.hotspots.map((h) => ({
            id: h.id,
            position: {
              yaw:
                typeof h.position_yaw === 'number'
                  ? h.position_yaw
                  : parseFloat(h.position_yaw) || 0,
              pitch:
                typeof h.position_pitch === 'number'
                  ? h.position_pitch
                  : parseFloat(h.position_pitch) || 0,
            },
            title: h.title || '',
            tooltip: h.tooltip || '',
            type: h.target_type === 'panorama' ? 'transition' : 'info',
            targetProjectId: h.target_panorama_id,
            targetFileUrl: h.target_filename
              ? getMediaUrl(
                  `projects/${foundProject.id}/panoramas/${h.target_filename}`,
                )
              : null,
            targetProjectName: h.target_filename || 'Панорама',
            target_original_filename: h.target_original_filename || null,
            icon: h.icon,
            color: h.color,
            media_url: h.media_url,
          }));

          setEditorData((prev) => ({ ...prev, hotspots: editorHotspots }));
        }
      }
      const panoramasResponse = await getPanoramasByProject(foundProject.id);
      if (panoramasResponse.success) {
        setProjectPanoramas(panoramasResponse.panoramas);
        console.log(
          '[Editor] 📸 Loaded',
          panoramasResponse.panoramas.length,
          'panoramas',
        );
      }

      // 3. Обновляем метаданные
      setEditorData((prev) => ({
        ...prev,
        title: foundProject.title || '',
        description: foundProject.description || '',
        media: foundProject.media || [],
        settings: foundProject.settings || {
          autoRotate: false,
          rotationSpeed: 0.5,
          zoomLevel: 1,
        },
      }));

      setLoading(false);
    } catch (err) {
      console.error('Ошибка загрузки проекта:', err);
      setError(err.message || 'Не удалось загрузить проект');
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditorData((prev) => ({ ...prev, [field]: value }));
  };

  // Сохранение проекта (только метаданные, хотспоты уже в БД)
  const handleSave = async () => {
    try {
      setSaving(true);
      const updateData = {
        title: editorData.title,
        description: editorData.description,
        settings: editorData.settings,
      };
      const response = await updateProject(id, updateData);
      if (response.success) {
        setProject(response.project);
        setUnsavedChanges(false);
        alert(t('editor.alerts.saved'));
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      alert(err.message || t('editor.alerts.save_error'));
    } finally {
      setSaving(false);
    }
  };

// Открытие модального окна
const handleDeleteClick = (projectId, projectName) => {
  setDeleteModal({
    isOpen: true,
    projectId,
    projectName,
    isLoading: false,
  });
};

// Подтверждение удаления
const handleConfirmDelete = async () => {
  if (!deleteModal.projectId) return;

  setDeleteModal((prev) => ({ ...prev, isLoading: true }));

  try {
    const response = await deleteProject(deleteModal.projectId);
    
    if (response.success) {
      // Закрываем модалку и перенаправляем на главную
      setDeleteModal({ isOpen: false, projectId: null, projectName: '', isLoading: false });
      navigate('/main');
    } else {
      throw new Error(response.error);
    }
  } catch (err) {
    console.error('Ошибка удаления:', err);
    alert(err.message || 'Не удалось удалить проект');
    setDeleteModal((prev) => ({ ...prev, isLoading: false }));
  }
};

// Закрытие модального окна
const handleCloseDeleteModal = () => {
  setDeleteModal({ isOpen: false, projectId: null, projectName: '', isLoading: false });
};

  const handlePreview = () => {
    window.open(`/project/${id}`);
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
    switch (tool) {
      case 'hotspot':
        console.log('🛠️ Режим: добавление новых точек');
        break;
      case 'transition':
        console.log(
          '👁️ Режим: тестирование переходов (клик по хотспоту = переход)',
        );
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
        is_main: false,
        file_size: file.size,
        mime_type: file.type || 'image/jpeg',
        thumbnail_url: `projects/${projectId}/panoramas/thumb_${filename}`,
      });

      if (!registerResult.success) {
        throw new Error(
          `Не удалось зарегистрировать панораму: ${registerResult.error}`,
        );
      }

      const targetPanoramaId =
        registerResult.panorama.panorama_id || registerResult.panorama.id;

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
          panorama_id: panoramaId,
          position_yaw: parseCoord(selectedHotspot.position?.yaw),
          position_pitch: parseCoord(selectedHotspot.position?.pitch),
          target_type: 'panorama',
          target_panorama_id: targetPanoramaId,
          target_filename: filename,
          title: selectedHotspot.title || null,
          tooltip: selectedHotspot.tooltip || null,
          content_text: selectedHotspot.content_text || null,
          media_url: selectedHotspot.media_url || null, 
          external_url: selectedHotspot.external_url || null,
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
          media_url: dbHotspot.media_url || selectedHotspot.media_url, 
        };
        setSelectedHotspot(updatedHotspot);

        updateHotspotLocal(selectedHotspot.id, updatedHotspot);
        debounceSave(updatedHotspot);
        alert('✅ Точка перехода сохранена!');

        const panoramasResponse = await getPanoramasByProject(projectId);
        if (panoramasResponse.success) {
          setProjectPanoramas(panoramasResponse.panoramas);
        }
      }
    } catch (err) {
      console.error('[Editor] ❌ Error:', err);
      alert(`❌ ${err.message}`);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePanoramaSelection = async (panorama) => {
    const projectId = project?.id;
    const panoramaId = currentPanoramaId || project?.main_panorama?.id;

    if (!projectId || !panoramaId || !selectedHotspot) {
      alert('❌ Проект, панорама или хотспот не выбраны');
      return;
    }

    setUploadingFile(true);

    try {
      const parseCoord = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const num = parseFloat(val.replace(/[^\d.\-]/g, ''));
          return isNaN(num) ? 0 : num;
        }
        return 0;
      };

      const hotspotData = {
        panorama_id: panoramaId,
        position_yaw: parseCoord(selectedHotspot.position?.yaw),
        position_pitch: parseCoord(selectedHotspot.position?.pitch),
        target_type: 'panorama',
        target_panorama_id: panorama.id, // ← ID выбранной панорамы из галереи
        target_filename: panorama.filename, // ← Имя файла
        target_original_filename: panorama.original_filename || null,
        title: selectedHotspot.title || null,
        tooltip: selectedHotspot.tooltip || null,
        content_text: selectedHotspot.content_text || null,
        media_url: selectedHotspot.media_url || null, // ← Кастомное изображение
        external_url: selectedHotspot.external_url || null,
        icon: selectedHotspot.icon || 'default',
        color: selectedHotspot.color || '#3498db',
        is_active: true,
      };
      console.log('HANDLE_PANORAMA: ', panorama);
      // Проверяем: новый хотспот или существующий
      const isNewHotspot = selectedHotspot.id?.startsWith('hotspot_');

      let saveResult;
      if (isNewHotspot) {
        // Создаём новый в БД
        saveResult = await createHotspot(hotspotData);
        if (!saveResult.success) {
          throw new Error(`Не удалось создать хотспот: ${saveResult.error}`);
        }
      } else {
        // Обновляем существующий
        saveResult = await updateHotspotApi(selectedHotspot.id, hotspotData);
        if (!saveResult.success) {
          throw new Error(`Не удалось обновить хотспот: ${saveResult.error}`);
        }
      }

      const dbHotspot = saveResult.hotspot;

      // Обновляем локальный стейт
      const updatedHotspot = {
        ...selectedHotspot,
        id: dbHotspot.id,
        targetProjectId: panorama.id,
        targetProjectName: panorama.original_filename || panorama.filename,
        targetFileUrl: getMediaUrl(
          `projects/${projectId}/panoramas/${panorama.filename}`,
        ),
        type: 'transition',
        media_url: dbHotspot.media_url || selectedHotspot.media_url,
        target_original_filename: panorama.original_filename || null,
      };

      setSelectedHotspot(updatedHotspot);
      updateHotspotLocal(selectedHotspot.id, updatedHotspot);

      alert('✅ Точка перехода сохранена!');

      // Обновляем список панорам (на всякий случай)
      const panoramasResponse = await getPanoramasByProject(projectId);
      if (panoramasResponse.success) {
        setProjectPanoramas(panoramasResponse.panoramas);
      }
    } catch (err) {
      console.error('[Editor] ❌ Error:', err);
      alert(`❌ ${err.message}`);
    } finally {
      setUploadingFile(false);
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
      targetProjectId: hotspot.targetProjectId,
    });

    // РЕЖИМ ПЕРЕХОДОВ
    if (
      activeToolRef.current === 'transition' &&
      hotspot.type === 'transition' &&
      hotspot.targetFileUrl
    ) {
      console.log(
        '[Editor] 🔄 Transition mode: navigating to',
        hotspot.targetFileUrl,
      );
      // Передаём targetPanoramaId для обновления currentPanoramaId
      await handlePanoramaTransition(
        hotspot.targetFileUrl,
        hotspot.targetProjectName || 'Панорама',
        hotspot.targetProjectId, 
      );
      return;
    }

    // Открытие редактора
    setSelectedHotspot(hotspot);
    setActiveTool('hotspot-edit');
  };

  // Переход к другой панораме
  const handlePanoramaTransition = async (
    targetUrl,
    targetName,
    targetPanoramaId = null,
  ) => {
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
        img.onerror = (err) =>
          reject(new Error('Не удалось загрузить изображение'));
        img.src = absoluteUrl + '?t=' + Date.now();
      });

      // Переход
      await sphereViewerRef.current.changePanorama(absoluteUrl, {
        transition: 'fade',
        duration: 800,
      });

      setTransitionProgress(100);
      setTimeout(() => {
        setIsTransitioning(false);
        setTransitionProgress(0);
      }, 300);
      console.log('NEXT PANORAMA:', targetPanoramaId);

      // Обновляем currentPanoramaId и загружаем хотспоты новой панорамы
      if (targetPanoramaId) {
        console.log(
          '[Transition] 🔄 Updating current panorama:',
          targetPanoramaId,
        );

        // Обновляем текущую панораму
        setCurrentPanoramaId(targetPanoramaId);

        // Загружаем хотспоты для новой панорамы
        console.log('NEXT PANORAMA:', targetPanoramaId);
        const hotspotResponse = await getHotspots(targetPanoramaId);
        if (hotspotResponse.success) {
          const newHotspots = hotspotResponse.hotspots.map((h) => ({
            id: h.id,
            position: {
              yaw:
                typeof h.position_yaw === 'number'
                  ? h.position_yaw
                  : parseFloat(h.position_yaw) || 0,
              pitch:
                typeof h.position_pitch === 'number'
                  ? h.position_pitch
                  : parseFloat(h.position_pitch) || 0,
            },
            title: h.title || '',
            tooltip: h.tooltip || '',
            type: h.target_type === 'panorama' ? 'transition' : 'info',
            targetProjectId: h.target_panorama_id,
            targetFileUrl: h.target_filename
              ? getMediaUrl(
                  `projects/${project.id}/panoramas/${h.target_filename}`,
                )
              : null,
            targetProjectName: h.target_filename || 'Панорама',
            target_original_filename: h.target_original_filename || null,
            icon: h.icon,
            color: h.color,
            media_url: h.media_url || '',
          }));

          console.log(
            '[Transition] ✅ Loaded',
            newHotspots.length,
            'hotspots for new panorama',
          );
          setEditorData((prev) => ({ ...prev, hotspots: newHotspots }));

          // Сбрасываем выбранный хотспот
          setSelectedHotspot(null);
          setActiveTool('');
        } else {
          console.warn(
            '[Transition] ⚠️ Failed to load hotspots:',
            hotspotResponse.error,
          );
          setEditorData((prev) => ({ ...prev, hotspots: [] }));
        }
      }
    } catch (err) {
      console.error('[Transition] ❌ Error:', err);
      setTransitionError(err.message || 'Ошибка загрузки панорамы');
      setIsTransitioning(false);
      setTransitionProgress(0);
    }
  };

  // Клик по панораме для добавления хотспота
  const handlePositionClick = useCallback(
    async (position) => {
      console.log('🎯 [Click] handlePositionClick fired');
      console.log('🎯 [Click] settingsLoaded =', settingsLoaded);
      console.log('🎯 [Click] userDefaultIcon =', userDefaultIcon);
      console.log('[Editor] 🎯 handlePositionClick called', {
        activeTool: activeToolRef.current,
        selectedHotspot: !!selectedHotspot,
      });
      // Проверка: только в режиме добавления новых хотспотов
      if (activeToolRef.current !== 'hotspot') {
        console.log(
          '[Editor] ⚠️ Click ignored: activeTool is',
          activeToolRef.current,
        );
        return; // ← просто игнорируем клик, не вызываем handleHotspotClick!
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
        icon: userDefaultIcon || 'pin',
        color: userDefaultColor || '#99582A',
        targetFileUrl: null,
        linkUrl: '',
      };

      console.log('[Editor] 📍 New hotspot created:', {
        position: newHotspot.position,
        icon: newHotspot.icon, // ← лог для проверки
      });

      // 1. Обновляем состояние — SphereViewer синхронизирует маркеры автоматически
      setEditorData((prev) => ({
        ...prev,
        hotspots: [...prev.hotspots, newHotspot],
      }));

      // 2. Переключаем в режим редактирования НОВОГО хотспота
      setSelectedHotspot(newHotspot);
      setActiveTool('hotspot-edit'); 
    },
    [userDefaultIcon, userDefaultColor],
  );

  // Локальное обновление хотспота (без отправки на сервер)
  const updateHotspotLocal = (id, updates) => {
    setEditorData((prev) => ({
      ...prev,
      hotspots: prev.hotspots.map((h) =>
        h.id === id ? { ...h, ...updates } : h,
      ),
    }));
  };
  // Автосохранение хотспота в БД (при любом изменении)
  const saveHotspotToApi = async (hotspot) => {
    // Не сохраняем временные хотспоты (ещё не созданные в БД)
    if (!hotspot || hotspot.id?.startsWith('hotspot_')) {
      console.log('[AutoSave] ⏳ Пропуск: хотспот ещё не создан в БД');
      return;
    }

    try {
      const payload = {
        position_yaw: hotspot.position?.yaw || 0,
        position_pitch: hotspot.position?.pitch || 0,
        target_type: hotspot.type === 'transition' ? 'panorama' : 'info',
        target_panorama_id: hotspot.targetProjectId || null,
        target_filename: hotspot.targetFileUrl
          ? hotspot.targetFileUrl.split('/').pop()
          : null,
        title: hotspot.title || null,
        tooltip: hotspot.tooltip || null,
        content_text: hotspot.content_text || null,
        media_url: hotspot.media_url || null, 
        external_url: hotspot.external_url || null,
        icon: hotspot.icon || 'default',
        color: hotspot.color || '#3498db',
        is_active: hotspot.is_active !== undefined ? hotspot.is_active : true,
      };

      console.log('[AutoSave] 💾 Saving hotspot:', hotspot.id, payload);
      const result = await updateHotspotApi(hotspot.id, payload);

      if (result.success) {
        console.log('[AutoSave] ✅ Saved successfully');
      } else {
        console.warn('[AutoSave] ⚠️ Save failed:', result.error);
      }
    } catch (err) {
      console.error('[AutoSave] ❌ Error:', err);
    }
  };

  // Debounce для автосохранения (чтобы не спамить API)
  const debounceSave = useCallback(
    debounce((hotspot) => {
      saveHotspotToApi(hotspot);
    }, 800), // 800ms задержка после последнего изменения
    [],
  );

  // Функция debounce (вспомогательная)
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
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
      setEditorData((prev) => ({
        ...prev,
        hotspots: prev.hotspots.filter((h) => h.id !== hotspotId),
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

  if (loading)
    return (
      <div className="editor-loading">
        <div className="spinner"></div>
        <p>Загрузка проекта...</p>
      </div>
    );
  if (error)
    return (
      <div className="editor-error">
        <p>{error}</p>
        <button onClick={() => navigate('/projects')}>
          Вернуться к проектам
        </button>
      </div>
    );
  if (!project)
    return (
      <div className="editor-error">
        <p>Проект не найден</p>
        <button onClick={() => navigate('/projects')}>
          Вернуться к проектам
        </button>
      </div>
    );

  // Формируем URL основной панорамы
  const mainPanoramaUrl = project.main_panorama?.filename
    ? getMediaUrl(
        `projects/${project.id}/panoramas/${project.main_panorama.filename}`,
      )
    : null;

  return (
    <div className="editor-container">
      <div className="panorama-viewer">
        {mainPanoramaUrl ? (
          <SphereViewer
            ref={sphereViewerRef}
            src={mainPanoramaUrl}
            hotspots={editorData.hotspots}
            onHotspotClick={handleHotspotClick}
            onPositionClick={handlePositionClick}
          />
        ) : (
          <div className="panorama-placeholder">
            <div className="empty-state">
              <svg viewBox="0 0 24 24" style={{ color: 'var(--text-primary)' }}>
                <path
                  fill="currentColor"
                  d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                />
              </svg>
              <p>{t('editor.viewer.placeholder')}</p>
            </div>
          </div>
        )}
        <button
        className="back-btn-fixed"
        onClick={() => navigate(-1)}
        title="Назад (Esc)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <span>{t('back_btn')}</span>
      </button>
        {isTransitioning && (
          <div className="transition-overlay">
            <div className="transition-content">
              <div className="transition-spinner">
                <div className="spinner-ring" />
              </div>
              <p className="transition-text">
                {t('editor.transition.loading', {
                  progress: Math.round(transitionProgress),
                })}
              </p>
              <p className="transition-subtext">
                {editorData.hotspots.find(
                  (h) => h.targetFileUrl === project.panorama_url,
                )?.targetProjectName ||
                  t('editor.hotspot_editor.transition.label')}
              </p>
            </div>


            <div className="transition-progress-bar">
              <div
                className="transition-progress-fill"
                style={{ width: `${transitionProgress}%` }}
              />
            </div>

            <button
              className="transition-cancel-btn"
              onClick={() => {
                setIsTransitioning(false);
                setTransitionProgress(0);
              }}
            >
              {t('editor.transition.cancel')}
            </button>
          </div>
        )}

        {transitionError && (
          <div className="transition-error">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              />
            </svg>
            <span>{transitionError || t('editor.transition.error')}</span>
            <button onClick={() => setTransitionError(null)}>✕</button>
          </div>
        )}
      </div>

      <div
        className={`editor-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
      >
        <div className="sidebar-header">
          <button
            className={`collapse-btn ${isSidebarCollapsed ? 'collapsed' : ''}`}
            onClick={toggleSidebar}
            title={
              isSidebarCollapsed
                ? t('editor.sidebar.expand')
                : t('editor.sidebar.collapse')
            }
          >
            {isSidebarCollapsed ? (
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
                />
              </svg>
            )}
          </button>
          <h3>{t('editor.title')}</h3>
        </div>

        <div className="project-info">
          <div className="form-group">
            <label>{t('editor.form.title_label')}</label>
            <input
              type="text"
              value={editorData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder={t('editor.form.title_placeholder')}
              className="project-title-input"
            />
          </div>
          <div className="form-group">
            <label>{t('editor.form.description_label')}</label>
            <textarea
              value={editorData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder={t('editor.form.description_placeholder')}
              className="project-description-input"
            />
          </div>
        </div>

        <div className="tools-section">
          <h4>{t('editor.tools.title')}</h4>
          <div className="tools-grid">
            <button
              className={`tool-btn ${activeTool === 'hotspot' ? 'active' : ''}`}
              onClick={() => handleToolClick('hotspot')}
              title={t('editor.tools.hotspots_title')}
            >
              <svg className="tool-icon" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="12" cy="12" r="4" fill="currentColor" />
              </svg>
              <span>{t('editor.tools.hotspots')}</span>
            </button>

            <button
              className={`tool-btn ${activeTool === 'media' ? 'active' : ''}`}
              onClick={() => handleToolClick('media')}
              title={t('editor.tools.media')}
            >
              <svg className="tool-icon" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15h2v2H8zm0-4h2v2H8zm0-4h2v2H8zm4 8h2v2h-2zm0-4h2v2h-2zm0-4h2v2h-2zm4 8h2v2h-2zm0-4h2v2h-2zm0-4h2v2h-2z"
                />
              </svg>
              <span>{t('editor.tools.media')}</span>
            </button>

            <button
              className={`tool-btn ${activeTool === 'settings' ? 'active' : ''}`}
              onClick={() => handleToolClick('settings')}
              title={t('editor.tools.settings')}
            >
              <svg className="tool-icon" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"
                />
              </svg>
              <span>{t('editor.tools.settings')}</span>
            </button>
          </div>
          <div className="mode-toggle">
            <label className="mode-toggle-label">
              <input
                type="checkbox"
                checked={activeTool === 'transition'}
                onChange={(e) =>
                  handleToolClick(e.target.checked ? 'transition' : '')
                }
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>{t('editor.modes.transition')}</span>
            </label>
            <span className="mode-toggle-hint">
              {activeTool === 'transition'
                ? t('editor.modes.transition_hint_on')
                : t('editor.modes.transition_hint_off')}
            </span>
          </div>
          {(activeTool === 'hotspot' || activeTool === 'hotspot-edit') &&
            selectedHotspot && (
              <div className="hotspot-editor-panel">
                <div className="hotspot-editor-header">
                  <h4>{t('editor.hotspot_editor.title')}</h4>
                  <button
                    className="hotspot-editor-close"
                    onClick={() => {
                      setSelectedHotspot(null);
                      setActiveTool('');
                    }}
                    title={t('editor.hotspot_editor.close')}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path
                        fill="currentColor"
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                      />
                    </svg>
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">
                    {t('editor.hotspot_editor.name_label')}
                  </label>
                  <input
                    type="text"
                    className="hotspot-title-input hotspot-custom-input"
                    value={selectedHotspot.title || ''}
                    onChange={(e) => {
                      const updated = {
                        ...selectedHotspot,
                        title: e.target.value,
                      };
                      setSelectedHotspot(updated);
                      updateHotspotLocal(selectedHotspot.id, updated);
                      debounceSave(updated);
                    }}
                    placeholder={t('editor.hotspot_editor.name_placeholder')}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">
                    {t('editor.hotspot_editor.tooltip_label')}
                  </label>
                  <textarea
                    className="hotspot-tooltip-input hotspot-custom-input"
                    value={selectedHotspot.tooltip || ''}
                    onChange={(e) => {
                      const updated = {
                        ...selectedHotspot,
                        tooltip: e.target.value,
                      };
                      setSelectedHotspot(updated);
                      updateHotspotLocal(selectedHotspot.id, updated);
                      debounceSave(updated); 
                    }}
                    placeholder={t('editor.hotspot_editor.tooltip_placeholder')}
                    rows={2}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">
                    {t('editor.hotspot_editor.type_label')}
                  </label>
                  <select
                    value={selectedHotspot.type || 'transition'}
                    onChange={(e) => {
                      const updated = {
                        ...selectedHotspot,
                        type: e.target.value,
                      };
                      setSelectedHotspot(updated);
                      updateHotspotLocal(selectedHotspot.id, updated);
                      debounceSave(updated); 
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '13px',
                      background: 'white',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="transition">
                      {t('editor.hotspot_editor.types.transition')}
                    </option>
                    <option value="info">
                      {t('editor.hotspot_editor.types.info')}
                    </option>
                    <option value="media">
                      {t('editor.hotspot_editor.types.media')}
                    </option>
                    <option value="link">
                      {t('editor.hotspot_editor.types.link')}
                    </option>
                  </select>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="hotspot-image-label">
                      {t('editor.hotspot_editor.image.label')}
                    </label>

                    <div className="image-upload-area">
                      {selectedHotspot.media_url ? (
                        <div className="image-preview-container">
                          <img
                            src={`${CONFIG.MEDIA_BASE_URL}/${selectedHotspot.media_url}`}
                            alt="Hotspot preview"
                            className="image-preview"
                          />
                          <button
                            type="button"
                            className="image-remove-btn"
                            onClick={() => {
                              setSelectedHotspot((prev) => ({
                                ...prev,
                                media_url: '',
                              }));
                              updateHotspotLocal(selectedHotspot.id, {
                                media_url: '',
                              });
                            }}
                            title={t('editor.hotspot_editor.image.remove')}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="image-upload-placeholder">
                          <div className="placeholder-icon">📷</div>
                          <p className="placeholder-text">
                            {t('editor.hotspot_editor.image.placeholder')}
                          </p>
                          <p className="placeholder-hint">
                            {t('editor.hotspot_editor.image.hint')}
                          </p>
                        </div>
                      )}

                      <input
                        className="image-upload-input"
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;

                          // Валидация
                          if (!file.type.startsWith('image/')) {
                            alert(
                              'Пожалуйста, выберите изображение (JPEG, PNG, GIF, SVG)',
                            );
                            e.target.value = '';
                            return;
                          }

                          if (file.size > 5 * 1024 * 1024) {
                            alert('Файл слишком большой. Максимум 5MB');
                            e.target.value = '';
                            return;
                          }

                          // Загрузка через готовую функцию
                          setUploadingImage(true);
                          try {
                            const result = await uploadHotspotImage(
                              file,
                              project.id,
                            );
                            if (result.success) {
                              const updated = {
                                ...selectedHotspot,
                                media_url: result.fileUrl,
                              };
                              setSelectedHotspot(updated);
                              updateHotspotLocal(selectedHotspot.id, updated);
                              debounceSave(updated);
                            } else {
                              alert(
                                result.error || 'Ошибка загрузки изображения',
                              );
                            }
                          } catch (err) {
                            console.error('Upload error:', err);
                            alert('Ошибка: не удалось загрузить файл');
                          } finally {
                            setUploadingImage(false);
                            e.target.value = ''; // Сброс инпута
                          }
                        }}
                        disabled={uploadingImage}
                        style={{ display: 'none' }}
                        id="hotspot-image-input"
                      />

                      <label
                        htmlFor="hotspot-image-input"
                        className={`image-upload-btn ${uploadingImage ? 'uploading' : ''} ${selectedHotspot.media_url ? 'has-image' : ''}`}
                      >
                        {uploadingImage
                          ? t('editor.hotspot_editor.image.uploading')
                          : selectedHotspot.media_url
                            ? t('editor.hotspot_editor.image.replace')
                            : t('editor.hotspot_editor.image.upload')}
                      </label>
                    </div>

                    <p
                      style={{
                        margin: '6px 0 0 0',
                        fontSize: '10px',
                        color: '#94a3b8',
                        textAlign: 'center',
                      }}
                    >
                      {t('editor.hotspot_editor.image.size_hint')}
                    </p>
                  </div>
                </div>
                {selectedHotspot.type === 'transition' && (
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">
                      {t('editor.hotspot_editor.transition.label')}
                    </label>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      disabled={uploadingFile}
                      style={{ display: 'none' }}
                    />
                    {selectedHotspot?.targetFileUrl && (
                      <div className="selected-panorama-indicator">
                        <span>
                          ✓{' '}
                          {selectedHotspot.target_original_filename ||
                            selectedHotspot.targetProjectName ||
                            'Панорама'}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() =>
                        !uploadingFile && fileInputRef.current?.click()
                      }
                      disabled={uploadingFile}
                      className={`panorama-upload-btn ${uploadingFile ? 'uploading' : ''}`}
                    >
                      {uploadingFile ? (
                        <>
                          <div className="spinner-mini" />
                          {t('editor.media_panel.uploading')}
                        </>
                      ) : (
                        <>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          {t('editor.hotspot_editor.transition.upload_new')}
                        </>
                      )}
                    </button>

                    <div className="panorama-divider">
                      <span>{t('editor.hotspot_editor.transition.or')}</span>
                    </div>

                    <div className="panorama-list">
                      {projectPanoramas.length === 0 ? (
                        <div className="panorama-list-empty">
                          {t('editor.hotspot_editor.transition.empty')}
                        </div>
                      ) : (
                        projectPanoramas.map((panorama) => (
                          <button
                            key={panorama.id}
                            onClick={() => {
                              handlePanoramaSelection(panorama);
                            }}
                            className={`panorama-list-item ${selectedHotspot.targetProjectId === panorama.id ? 'selected' : ''}`}
                            onMouseEnter={(e) =>
                              (e.target.style.background = '#f8fafc')
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.background =
                                selectedHotspot.targetProjectId === panorama.id
                                  ? '#eff6ff'
                                  : 'white')
                            }
                          >
                            
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill={panorama.is_main ? '#fbbf24' : '#94a3b8'}
                              className="panorama-icon"
                            >
                              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>

                            <span className="panorama-name">
                              {panorama.original_filename || panorama.filename}
                            </span>

                            {panorama.is_main && (
                              <span className="panorama-badge-main">
                                {t('editor.media_panel.main')}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>

                    {selectedHotspot.targetFileUrl && (
                      <button
                        onClick={() => {
                          setSelectedHotspot((prev) => ({
                            ...prev,
                            targetProjectId: null,
                            targetProjectName: null,
                            targetFileUrl: null,
                          }));
                          updateHotspotLocal(selectedHotspot.id, {
                            targetProjectId: null,
                            targetProjectName: null,
                            targetFileUrl: null,
                          });
                        }}
                        className="panorama-clear-btn"
                      >
                        {t('editor.hotspot_editor.transition.clear')}
                      </button>
                    )}
                  </div>
                )}
                {selectedHotspot.type === 'link' && (
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label
                      style={{
                        fontSize: '12px',
                        color: '#475569',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      {t('editor.hotspot_editor.link.url_label')}
                    </label>
                    <input
                      type="url"
                      value={selectedHotspot.linkUrl || ''}
                      onChange={(e) => {
                        setSelectedHotspot((prev) => ({
                          ...prev,
                          linkUrl: e.target.value,
                        }));
                        updateHotspotLocal(selectedHotspot.id, {
                          linkUrl: e.target.value,
                        });
                      }}
                      placeholder={t(
                        'editor.hotspot_editor.link.url_placeholder',
                      )}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}

                <div className="actions-buttons hotspot-actions">
                  <button
                    className="action-btn danger"
                    onClick={() => deleteHotspot(selectedHotspot.id)}
                  >
                    {t('editor.hotspot_editor.actions.delete')}
                  </button>
                </div>
              </div>
            )}

          {activeTool === 'hotspot' && !selectedHotspot && (
            <div className="hotspot-hint">
              {t('editor.hotspot_hints.add_mode')}
            </div>
          )}
          {activeTool === 'media' && (
            <div className="media-panel">
              <div className="media-panel-header">
                <h4>{t('editor.media_panel.title')}</h4>

                <input
                  type="file"
                  accept="image/jpeg, image/jpg, image/png"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;

                    setUploadingMedia(true);
                    let successCount = 0;

                    try {
                      for (const file of files) {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('project_id', project.id);

                        const uploadRes = await uploadPanorama(
                          file,
                          project.id,
                        );
                        if (!uploadRes.success)
                          throw new Error(uploadRes.error);

                        console.log('upload:', file);
                        const regRes = await registerPanorama({
                          project_id: project.id,
                          filename: uploadRes.filename,
                          original_filename: file.name,
                          title: file.name.split('.')[0],
                          is_main: false,
                          file_size: file.size,
                          mime_type: file.type,
                          thumbnail_url: `projects/${project.id}/panoramas/thumb_${uploadRes.filename}`,
                        });
                        if (regRes.success) successCount++;
                      }

                      const panoramasResponse = await getPanoramasByProject(
                        project.id,
                      );
                      if (panoramasResponse.success) {
                        setProjectPanoramas(panoramasResponse.panoramas); 
                        console.log(
                          '📸 Media list updated:',
                          panoramasResponse.panoramas.length,
                          'items',
                        );
                      }
                      alert(`✅ Успешно загружено: ${successCount}`);
                    } catch (err) {
                      alert(`❌ Ошибка: ${err.message}`);
                    } finally {
                      setUploadingMedia(false);
                      e.target.value = '';
                    }
                  }}
                  disabled={uploadingMedia}
                  className="media-upload-input"
                  id="media-upload-input"
                />

                <button
                  onClick={() =>
                    document.getElementById('media-upload-input').click()
                  }
                  disabled={uploadingMedia}
                  className="media-upload-btn"
                >
                  {uploadingMedia
                    ? t('editor.media_panel.uploading')
                    : t('editor.media_panel.add')}
                </button>
              </div>
              <div className="media-panoramas-list">
                {projectPanoramas.length === 0 ? (
                  <div className="media-empty-state">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="media-empty-icon"
                    >
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                    </svg>
                    <p>{t('editor.hotspot_editor.transition.empty')}</p>
                    <p className="media-empty-hint">
                      {t('editor.media_panel.empty.hint')}
                    </p>
                  </div>
                ) : (
                  <div className="media-grid">
                    {projectPanoramas.map((panorama) => (
                      <div key={panorama.id} className="media-item">
                        <div className="media-item-thumbnail">
                          <div className="media-item-placeholder">📷</div>
                        </div>
                        <div className="media-item-info">
                          <div className="media-item-title">
                            {panorama.original_filename || panorama.filename}
                          </div>
                          <div className="media-item-subtitle">
                            {panorama.is_main
                              ? t('editor.media_panel.main')
                              : t('editor.media_panel.additional')}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            const targetUrl = getMediaUrl(
                              `projects/${project.id}/panoramas/${panorama.filename}`,
                            );
                            await handlePanoramaTransition(
                              targetUrl,
                              panorama.original_filename || panorama.filename,
                              panorama.id,
                            );
                          }}
                          className="media-item-btn"
                        >
                          {t('editor.media_panel.preview')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="media-stats">
                <strong>{t('editor.media_panel.stats')}:</strong>{' '}
                {projectPanoramas.length}
              </div>
            </div>
          )}
        </div>

        <div className="actions-section">
          <h4>{t('editor.actions.title')}</h4>
          <div className="actions-buttons">
            <button
              className={`action-btn primary ${saving ? 'loading' : ''}`}
              onClick={handleSave}
              disabled={!unsavedChanges || saving}
            >
              {saving ? (
                <>
                  <div className="spinner-small"></div>
                  <span>{t('editor.actions.saving')}</span>
                </>
              ) : unsavedChanges ? (
                <>
                  <svg className="action-icon" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"
                    />
                  </svg>
                  <span>{t('editor.actions.save')}</span>
                </>
              ) : (
                <>
                  <svg className="action-icon" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"
                    />
                  </svg>
                  <span>{t('editor.actions.saved')}</span>
                </>
              )}
            </button>

            <button className="action-btn secondary" onClick={handlePreview}>
              <svg className="action-icon" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
                />
              </svg>
              <span>{t('editor.actions.preview')}</span>
            </button>

            <button className="action-btn danger" onClick={() => handleDeleteClick(id, project?.title || 'Этот проект')}>
              <svg className="action-icon" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                />
              </svg>
              <span>{t('editor.actions.delete')}</span>
            </button>
          </div>
        </div>

        <div className="project-stats">
          <div className="stat-item">
            <span className="stat-label">{t('editor.stats.hotspots')}</span>
            <span className="editor-stat-value">
              {editorData.hotspots.length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('editor.stats.media')}</span>
            <span className="editor-stat-value">{editorData.media.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('editor.stats.project_id')}</span>
            <span className="editor-stat-value">{project.id}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('editor.stats.status')}</span>
            <span className={`editor-stat-value status-${project.status}`}>
              {project.status === 'published'
                ? t('editor.stats.status_published')
                : t('editor.stats.status_draft')}
            </span>
          </div>
        </div>
      </div>
{deleteModal.isOpen && (
  <div className="modal-overlay" onClick={handleCloseDeleteModal}>
    <div
      className="delete-modal-content"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-header">
        <h2>{t('modal.delete.title')}</h2>
        <button className="modal-close" onClick={handleCloseDeleteModal}>
          ×
        </button>
      </div>

      <div className="modal-body">
        <p>{t('modal.delete.confirm')}</p>
        <p className="project-name">
          <strong>"{deleteModal.projectName}"</strong>
        </p>
        <p className="warning-text">{t('modal.delete.warning')}</p>
      </div>

      <div className="modal-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={handleCloseDeleteModal}
          disabled={deleteModal.isLoading}
        >
          {t('modal.delete.cancel')}
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={handleConfirmDelete}
          disabled={deleteModal.isLoading}
        >
          {deleteModal.isLoading ? 'Удаление...' : t('modal.delete.confirm_button')}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default EditorPage;
