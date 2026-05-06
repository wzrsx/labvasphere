import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProfile,
  updateProfile,
  changePassword,
    uploadAvatar,     
  deleteAvatar,        
  validateAvatarFile, 
} from '../services/userService';
import { CONFIG } from '../config';
import Header from '../components/Header';
import './ProfilePage.css';

const ProfilePage = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    bio: '',
    avatarUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setPasswordError(null);
    setPasswordSuccess(null);
  };
  // Загрузка данных пользователя
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const result = await getProfile();
      if (result.success) {
        const userData = result.user;
        setUser(userData);
        setFormData({
          fullName: userData.full_name || '',
          email: userData.email || '',
          bio: userData.bio || '',
          avatarUrl: userData.avatar_url || '',
        });
        setError(null);

        // Обновляем localStorage для других компонентов
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Ошибка загрузки профиля:', err);
      setError('Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
    setSuccess(null);
  };
  const handleSubmitPassword = async (e) => {
    e.preventDefault();

    // Валидация
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setPasswordError('Заполните все поля');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Новый пароль должен содержать минимум 6 символов');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Новые пароли не совпадают');
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordError('Новый пароль должен отличаться от текущего');
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    console.log('pass ', passwordData);
    try {
      const result = await changePassword(passwordData);

      if (result.success) {
        setPasswordSuccess(result.message);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setShowPasswordForm(false);
        setTimeout(() => setPasswordSuccess(null), 3000);
      } else {
        setPasswordError(result.error);
      }
    } catch (err) {
      console.error('Ошибка при смене пароля:', err);
      setPasswordError('Не удалось изменить пароль. Попробуйте снова.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordError(null);
    setPasswordSuccess(null);
    setShowPasswordForm(false);
  };
  const handleSave = async () => {
    if (!formData.fullName.trim()) {
      setError('ФИО обязательно для заполнения');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const profileData = {
        full_name: formData.fullName,
        bio: formData.bio || null,
        avatar_url: formData.avatarUrl || null,
      };

      const result = await updateProfile(profileData);

      if (result.success) {
        const updatedUser = result.user;
        setUser(updatedUser);

        // Обновляем localStorage
        localStorage.setItem('user', JSON.stringify(updatedUser));

        setSuccess('Профиль успешно обновлён!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Ошибка сохранения профиля:', err);
      setError('Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };
const handleAvatarChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const validation = validateAvatarFile(file);
  if (!validation.valid) {
    setError(validation.error);
    e.target.value = '';
    return;
  }

  setAvatarFile(file);
  setError(null);

  const reader = new FileReader();
  reader.onloadend = () => setAvatarPreview(reader.result);
  reader.readAsDataURL(file);
};

// Обработчик загрузки аватара
const handleUploadAvatar = async () => {
  if (!avatarFile) return;

  setUploading(true);
  setError(null);

  try {
    const result = await uploadAvatar(avatarFile);
    
    if (result.success) {
      // Обновляем состояние пользователя
      setUser(prev => ({ ...prev, avatar_url: result.avatarUrl }));
      setFormData(prev => ({ ...prev, avatarUrl: result.avatarUrl }));
      setAvatarPreview(null);
      setAvatarFile(null);
      setSuccess('Аватар успешно обновлён!');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error);
    }
  } catch (err) {
    console.error('Ошибка:', err);
    setError('Не удалось загрузить аватар');
  } finally {
    setUploading(false);
  }
};

// Обработчик удаления аватара
const handleDeleteAvatar = async () => {
  if (!window.confirm('Удалить аватар?')) return;

  try {
    const result = await deleteAvatar();
    
    if (result.success) {
      setUser(prev => ({ ...prev, avatar_url: null }));
      setFormData(prev => ({ ...prev, avatarUrl: null }));
      setAvatarPreview(null);
      setSuccess('Аватар удалён');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error);
    }
  } catch (err) {
    setError('Не удалось удалить аватар');
  }
};
const getAvatarSrc = () => {
    if (avatarPreview) return avatarPreview;
    if (formData.avatarUrl) return `${CONFIG.MEDIA_BASE_URL}${formData.avatarUrl}`;
    return '';
  };
  if (loading) {
    return (
      <div className="profile-page">
        <Header />
        <div className="profile-content">
          <div className="loading">Загрузка профиля...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <Header />
        <div className="profile-content">
          <div className="error-message">{error}</div>
          <button onClick={handleLogout} className="btn-secondary">
            Выйти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Header />

      <div className="profile-content">
        <div className="profile-header">
          <h1>Профиль</h1>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="profile-card">
          {/* Аватар */}
          <div className="avatar-section">
  <div className="avatar-preview">
    {(avatarPreview || formData.avatarUrl) ? (
      <img
  src={getAvatarSrc()}
  alt="Аватар"
  className="avatar-img"
  onError={(e) => {
    console.error('❌ Ошибка загрузки аватара:', e);
    console.log('🔗 URL:', getAvatarSrc());
    
    // Показываем заглушку при ошибке
    e.target.style.display = 'none';
    const placeholder = document.createElement('div');
    placeholder.className = 'avatar-placeholder';
    placeholder.textContent = formData.fullName?.charAt(0)?.toUpperCase() || '?';
    e.target.parentElement.appendChild(placeholder);
  }}
  onLoad={() => {
    console.log('✅ Аватар загружен:', formData.avatarUrl);
  }}
/>
    ) : (
      <div className="avatar-placeholder">
        {formData.fullName?.charAt(0)?.toUpperCase() || '?'}
      </div>
    )}
  </div>

  {/* Кнопки управления аватаром */}
  <div className="avatar-actions">
    {/* Скрытый input для выбора файла */}
    <label className="btn-secondary avatar-btn">
      <input
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleAvatarChange}
        disabled={uploading || saving}
        style={{ display: 'none' }}
      />
      {uploading ? '⏳ Загрузка...' : '📷 Выбрать фото'}
    </label>

    {/* Кнопка "Сохранить" — появляется после выбора файла */}
    {avatarFile && !uploading && (
      <button 
        onClick={handleUploadAvatar}
        className="btn-primary avatar-btn"
        disabled={uploading}
      >
        💾 Сохранить
      </button>
    )}

    {/* Кнопка "Отмена" — если выбран файл, но ещё не загружен */}
    {avatarFile && (
      <button 
        onClick={() => {
          setAvatarFile(null);
          setAvatarPreview(null);
        }}
        className="btn-secondary avatar-btn"
        disabled={uploading}
      >
        ✕ Отмена
      </button>
    )}

    {/* Кнопка "Удалить" — если есть сохранённый аватар и не выбран новый */}
    {formData.avatarUrl && !avatarFile && (
      <button 
        onClick={handleDeleteAvatar}
        className="btn-danger avatar-btn"
        disabled={uploading}
      >
        🗑️ Удалить
      </button>
    )}
  </div>
  
  <small className="form-hint">
    JPG, PNG или WebP, макс. 5MB
  </small>
          </div>

          {/* Форма профиля */}
          <div className="profile-form">
            <div className="form-group">
              <label htmlFor="fullName">ФИО *</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                className="form-input"
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                disabled
              />
              <small className="form-hint">Email нельзя изменить</small>
            </div>

            <div className="form-group">
              <label htmlFor="bio">О себе</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                className="form-textarea"
                rows="4"
                placeholder="Расскажите о себе и вашем опыте..."
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label>Роль</label>
              <div className="role-display">
                {user?.role === 'designer'
                  ? 'Дизайнер / Архитектор'
                  : 'Пользователь'}
              </div>
              <small className="form-hint">
                Роль назначается при регистрации и не может быть изменена
              </small>
            </div>
            {/* 🔐 Секция смены пароля */}
            <div className="form-section">
              <div className="section-header">
                {!showPasswordForm ? (
                  <button
                    type="button"
                    className="change-pass-button"
                    onClick={() => setShowPasswordForm(true)}
                    disabled={saving}
                  >
                    Изменить пароль
                  </button>
                ) : (
                  <button
                    type="button"
                    className="change-pass-button"
                    onClick={handleCancelPasswordChange}
                    disabled={passwordSaving}
                  >
                    Отмена
                  </button>
                )}
              </div>

              {showPasswordForm && (
                <form onSubmit={handleSubmitPassword} className="password-form">
                  {passwordError && (
                    <div className="error-message">{passwordError}</div>
                  )}
                  {passwordSuccess && (
                    <div className="success-message">{passwordSuccess}</div>
                  )}

                  <div className="form-group">
                    <label htmlFor="currentPassword">Текущий пароль *</label>
                    <input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className="form-input"
                      disabled={passwordSaving}
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="newPassword">Новый пароль *</label>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className="form-input"
                      disabled={passwordSaving}
                      autoComplete="new-password"
                      placeholder="Минимум 8 символов"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmPassword">
                      Подтвердите новый пароль *
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className="form-input"
                      disabled={passwordSaving}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="password-hints">
                    <small>• Пароль должен содержать минимум 8 символов</small>
                    <br />
                    <small>
                      • Используйте буквы, цифры и специальные символы
                    </small>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={passwordSaving}
                    >
                      {passwordSaving
                        ? 'Сохранение...'
                        : 'Сохранить новый пароль'}
                    </button>
                  </div>
                </form>
              )}
            </div>
            <div className="bottom-section">
              <button className="btn-primary">Предпросмотр профиля</button>
              <button
                onClick={handleSave}
                className="btn-primary"
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
              <button onClick={handleLogout} className="btn-danger">
                Выйти
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
