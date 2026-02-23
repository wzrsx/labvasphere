import api from './api.js';
// Получение профиля пользователя
export const getProfile = async () => {
  try {
    const response = await api.get('/profile');
    return {
      success: true,
      user: response.data,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при загрузке профиля';
    return {
      success: false,
      error: message,
    };
  }
};

// Обновление профиля пользователя
export const updateProfile = async (profileData) => {
  try {
    const response = await api.put('/profile', profileData);
    return {
      success: true,
      user: response.data,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при обновлении профиля';
    return {
      success: false,
      error: message,
    };
  }
};