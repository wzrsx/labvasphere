import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // 🔥 Добавляем
import './SettingsPage.css';
import {
  getUserSettings,
  updateUserSettings,
  updateDefaultIcon,
  updateDefaultColor,
  getDefaultSettings,
} from '../services/userSettingsService.js';

const SettingsPage = () => {
  const { t } = useTranslation(); // 🔥 Инициализируем

  // 🔹 Состояния
  const [showEmail, setShowEmail] = useState(true);
  const [protectDownloads, setProtectDownloads] = useState(false);
  const [markerColor, setMarkerColor] = useState('#99582A');
  const [markerIcon, setMarkerIcon] = useState('pin');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔹 Ref для debounce цвета
  const colorSaveTimeout = useRef(null);

  // 🔹 Данные для выбора
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

  // 🔹 Загрузка настроек при монтировании
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
  }, [t]); // 🔥 Добавили t в зависимости

  // 🔹 Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (colorSaveTimeout.current) clearTimeout(colorSaveTimeout.current);
    };
  }, []);

  // 🔹 Уведомления
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

  // 🔹 Универсальная функция сохранения настроек
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

  // 🔹 Обработчик смены иконки
  const handleIconChange = async (newIcon) => {
    setMarkerIcon(newIcon);
    await saveSettings(
      { default_icon: newIcon },
      'settings.notifications.icon_saved',
    );
  };

  // 🔹 Обработчик смены цвета (с debounce 500ms)
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

  // 🔹 Обработчик email-visibility
  const handleEmailToggle = async (value) => {
    setShowEmail(value);
    await saveSettings(
      { show_email: value },
      value
        ? 'settings.notifications.email_shown'
        : 'settings.notifications.email_hidden',
    );
  };

  // 🔹 Обработчик защиты от скачивания
  const handleProtectToggle = async (value) => {
    setProtectDownloads(value);
    await saveSettings(
      { protect_downloads: value },
      value
        ? 'settings.notifications.protect_on'
        : 'settings.notifications.protect_off',
    );
  };

  // 🔹 Имитация загрузки (для демо)
  const handleDownload = async () => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      showNotification(t('settings.notifications.download_ready'), 'success');
    }, 1500);
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    setTimeout(() => {
      setIsClearing(false);
      showNotification(t('settings.notifications.cache_cleared'), 'info');
    }, 1200);
  };

  // 🔹 Показ заглушки при загрузке
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
      {/* Уведомление */}
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
        {/* Контакты */}
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

        {/* Метки на панораме */}
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

        {/* Данные */}
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
                  ? t('settings.data.download.loading')
                  : t('settings.data.download.button')}
              </button>
              <span className="action-desc">
                {t('settings.data.download.desc')}
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
