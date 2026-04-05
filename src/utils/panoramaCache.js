// src/utils/panoramaCache.js

/**
 * Простой кэш для изображений панорам
 * Хранит загруженные Image объекты в памяти
 */
class PanoramaCache {
  constructor() {
    this.cache = new Map(); // Map<url, Image>
    this.loading = new Map(); // Map<url, Promise<Image>>
  }

  /**
   * Проверяет, есть ли изображение в кэше
   */
  has(url) {
    return this.cache.has(url);
  }

  /**
   * Получает изображение из кэша
   */
  get(url) {
    return this.cache.get(url);
  }

  /**
   * Загружает изображение и кэширует его
   * Возвращает Promise, который резолвится с изображением
   */
  async preload(url, onProgress) {
    // Если уже в кэше — возвращаем сразу
    if (this.cache.has(url)) {
      console.log(`[PanoramaCache] ✅ Hit: ${url}`);
      return this.cache.get(url);
    }

    // Если уже загружается — возвращаем тот же промис
    if (this.loading.has(url)) {
      console.log(`[PanoramaCache] ⏳ Already loading: ${url}`);
      return this.loading.get(url);
    }

    console.log(`[PanoramaCache] 📥 Preloading: ${url}`);

    const loadPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        console.log(`[PanoramaCache] ✅ Loaded: ${url} (${img.width}x${img.height})`);
        this.cache.set(url, img);
        this.loading.delete(url);
        resolve(img);
      };

      img.onerror = (err) => {
        console.error(`[PanoramaCache] ❌ Failed: ${url}`, err);
        this.loading.delete(url);
        reject(new Error(`Failed to load panorama: ${url}`));
      };

      // Прогресс загрузки (работает не во всех браузерах для изображений)
      img.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(url, percent);
        }
      };

      // Начинаем загрузку с таймстемпом для обхода кэша браузера
      img.src = `${url}?t=${Date.now()}`;
    });

    this.loading.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * Предзагружает несколько панорам параллельно
   */
  async preloadMany(urls, onProgress) {
    const results = await Promise.allSettled(
      urls.map(url => this.preload(url, onProgress).catch(err => ({ url, error: err })))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[PanoramaCache] 📊 Preload complete: ${successful} success, ${failed} failed`);
    return { successful, failed, results };
  }

  /**
   * Очищает кэш (освобождает память)
   */
  clear() {
    console.log(`[PanoramaCache] 🗑️ Clearing cache (${this.cache.size} items)`);
    this.cache.forEach((img, url) => {
      img.src = ''; // Освобождаем память
    });
    this.cache.clear();
    this.loading.clear();
  }

  /**
   * Удаляет конкретное изображение из кэша
   */
  remove(url) {
    const img = this.cache.get(url);
    if (img) {
      img.src = '';
      this.cache.delete(url);
    }
  }

  /**
   * Возвращает размер кэша (для отладки)
   */
  getSize() {
    return this.cache.size;
  }
}

// Экспортируем единственный экземпляр (синглтон)
export const panoramaCache = new PanoramaCache();