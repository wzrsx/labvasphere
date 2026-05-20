import React, { useState, useEffect, useRef } from 'react';
import './SettingsPage.css';
import { 
  getUserSettings, 
  updateUserSettings, 
  updateDefaultIcon,
  updateDefaultColor,
  getDefaultSettings 
} from '../services/userSettingsService.js';

const SettingsPage = () => {
  // 🔹 Состояния
  const [showEmail, setShowEmail] = useState(true);
  const [protectDownloads, setProtectDownloads] = useState(false);
  const [markerColor, setMarkerColor] = useState('#99582A');
  const [markerIcon, setMarkerIcon] = useState('pin');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true); // ← добавлено

  // 🔹 Ref для debounce цвета
  const colorSaveTimeout = useRef(null);

  // 🔹 Данные для выбора
  const colorOptions = ['#99582A', '#6b6358', '#7a9b76', '#c9a961', '#b87b6e', '#4a4035'];
  const iconOptions = [
    { id: 'pin', label: 'Буллавка', svg: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z' },
    { id: 'dot', label: 'Точка', svg: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z' },
    { id: 'star', label: 'Звезда', svg: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z' },
    { id: 'camera', label: 'Камера', svg: 'M9 2l-1.85 2H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.15L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10z' }
  ];

  // 🔹 Загрузка настроек при монтировании
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      const result = await getUserSettings();
      
      if (result.success && result.settings) {
        // Применяем настройки из БД
        if (result.settings.default_icon !== undefined) setMarkerIcon(result.settings.default_icon);
        if (result.settings.default_color !== undefined) setMarkerColor(result.settings.default_color);
        if (result.settings.show_email !== undefined) setShowEmail(result.settings.show_email);
        if (result.settings.protect_downloads !== undefined) setProtectDownloads(result.settings.protect_downloads);
      } else if (!result.success) {
        showNotification(result.error || 'Не удалось загрузить настройки', 'error');
      }
      // Fallback на дефолты уже установлен в useState
      setLoading(false);
    };
    
    loadSettings();
  }, []);

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
  const saveSettings = async (updates, successMessage) => {
    const result = await updateUserSettings(updates);
    if (result.success) {
      if (successMessage) showNotification(successMessage, 'success');
    } else {
      showNotification(result.error, 'error');
    }
  };

  // 🔹 Обработчик смены иконки
  const handleIconChange = async (newIcon) => {
    setMarkerIcon(newIcon); // мгновенная реакция UI
    await saveSettings({ default_icon: newIcon }, 'Стиль точек сохранён');
  };

  // 🔹 Обработчик смены цвета (с debounce 500ms)
  const handleColorChange = (newColor) => {
    setMarkerColor(newColor); // мгновенная реакция UI
    
    // Отменяем предыдущий таймер
    if (colorSaveTimeout.current) clearTimeout(colorSaveTimeout.current);
    
    // Создаём новый: сохраняем через 500мс после последнего изменения
    colorSaveTimeout.current = setTimeout(async () => {
      await saveSettings({ default_color: newColor }, 'Цвет точек сохранён');
    }, 500);
  };

  // 🔹 Обработчик email-visibility
  const handleEmailToggle = async (value) => {
    setShowEmail(value); // мгновенная реакция UI
    await saveSettings({ show_email: value }, value ? 'Email будет отображаться' : 'Email скрыт');
  };

  // 🔹 Обработчик защиты от скачивания
  const handleProtectToggle = async (value) => {
    setProtectDownloads(value); // мгновенная реакция UI
    await saveSettings({ protect_downloads: value }, value ? 'Защита включена' : 'Защита отключена');
  };

  // 🔹 Имитация загрузки (для демо)
  const handleDownload = async () => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      showNotification('Портфолио готово к скачиванию', 'success');
    }, 1500);
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    setTimeout(() => {
      setIsClearing(false);
      showNotification('Временные данные очищены. Перезагрузите страницу.', 'info');
    }, 1200);
  };

  // 🔹 Показ заглушки при загрузке
  if (loading) {
    return (
      <div className="settings-page settings-loading">
        <div className="loading-spinner animate-spin">⏳</div>
        <p>Загрузка настроек...</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* Уведомление */}
      {notification && (
        <div className={`settings-toast ${notification.type} animate-slide-down`}>
          {notification.text}
        </div>
      )}

      <header className="settings-header">
        <h1>Настройки портфолио</h1>
        <p className="settings-subtitle">Управляйте тем, как клиенты видят ваши проекты</p>
      </header>

      <main className="settings-grid">
        {/* Контакты */}
        <section className="settings-card hover-lift some-points">
           <div>
            <h2>Видимость контактов</h2>
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Отображать email в профиле</span>
              <span className="setting-desc">Клиенты смогут писать вам напрямую со страницы портфолио</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={showEmail} 
                onChange={(e) => handleEmailToggle(e.target.checked)} 
              />
              <span className="slider"></span>
            </label>
          </div>
            </div> 
          <div>
            <h2>Защита работ</h2>
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Запретить сохранение панорам</span>
              <span className="setting-desc">Отключает контекстное меню и скрывает прямые ссылки на изображения</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={protectDownloads} 
                onChange={(e) => handleProtectToggle(e.target.checked)} 
              />
              <span className="slider"></span>
            </label>
          </div>
          </div>
        </section>

        {/* Метки на панораме */}
        <section className="settings-card hover-lift">
          <h2>Стиль точек на панораме</h2>
          <p className="setting-desc">Выберите вид и цвет меток, которыми вы отмечаете детали в 360° туре</p>
          <p className="setting-desc">На странице редактирования вы также сможете добавить свое изображение</p>
          
          <div className="picker-group">
            <span className="picker-label">Иконка:</span>
            <div className="icon-grid">
              {iconOptions.map((icon) => (
                <button
                  key={icon.id}
                  className={`icon-btn ${markerIcon === icon.id ? 'active' : ''}`}
                  onClick={() => handleIconChange(icon.id)}
                  title={icon.label}
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
            <span className="picker-label">Цвет:</span>
            <div className="color-grid">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  className={`color-swatch ${markerColor === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorChange(color)}
                  aria-label={`Выбрать цвет ${color}`}
                  type="button"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Данные */}
        <section className="settings-card hover-lift full-column">
          <h2>Данные и обслуживание</h2>
          <div className="full-column-flex">
              <div className="action-group">
            <button 
              className={`btn btn-primary ${isDownloading ? 'loading' : ''}`} 
              onClick={handleDownload}
              disabled={isDownloading}
              type="button"
            >
              {isDownloading ? 'Подготовка...' : 'Скачать портфолио (PDF)'}
            </button>
            <span className="action-desc">Соберёт все проекты в один архив для офлайн-презентации</span>
          </div>

          <div className="divider"></div>

          <div className="action-group">
            <button 
              className={`btn btn-secondary ${isClearing ? 'loading' : ''}`} 
              onClick={handleClearCache}
              disabled={isClearing}
              type="button"
            >
              {isClearing ? 'Очистка...' : 'Очистить кэш'}
            </button>
            <span className="action-desc">Используйте, если панорамы загружаются медленно или отображаются некорректно</span>
          </div>
          </div>
          
        </section>
      </main>
    </div>
  );
};

export default SettingsPage;