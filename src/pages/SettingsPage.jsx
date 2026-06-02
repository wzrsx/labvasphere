import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next'; 
import './SettingsPage.css';
import {
  getUserSettings,
  updateUserSettings,
  updateDefaultIcon,
  updateDefaultColor,
  getDefaultSettings,
} from '../services/userSettingsService.js';
import { getProjects } from '../services/projectService';
import { exportPortfolioToPdf } from '../services/pdfExportService';
import { CONFIG } from '../config.js'

const SettingsPage = () => {
  const { t } = useTranslation(); 

  //Состояния
  const [showEmail, setShowEmail] = useState(true);
  const [protectDownloads, setProtectDownloads] = useState(false);
  const [markerColor, setMarkerColor] = useState('#99582A');
  const [markerIcon, setMarkerIcon] = useState('pin');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ref для debounce цвета
  const colorSaveTimeout = useRef(null);

  // Данные для выбора
  const colorOptions = [
    '#99582A',
    '#6b6358',
    '#7a9b76',
    '#c9a961',
    '#b87b6e',
    '#4a4035',
  ];

  const iconOptions = [
    {
      id: 'pin',
      labelKey: 'settings.markers.icons.pin',
      svg: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z',
    },
    {
      id: 'dot',
      labelKey: 'settings.markers.icons.dot',
      svg: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
    },
    {
      id: 'star',
      labelKey: 'settings.markers.icons.star',
      svg: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    },
    {
      id: 'camera',
      labelKey: 'settings.markers.icons.camera',
      svg: 'M9 2l-1.85 2H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.15L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10z',
    },
  ];

  // Загрузка настроек при монтировании
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      const result = await getUserSettings();

      if (result.success && result.settings) {
        if (result.settings.default_icon !== undefined)
          setMarkerIcon(result.settings.default_icon);
        if (result.settings.default_color !== undefined)
          setMarkerColor(result.settings.default_color);
        if (result.settings.show_email !== undefined)
          setShowEmail(result.settings.show_email);
        if (result.settings.protect_downloads !== undefined)
          setProtectDownloads(result.settings.protect_downloads);
      } else if (!result.success) {
        showNotification(t('settings.notifications.load_error'), 'error');
      }
      setLoading(false);
    };

    loadSettings();
  }, [t]); 

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (colorSaveTimeout.current) clearTimeout(colorSaveTimeout.current);
    };
  }, []);

  // Уведомления
  const showNotification = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Авто-закрытие уведомления
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Универсальная функция сохранения настроек
  const saveSettings = async (updates, successKey) => {
    const result = await updateUserSettings(updates);
    if (result.success) {
      if (successKey) showNotification(t(successKey), 'success');
    } else {
      showNotification(
        result.error || t('settings.notifications.save_error'),
        'error',
      );
    }
  };

  // Обработчик смены иконки
  const handleIconChange = async (newIcon) => {
    setMarkerIcon(newIcon);
    await saveSettings(
      { default_icon: newIcon },
      'settings.notifications.icon_saved',
    );
  };

  // Обработчик смены цвета (с debounce 500ms)
  const handleColorChange = (newColor) => {
    setMarkerColor(newColor);

    if (colorSaveTimeout.current) clearTimeout(colorSaveTimeout.current);

    colorSaveTimeout.current = setTimeout(async () => {
      await saveSettings(
        { default_color: newColor },
        'settings.notifications.color_saved',
      );
    }, 500);
  };

  // Обработчик email-visibility
  const handleEmailToggle = async (value) => {
    setShowEmail(value);
    await saveSettings(
      { show_email: value },
      value
        ? 'settings.notifications.email_shown'
        : 'settings.notifications.email_hidden',
    );
  };

  // Обработчик защиты от скачивания
  const handleProtectToggle = async (value) => {
    setProtectDownloads(value);
    await saveSettings(
      { protect_downloads: value },
      value
        ? 'settings.notifications.protect_on'
        : 'settings.notifications.protect_off',
    );
  };

  const handleDownload = async () => {
  showNotification(t('settings.notifications.feature_in_progress'), 'false');
  return;
  console.log('🚀 [Download] === handleDownload START ===');
  console.log('[Download] CONFIG at handleDownload:', {
    MEDIA_BASE_URL: CONFIG?.MEDIA_BASE_URL,
    isDefined: CONFIG !== undefined,
    type: typeof CONFIG,
  });

  if (isDownloading) {
    console.log('[Download] Already downloading, skipping');
    return;
  }
  
  setIsDownloading(true);

  try {
    console.log('[Download] Step 1: Fetching projects...');
    const projectsResponse = await getProjects();
    
    console.log('[Download] Step 2: Response received:', {
      success: projectsResponse?.success,
      error: projectsResponse?.error,
      projectsCount: projectsResponse?.projects?.length,
    });
    
    if (!projectsResponse?.success) {
      const errMsg = projectsResponse?.error || 'Не удалось загрузить проекты';
      console.error('[Download] ❌ API error:', errMsg);
      throw new Error(errMsg);
    }

    console.log('[Download] Step 3: All projects:', projectsResponse.projects.map(p => ({
      id: p?.id?.slice(0, 8) + '...',
      title: p?.title,
      status: p?.status,
      cover: p?.cover_image_url,
    })));
    
    // Проверка структуры первого проекта
    if (projectsResponse.projects?.[0]) {
      console.log('[Download] First project FULL structure:', JSON.stringify(projectsResponse.projects[0], null, 2));
    }

    // Данные автора
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const authorName = currentUser?.name || currentUser?.email || 'Дизайнер';
    const authorAvatar = currentUser?.avatar_url || null;

    console.log('[Download] Author data:', {
      name: authorName,
      avatar: authorAvatar,
      currentUserKeys: Object.keys(currentUser || {}),
    });

    // Фильтрация проектов
    console.log('[Download] Step 4: Filtering published projects...');
    const publishedProjects = projectsResponse.projects.filter(p => {
      const isPublished = p?.status === 'published';
      console.log(`  • "${p?.title || 'No title'}" [${p?.status}] → ${isPublished ? '✅ INCLUDED' : '❌ EXCLUDED'}`);
      return isPublished;
    });

    console.log('[Download] Published projects count:', publishedProjects.length);
    console.log('[Download] Published projects details:', publishedProjects.map(p => ({
      title: p.title,
      cover_image_url: p.cover_image_url,
      status: p.status,
    })));

    if (publishedProjects.length === 0) {
      console.error('[Download] ❌ No published projects!');
      throw new Error('Нет опубликованных проектов. Измените статус проектов на "published" или установите includeDrafts: true');
    }

    // ФИНАЛЬНАЯ ПРОВЕРКА ПЕРЕД ЭКСПОРТОМ
    console.log('[Download] Step 5: Pre-export checks...');
    console.log('[Download] CONFIG.MEDIA_BASE_URL:', CONFIG?.MEDIA_BASE_URL);
    
    // Тест getMediaUrl вручную
    const testCover = publishedProjects[0]?.cover_image_url;
    const testUrl = testCover 
      ? (testCover.startsWith('http') ? testCover : `${CONFIG?.MEDIA_BASE_URL || ''}/${testCover}`)
      : null;
    console.log('[Download] Test URL generation:', {
      original: testCover,
      generated: testUrl,
      isAbsolute: testUrl?.startsWith('http'),
    });

    // Проверка функции экспорта
    console.log('[Download] exportPortfolioToPdf type:', typeof exportPortfolioToPdf);

    // Вызов экспорта
    console.log('[Download] Step 6: Calling exportPortfolioToPdf...');
    const result = await exportPortfolioToPdf(publishedProjects, {
      title: `Портфолио ${authorName}`,
      author: authorName,
      authorAvatar: authorAvatar,
      includeDrafts: false,
      pageSize: 'a4',
      orientation: 'portrait',
    });

    console.log('[Download] Export result:', result);

    if (result?.success) {
      console.log('[Download] ✅ SUCCESS');
      showNotification(`✅ PDF создан: ${result.fileName}`, 'success');
    } else {
      console.error('[Download] ❌ Export returned error:', result?.error);
      throw new Error(result?.error || 'Ошибка генерации PDF');
    }

  } catch (err) {
    console.error('❌ [Download] CATCH ERROR:', {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
    });
    showNotification(err?.message || 'Не удалось создать PDF', 'error');
  } finally {
    console.log('[Download] === handleDownload END (finally) ===');
    setIsDownloading(false);
  }
};
  const handleClearCache = async () => {
    setIsClearing(true);
    setTimeout(() => {
      setIsClearing(false);
      showNotification(t('settings.notifications.cache_cleared'), 'info');
    }, 1200);
  };

  // Показ заглушки при загрузке
  if (loading) {
    return (
      <div className="settings-page settings-loading">
        <div className="loading-spinner animate-spin">⏳</div>
        <p>{t('settings.loading')}</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {notification && (
        <div
          className={`settings-toast ${notification.type} animate-slide-down`}
        >
          {notification.text}
        </div>
      )}

      <header className="settings-header">
        <h1>{t('settings.header.title')}</h1>
        <p className="settings-subtitle">{t('settings.header.subtitle')}</p>
      </header>

      <main className="settings-grid">
        <section className="settings-card hover-lift some-points">
          <div>
            <h2>{t('settings.contacts.title')}</h2>
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">
                  {t('settings.contacts.email.label')}
                </span>
                <span className="setting-desc">
                  {t('settings.contacts.email.desc')}
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showEmail}
                  onChange={(e) => handleEmailToggle(e.target.checked)}
                  aria-label={t('settings.contacts.email.label')}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
          <div>
            <h2>{t('settings.protection.title')}</h2>
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">
                  {t('settings.protection.downloads.label')}
                </span>
                <span className="setting-desc">
                  {t('settings.protection.downloads.desc')}
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={protectDownloads}
                  onChange={(e) => handleProtectToggle(e.target.checked)}
                  aria-label={t('settings.protection.downloads.label')}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </section>

        <section className="settings-card hover-lift">
          <h2>{t('settings.markers.title')}</h2>
          <p className="setting-desc">{t('settings.markers.desc')}</p>
          <p className="setting-desc">
            {t('settings.markers.custom_image_hint')}
          </p>

          <div className="picker-group">
            <span className="picker-label">
              {t('settings.markers.icon_label')}
            </span>
            <div className="icon-grid">
              {iconOptions.map((icon) => (
                <button
                  key={icon.id}
                  className={`icon-btn ${markerIcon === icon.id ? 'active' : ''}`}
                  onClick={() => handleIconChange(icon.id)}
                  title={t(icon.labelKey)}
                  aria-label={t(icon.labelKey)}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d={icon.svg} />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          <div className="picker-group">
            <span className="picker-label">
              {t('settings.markers.color_label')}
            </span>
            <div className="color-grid">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  className={`color-swatch ${markerColor === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorChange(color)}
                  aria-label={t('settings.markers.color_aria', { color })}
                  type="button"
                />
              ))}
            </div>
          </div>
        </section>
        <section className="settings-card hover-lift full-column">
          <h2>{t('settings.data.title')}</h2>
          <div className="full-column-flex">
            <div className="action-group">
              <button
                className={`btn btn-primary ${isDownloading ? 'loading' : ''}`}
                onClick={handleDownload}
                disabled={isDownloading}
                type="button"
              >
                {isDownloading
                  ? t('settings.export.button_loading')
                  : t('settings.export.button')}
              </button>
              <span className="action-desc">
                {t('settings.export.description', {
                  defaultValue:
                    'Соберёт все проекты в один архив для офлайн-презентации',
                })}
              </span>
            </div>

            <div className="divider"></div>

            <div className="action-group">
              <button
                className={`btn btn-secondary ${isClearing ? 'loading' : ''}`}
                onClick={handleClearCache}
                disabled={isClearing}
                type="button"
              >
                {isClearing
                  ? t('settings.data.cache.loading')
                  : t('settings.data.cache.button')}
              </button>
              <span className="action-desc">
                {t('settings.data.cache.desc')}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default SettingsPage;
