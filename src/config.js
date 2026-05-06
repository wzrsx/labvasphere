export const CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8081/api/v1',
  MEDIA_BASE_URL:
    import.meta.env.VITE_MEDIA_URL || 'http://localhost:8081/uploads',
};
