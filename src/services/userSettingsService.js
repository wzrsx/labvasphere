import api from './api.js';

//Получение настроек текущего пользователя
export const getUserSettings = async () => {
  try {
    const response = await api.get('/user/settings');
    return {
      success: true,
      settings: response.data,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при загрузке настроек';
    return {
      success: false,
      error: message,
    };
  }
};

//Обновление настроек текущего пользователя (merge-режим)
export const updateUserSettings = async (preferences) => {
  try {
    if (!preferences || typeof preferences !== 'object') {
      return {
        success: false,
        error: 'Неверный формат данных настроек',
      };
    }

    const response = await api.patch('/user/settings', preferences);
    return {
      success: true,
      settings: response.data,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при сохранении настроек';
    return {
      success: false,
      error: message,
    };
  }
};

//Обновление только иконки по умолчанию
export const updateDefaultIcon = async (icon) => {
  const allowedIcons = ['pin', 'dot', 'star', 'camera'];

  if (!icon || !allowedIcons.includes(icon)) {
    return {
      success: false,
      error: `Недопустимое значение иконки. Разрешено: ${allowedIcons.join(', ')}`,
    };
  }

  return await updateUserSettings({ default_icon: icon });
};

//Обновление только цвета по умолчанию
export const updateDefaultColor = async (color) => {
  // Простая валидация HEX
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

  if (!color || !hexRegex.test(color)) {
    return {
      success: false,
      error: 'Неверный формат цвета. Используйте HEX: #RRGGBB',
    };
  }

  return await updateUserSettings({ default_color: color });
};

//Сброс настроек к значениям по умолчанию

export const resetUserSettings = async () => {
  // Отправляем пустой объект — бэкенд вернёт дефолты
  return await updateUserSettings({});
};

//Получение дефолтных настроек (без обращения к БД, локально)
export const getDefaultSettings = () => ({
  default_icon: 'pin',
  default_color: '#99582A',
});

//Валидация объекта настроек перед отправкой
export const validateSettings = (settings) => {
  if (!settings || typeof settings !== 'object') {
    return { valid: false, error: 'Настройки должны быть объектом' };
  }

  if (settings.default_icon !== undefined) {
    const allowed = ['pin', 'dot', 'star', 'camera'];
    if (!allowed.includes(settings.default_icon)) {
      return {
        valid: false,
        error: `default_icon: разрешено ${allowed.join(', ')}`,
      };
    }
  }

  if (settings.default_color !== undefined) {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexRegex.test(settings.default_color)) {
      return {
        valid: false,
        error: 'default_color: неверный HEX-формат (#RRGGBB)',
      };
    }
  }

  return { valid: true };
};
