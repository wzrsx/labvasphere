import api from './api.js';

// Получение всех проектов ТЕКУЩЕГО авторизованного пользователя
// (ID автора берётся автоматически из JWT-токена на бэкенде)
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
    return {
      success: false,
      error: message,
    };
  }
};

// Создание проекта (автор — текущий пользователь из токена)
export const createProject = async (projectData) => {
  try {
    const response = await api.post('/projects', projectData);
    return {
      success: true,
      project: response.data,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при создании проекта';
    return {
      success: false,
      error: message,
    };
  }
};

// Обновление проекта (только своего)
export const updateProject = async (projectId, projectData) => {
  try {
    const response = await api.put(`/projects/${projectId}`, projectData);
    return {
      success: true,
      project: response.data,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при обновлении проекта';
    return {
      success: false,
      error: message,
    };
  }
};

// Удаление проекта (только своего)
export const deleteProject = async (projectId) => {
  try {
    await api.delete(`/projects/${projectId}`);
    return {
      success: true,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при удалении проекта';
    return {
      success: false,
      error: message,
    };
  }
};