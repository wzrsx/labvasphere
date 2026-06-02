import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Ошибка загрузки профиля:', err);
      setError(t('profile.errors.load_failed'));
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

    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setPasswordError(t('profile.errors.password_fields_required'));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError(t('profile.errors.password_min_length'));
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError(t('profile.errors.password_mismatch'));
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordError(t('profile.errors.password_same_as_current'));
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const result = await changePassword(passwordData);

      if (result.success) {
        setPasswordSuccess(result.message || t('profile.notifications.password_changed'));
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
      setPasswordError(t('profile.errors.password_change_failed'));
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
      setError(t('profile.errors.full_name_required'));
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
        localStorage.setItem('user', JSON.stringify(updatedUser));

        setSuccess(t('profile.notifications.profile_updated'));
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Ошибка сохранения профиля:', err);
      setError(t('profile.errors.save_failed'));
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

  const handleUploadAvatar = async () => {
    if (!avatarFile) return;

    setUploading(true);
    setError(null);

    try {
      const result = await uploadAvatar(avatarFile);

      if (result.success) {
        setUser((prev) => ({ ...prev, avatar_url: result.avatarUrl }));
        setFormData((prev) => ({ ...prev, avatarUrl: result.avatarUrl }));
        setAvatarPreview(null);
        setAvatarFile(null);
        setSuccess(t('profile.notifications.avatar_updated'));
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Ошибка:', err);
      setError(t('profile.errors.avatar_upload_failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!window.confirm(t('profile.avatar.confirm_delete'))) return;

    try {
      const result = await deleteAvatar();

      if (result.success) {
        setUser((prev) => ({ ...prev, avatar_url: null }));
        setFormData((prev) => ({ ...prev, avatarUrl: null }));
        setAvatarPreview(null);
        setSuccess(t('profile.notifications.avatar_deleted'));
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(t('profile.errors.avatar_delete_failed'));
    }
  };

  const getAvatarSrc = () => {
    if (avatarPreview) return avatarPreview;
    if (formData.avatarUrl)
      return `${CONFIG.MEDIA_BASE_URL}/${formData.avatarUrl}`;
    return '';
  };

  if (loading) {
    return (
      <div className="profile-page">
        <Header />
        <div className="profile-content">
          <div className="loading">{t('profile.loading')}</div>
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
            {t('profile.logout')}
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
          <h1>{t('profile.title')}</h1>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="profile-card">
          {/* Аватар */}
          <div className="avatar-section">
            <div className="avatar-preview">
              {avatarPreview || formData.avatarUrl ? (
                <img
                  src={getAvatarSrc()}
                  alt={t('profile.avatar.alt')}
                  className="avatar-img"
                  onError={(e) => {
                    console.error('❌ Ошибка загрузки аватара:', e);
                    console.log('🔗 URL:', getAvatarSrc());
                    e.target.style.display = 'none';
                    const placeholder = document.createElement('div');
                    placeholder.className = 'avatar-placeholder';
                    placeholder.textContent =
                      formData.fullName?.charAt(0)?.toUpperCase() || '?';
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

            <div className="avatar-actions">
              <label className="btn-secondary avatar-btn">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  disabled={uploading || saving}
                  style={{ display: 'none' }}
                />
                {uploading
                  ? t('profile.avatar.uploading')
                  : t('profile.avatar.choose_photo')}
              </label>

              {avatarFile && !uploading && (
                <button
                  onClick={handleUploadAvatar}
                  className="btn-primary avatar-btn"
                  disabled={uploading}
                >
                  {t('profile.avatar.save')}
                </button>
              )}

              {avatarFile && (
                <button
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarPreview(null);
                  }}
                  className="btn-secondary avatar-btn"
                  disabled={uploading}
                >
                  {t('profile.avatar.cancel')}
                </button>
              )}

              {formData.avatarUrl && !avatarFile && (
                <button
                  onClick={handleDeleteAvatar}
                  className="btn-danger avatar-btn"
                  disabled={uploading}
                >
                  {t('profile.avatar.delete')}
                </button>
              )}
            </div>

            <small className="form-hint">{t('profile.avatar.hint')}</small>
          </div>

          {/* Форма профиля */}
          <div className="profile-form">
            <div className="form-group">
              <label htmlFor="fullName">{t('profile.form.full_name_label')}</label>
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
              <label htmlFor="email">{t('profile.form.email_label')}</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                disabled
              />
              <small className="form-hint">{t('profile.form.email_hint')}</small>
            </div>

            <div className="form-group">
              <label htmlFor="bio">{t('profile.form.bio_label')}</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                className="form-textarea"
                rows="4"
                placeholder={t('profile.form.bio_placeholder')}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label>{t('profile.form.role_label')}</label>
              <div className="role-display">
                {user?.role === 'designer'
                  ? t('profile.roles.designer')
                  : t('profile.roles.user')}
              </div>
              <small className="form-hint">{t('profile.form.role_hint')}</small>
            </div>

            {/* Секция смены пароля */}
            <div className="form-section">
              <div className="section-header">
                {!showPasswordForm ? (
                  <button
                    type="button"
                    className="change-pass-button"
                    onClick={() => setShowPasswordForm(true)}
                    disabled={saving}
                  >
                    {t('profile.password.change_button')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="change-pass-button"
                    onClick={handleCancelPasswordChange}
                    disabled={passwordSaving}
                  >
                    {t('profile.password.cancel')}
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
                    <label htmlFor="currentPassword">
                      {t('profile.password.current_label')}
                    </label>
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
                    <label htmlFor="newPassword">
                      {t('profile.password.new_label')}
                    </label>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className="form-input"
                      disabled={passwordSaving}
                      autoComplete="new-password"
                      placeholder={t('profile.password.new_placeholder')}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmPassword">
                      {t('profile.password.confirm_label')}
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
                    <small>{t('profile.password.hint_length')}</small>
                    <br />
                    <small>{t('profile.password.hint_complexity')}</small>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={passwordSaving}
                    >
                      {passwordSaving
                        ? t('profile.password.saving')
                        : t('profile.password.save_button')}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="bottom-section">
              <button className="btn-primary">{t('profile.preview')}</button>
              <button
                onClick={handleSave}
                className="btn-primary"
                disabled={saving}
              >
                {saving ? t('profile.saving') : t('profile.save_changes')}
              </button>
              <button onClick={handleLogout} className="btn-danger">
                {t('profile.logout')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;