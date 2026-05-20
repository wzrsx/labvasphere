import api from './api.js';

// Получение опубликованных проектов
export const getPublishedProjects = async (limit = 5, offset = 0) => {
  try {
    const response = await api.get(
      `/projects/published?limit=${limit}&offset=${offset}`,
    );
    return {
      success: true,
      projects: response.data?.data || [],
      total: response.data?.total || 0,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при загрузке проектов';
    return { success: false, error: message };
  }
};

// Получение проектов текущего пользователя
export const getProjects = async () => {
  try {
    const response = await api.get('/projects');
    return {
      success: true,
      projects: Array.isArray(response.data) ? response.data : [],
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при загрузке проектов';
    return { success: false, error: message };
  }
};

// 🔹 Создание проекта (без panorama_url — панорама регистрируется отдельно)
export const createProject = async (projectData) => {
  try {
    // projectData может содержать:
    // - panorama_filename, panorama_original_name (для регистрации основной панорамы)
    const response = await api.post('/projects', {
      title: projectData.title,
      description: projectData.description,
      cover_image_url: projectData.cover_image_url,
      // panorama_url удалён
      panorama_filename: projectData.panorama_filename, // ← новое
      panorama_original_name: projectData.panorama_original_name, // ← новое
      status: projectData.status,
    });

    return { success: true, project: response.data };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при создании проекта';
    return { success: false, error: message };
  }
};

// Обновление проекта (без panorama_url)
export const updateProject = async (projectId, projectData) => {
  try {
    const response = await api.put(`/projects/${projectId}`, {
      title: projectData.title,
      description: projectData.description,
      cover_image_url: projectData.cover_image_url,
      // panorama_url удалён
      status: projectData.status,
    });
    return { success: true, project: response.data };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при обновлении проекта';
    return { success: false, error: message };
  }
};
export const updateProjectStatus = async (projectId, status) => {
  try {
    const response = await api.put(`/projects/${projectId}`, {
      status: status,
    });
    return { success: true, project: response.data };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при обновлении статуса';
    return { success: false, error: message };
  }
};
// Удаление проекта
export const deleteProject = async (projectId) => {
  try {
    await api.delete(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при удалении проекта';
    return { success: false, error: message };
  }
};

// Загрузка панорамы (файл → сервер)
export const uploadPanorama = async (file, projectId) => {
  if (!projectId) return { success: false, error: 'project_id обязателен' };

  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', projectId);

  try {
    const response = await api.post('/upload/panorama', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return {
      success: true,
      fileUrl: response.data.file_url, // "projects/uuid/panoramas/file.jpg"
      filename: response.data.filename,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при загрузке панорамы';
    return { success: false, error: message };
  }
};

// Загрузка обложки
export const uploadCover = async (file, projectId) => {
  if (!projectId) return { success: false, error: 'project_id обязателен' };

  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', projectId);

  try {
    const response = await api.post('/upload/cover', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return {
      success: true,
      fileUrl: response.data.file_url,
      filename: response.data.filename,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при загрузке обложки';
    return { success: false, error: message };
  }
};

// 🔹 Регистрация панорамы в БД (после загрузки файла)
export const registerPanorama = async (panoramaData) => {
  try {
    const response = await api.post('/panoramas/register', {
      project_id: panoramaData.project_id,
      filename: panoramaData.filename,
      original_filename: panoramaData.original_filename,
      title: panoramaData.title,
      description: panoramaData.description,
      is_main: panoramaData.is_main,
      file_size: panoramaData.file_size,
      mime_type: panoramaData.mime_type,
      thumbnail_url: panoramaData.thumbnail_url,
    });
    return { success: true, panorama: response.data };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка регистрации панорамы';
    return { success: false, error: message };
  }
};

// 🔹 Получить все панорамы проекта
export const getPanoramasByProject = async (projectId) => {
  try {
    const response = await api.get(`/panoramas/project/${projectId}`);
    return {
      success: true,
      panoramas: Array.isArray(response.data) ? response.data : [],
    };
  } catch (error) {
    const message = error.response?.data?.error || 'Ошибка загрузки панорам';
    return { success: false, error: message, panoramas: [] };
  }
};

// Хотспоты
export const getHotspots = async (panoramaId) => {
  try {
    const response = await api.get(`/hotspots/panorama/${panoramaId}`);
    console.log("[GET H raw]: ", response);
    return {
      success: true,
      hotspots: Array.isArray(response.data) ? response.data : [],
    };
  } catch (error) {
    const message = error.response?.data?.error || 'Ошибка загрузки хотспотов';
    return { success: false, error: message, hotspots: [] };
  }
};

export const createHotspot = async (hotspotData) => {
  try {
    const response = await api.post('/hotspots', hotspotData);
    return { success: true, hotspot: response.data };
  } catch (error) {
    console.error(
      'createHotspot error:',
      error.response?.data || error.message,
    );
    const message = error.response?.data?.error || 'Ошибка создания хотспота';
    return { success: false, error: message };
  }
};

export const updateHotspotApi = async (hotspotId, hotspotData) => {
  try {
    const response = await api.put(`/hotspots/${hotspotId}`, hotspotData);
    return { success: true, hotspot: response.data };
  } catch (error) {
    const message = error.response?.data?.error || 'Ошибка обновления хотспота';
    return { success: false, error: message };
  }
};

export const deleteHotspotApi = async (hotspotId) => {
  try {
    await api.delete(`/hotspots/${hotspotId}`);
    return { success: true };
  } catch (error) {
    const message = error.response?.data?.error || 'Ошибка удаления хотспота';
    return { success: false, error: message };
  }
};

export const saveHotspotsBatch = async (panoramaId, hotspots) => {
  try {
    const results = await Promise.all(
      hotspots.map(async (h) => {
        // 🔹 Создаём новый хотспот
        if (h.id && h.id.startsWith('hotspot_')) {
          const payload = {
            panorama_id: panoramaId,
            position_yaw: h.position?.yaw || 0,
            position_pitch: h.position?.pitch || 0,
            target_type: h.type === 'transition' ? 'panorama' : 'info',
            target_panorama_id:
              h.targetProjectId && !h.targetProjectId.startsWith('file_')
                ? h.targetProjectId
                : null,
            target_filename: h.target_filename || null,
            title: h.title || null,
            tooltip: h.tooltip || null,
            content_text: h.content_text || null,
            media_url: h.media_url || null, // ← ДОБАВЛЕНО!
            external_url: h.external_url || null,
            icon: h.icon || 'default',
            color: h.color || '#3498db',
            is_active: h.is_active !== undefined ? h.is_active : true,
          };
          return await createHotspot(payload);
        }
        // 🔹 Обновляем существующий
        else {
          const payload = {
            position_yaw: h.position?.yaw || 0,
            position_pitch: h.position?.pitch || 0,
            target_type: h.type === 'transition' ? 'panorama' : 'info',
            target_panorama_id:
              h.targetProjectId && !h.targetProjectId.startsWith('file_')
                ? h.targetProjectId
                : null,
            target_filename: h.target_filename || null,
            title: h.title || null,
            tooltip: h.tooltip || null,
            content_text: h.content_text || null,
            media_url: h.media_url || null, // ← ДОБАВЛЕНО!
            external_url: h.external_url || null,
            icon: h.icon || 'default',
            color: h.color || '#3498db',
            is_active: h.is_active !== undefined ? h.is_active : true,
          };
          return await updateHotspotApi(h.id, payload);
        }
      }),
    );

    const hasError = results.some((r) => !r.success);
    if (hasError) throw new Error('Не все хотспоты сохранены');
    return { success: true };
  } catch (error) {
    console.error('saveHotspotsBatch error:', error);
    return { success: false, error: error.message };
  }
};
export const getMainPanorama = async (projectId) => {
  try {
    const response = await api.get(`/panoramas/project/${projectId}/main`);
    return { success: true, panorama: response.data };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка получения основной панорамы';
    return { success: false, error: message };
  }
};
// Обновление панорамы (смена заголовка, обложки и т.д.)
export const updatePanorama = async (panoramaId, updates) => {
  try {
    // updates может содержать: { is_main: true, title: "...", is_active: false }
    const response = await api.put(`/panoramas/${panoramaId}`, updates);
    return { success: true, panorama: response.data };
  } catch (error) {
    const message = error.response?.data?.error || 'Ошибка обновления панорамы';
    return { success: false, error: message };
  }
};

// Удаление панорамы
export const deletePanorama = async (panoramaId) => {
  try {
    await api.delete(`/panoramas/${panoramaId}`);
    return { success: true };
  } catch (error) {
    const message = error.response?.data?.error || 'Ошибка удаления панорамы';
    return { success: false, error: message };
  }
};

export const uploadHotspotImage = async (file, projectId) => {
  if (!projectId) {
    return { success: false, error: 'project_id обязателен' };
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', projectId); // 🔹 Добавляем project_id

  try {
    const response = await api.post('/upload/hotspot', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return {
      success: true,
      fileUrl: response.data.file_url,
      filename: response.data.filename,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка загрузки изображения';
    return { success: false, error: message };
  }
};

//Переключить лайк проекта
export const toggleLike = async (projectId) => {
  try {
    const response = await api.put(`/projects/${projectId}/like`);
    return {
      success: true,
      liked: response.data.liked,
      likesCount: response.data.likes_count,
    };
  } catch (error) {
    const message = error.response?.data?.error || 'Ошибка при обновлении лайка';
    return {
      success: false,
      error: message,
    };
  }
};

//Получить статус лайка и счётчик
export const getLikeStatus = async (projectId) => {
  try {
    const response = await api.get(`/projects/${projectId}/like/status`);
    return {
      success: true,
      liked: response.data.liked,
      likesCount: response.data.likes_count,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Ошибка при загрузке статуса лайка',
    };
  }
};
// ✅ Массовое получение лайков для нескольких проектов (параллельные запросы)

export const getProjectsLikesCounts = async (projectIds) => {
  if (!projectIds?.length) return {};

  // 1. Параллельно запрашиваем статус лайка для каждого проекта
  const results = await Promise.all(
    projectIds.map(async (id) => {
      try {
        const res = await getLikeStatus(id);
        // getLikeStatus уже маппит response.data.likes_count → res.likesCount
        return { id, count: res.success ? res.likesCount : 0 };
      } catch {
        return { id, count: 0 };
      }
    })
  );

  // 2. Собираем объект вида { [projectId]: count }
  return results.reduce((acc, { id, count }) => {
    acc[id] = count;
    return acc;
  }, {});
};
// 🔹 Инкремент счетчика просмотров проекта
export const incrementProjectViews = async (projectId) => {
  try {
    // Используем PUT запрос для обновления views_count в БД
    const response = await api.put(`/projects/${projectId}/views`);
    return { success: true, views_count: response.data?.views_count };
  } catch (error) {
    console.error('Ошибка инкремента просмотров:', error);
    return { success: false, error: error.message };
  }
};