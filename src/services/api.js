import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api/v1';

// Создаем экземпляр axios с настройками
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor для автоматического добавления токена к запросам
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log('🚀 Request:', config.url);
    console.log('🔑 Token exists:', !!token);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Authorization header added');
    } else {
      console.log('❌ No token found');
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const currentPath = window.location.pathname;

      // 📋 Список публичных эндпоинтов (не требуют авторизации)
      const publicEndpoints = [
        '/auth/login',
        '/auth/register',
        '/auth/reset-password',
        '/health',
        '/projects/published',      // ← Список опубликованных
        '/projects/public/',        // ← Детали проекта (с слэшем!)
        '/panoramas/project/',
        '/hotspots/panorama/',
      ];

      // Проверяем, был ли запрос к публичному эндпоинту
      const isPublicRequest = publicEndpoints.some(endpoint => 
        requestUrl.includes(endpoint)
      );

      // 🧹 Всегда очищаем невалидный токен
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // 🚫 Не редиректим, если:
      // 1. Запрос к публичному API, ИЛИ
      // 2. Пользователь уже на странице авторизации
      if (isPublicRequest || currentPath === '/auth') {
        console.warn('⚠️ 401 on public endpoint, no redirect');
        return Promise.reject(error);
      }

      // 🔐 Для защищённых эндпоинтов — редирект на авторизацию
      // Сохраняем путь, чтобы вернуть пользователя после входа
      window.location.href = `/auth?returnTo=${encodeURIComponent(currentPath)}`;
    }
    return Promise.reject(error);
  },
);

export default api;
