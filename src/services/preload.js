export const preloadPanorama = async (url, onProgress) => {
  return new Promise((resolve, reject) => {
    if (!url) {
      console.error('❌ preloadPanorama: empty URL');
      reject(new Error('Empty URL'));
      return;
    }

    console.log(`🔄 Starting preload: ${url}`);

    // Метод 1: Простой через Image (работает везде, кэшируется браузером)
    const img = new Image();
    
    // Для кросс-доменных изображений
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      console.log(`✅ Preloaded: ${url}`);
      if (onProgress) onProgress(1, 1); // 100%
      resolve(url);
    };
    
    img.onerror = (e) => {
      console.warn(`⚠️ Image onload error for ${url}:`, e);
      
      // Метод 2: Фолбэк через fetch, если Image не сработал
      fetch(url, { mode: 'cors', cache: 'force-cache' })
        .then(resp => {
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return resp.blob();
        })
        .then(() => {
          console.log(`✅ Preloaded via fetch fallback: ${url}`);
          if (onProgress) onProgress(1, 1);
          resolve(url);
        })
        .catch(err => {
          console.error(`❌ All preload methods failed for ${url}:`, err);
          if (onProgress) onProgress(1, 1); // Считаем как "завершенный провал"
          resolve(url); // Resolve, чтобы не блокировать весь процесс
        });
    };

    // Начинаем загрузку
    img.src = url;
    
    // Таймаут на случай, если запрос завис (15 секунд)
    setTimeout(() => {
      if (img.complete === false && img.naturalWidth === 0) {
        console.warn(`⏱️ Timeout for ${url}, forcing resolve`);
        if (onProgress) onProgress(1, 1);
        resolve(url);
      }
    }, 15000);
  });
};

export const preloadPanoramasBatch = async (urls, onOverallProgress) => {
  if (!urls?.length) return [];

  let completed = 0;
  const total = urls.length;
  const results = [];
  const CONCURRENCY = 3;

  const updateProgress = () => {
    if (onOverallProgress) {
      onOverallProgress(Math.round((completed / total) * 100));
    }
  };

  // Загружаем пачками
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    
    await Promise.all(batch.map(url => 
      preloadPanorama(url)
        .then(res => { results.push(res); return res; })
        .catch(() => null) // Игнорируем ошибки отдельных картинок
        .finally(() => {
          completed++;
          updateProgress();
        })
    ));
  }

  return results.filter(Boolean);
};