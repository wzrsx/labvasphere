import api from './api.js';

// Получение всех проектов пользователя
export const getProjects = async () => {
  try {
    const response = await api.get('/projects');
    return {
      success: true,
      projects: response.data.projects || [],
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

// Создание проекта
export const createProject = async (projectData) => {
  try {
    const response = await api.post('/projects', projectData);
    return {
      success: true,
      project: response.data.project,
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

// Обновление проекта
export const updateProject = async (projectId, projectData) => {
  try {
    const response = await api.put(`/projects/${projectId}`, projectData);
    return {
      success: true,
      project: response.data.project,
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

// Удаление проекта
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