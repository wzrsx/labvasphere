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
//Получение публичного профиля пользователя по ID
export const getPublicProfile = async (userId) => {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'ID пользователя не указан',
      };
    }
    
    const response = await api.get(`/users/${userId}`);
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

export const changePassword = async (passwordData) => {
  try {
    const { data } = await api.post('/auth/change-password', {
      current_password: passwordData.currentPassword,
      new_password: passwordData.newPassword,
    });

    return { success: true, message: data.message };
  } catch (error) {
    const message = error.response?.data?.error || error.message;
    return { success: false, error: message };
  }
};

export const uploadAvatar = async (file) => {
  try {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await api.post('/upload/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`📤 Загрузка аватара: ${percentCompleted}%`);
      },
    });

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const updatedUser = { ...currentUser, avatar_url: response.data.avatar_url };
    localStorage.setItem('user', JSON.stringify(updatedUser));

    return { success: true, avatarUrl: response.data.avatar_url };
  } catch (error) {
    console.error('❌ uploadAvatar error:', error);
    
    let errorMessage = 'Ошибка загрузки аватара';
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Превышено время ожидания загрузки';
    } else if (error.message?.includes('Network Error')) {
      errorMessage = 'Ошибка сети. Проверьте подключение';
    }
    
    return { success: false, error: errorMessage };
  }
};

export const deleteAvatar = async () => {
  try {
    await api.delete('/upload/avatar');
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const updatedUser = { ...currentUser, avatar_url: null };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    return { success: true };
  } catch (error) {
    console.error('❌ deleteAvatar error:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Ошибка удаления аватара' 
    };
  }
};

export const validateAvatarFile = (file) => {
  if (!file) {
    return { valid: false, error: 'Файл не выбран' };
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Недопустимый формат. Разрешены: JPG, PNG, WebP' 
    };
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: 'Файл слишком большой. Максимум 5MB' 
    };
  }

  return { valid: true };
};