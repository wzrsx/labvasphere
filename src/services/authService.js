import api from './api';

// Сохранение токена в localStorage
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

// Получение токена
export const getToken = () => {
  return localStorage.getItem('token');
};

// Получение текущего пользователя из токена
export const getCurrentUser = () => {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.user_id,
      email: payload.email,
      role: payload.role,
    };
  } catch (error) {
    return null;
  }
};

// Вход
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', {
      email,
      password,
    });

    if (response.data.token) {
      setAuthToken(response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return {
      success: true,
      user: response.data.user,
      token: response.data.token,
    };
  } catch (error) {
    const message =
      error.response?.data?.error || 'Ошибка при входе. Проверьте данные.';
    return {
      success: false,
      error: message,
    };
  }
};

// Регистрация
export const register = async (fullName, email, password, role = 'user') => {
  try {
    const response = await api.post('/auth/register', {
      full_name: fullName,
      email,
      password,
      role,
    });

    if (response.data.token) {
      setAuthToken(response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return {
      success: true,
      user: response.data.user,
      token: response.data.token,
    };
  } catch (error) {
    const message =
      error.response?.data?.error ||
      'Ошибка при регистрации. Попробуйте снова.';
    return {
      success: false,
      error: message,
    };
  }
};

// Выход
export const logout = () => {
  setAuthToken(null);
  localStorage.removeItem('user');
};

// Проверка аутентификации
export const isAuthenticated = () => {
  return !!getToken();
};