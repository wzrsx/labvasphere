import axios from 'axios';

const API_BASE_URL = 'http://localhost:8081/api/v1';

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

      const publicEndpoints = [
        '/auth/login', '/auth/register', '/auth/reset-password',
        '/health', '/projects/published', '/projects/public/',
        '/panoramas/project/', '/hotspots/panorama/',
      ];

      const isPublicRequest = publicEndpoints.some((endpoint) =>
        requestUrl.includes(endpoint)
      );

      if (currentPath === '/auth') return Promise.reject(error);
      if (isPublicRequest) {
        console.warn('⚠️ 401 on public endpoint, no redirect');
        return Promise.reject(error);
      }

      if (!localStorage.getItem('token')) {
        localStorage.removeItem('user');
      }
      window.location.href = `/auth?redirect=${encodeURIComponent(currentPath)}`;
      return Promise.reject(error);
    }
    
    return Promise.reject(error);
  },
);
export default api;
