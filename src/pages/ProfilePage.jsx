import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getProfile, updateProfile } from "../services/userService";
import Header from "../components/Header";
import "./ProfilePage.css";

const ProfilePage = () => {
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    bio: '',
    avatarUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
          avatarUrl: userData.avatar_url || ''
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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
    setSuccess(null);
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
        avatar_url: formData.avatarUrl || null
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
              {formData.avatarUrl ? (
                <img src={formData.avatarUrl} alt="Аватар" className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">
                  {formData.fullName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
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
                {user?.role === 'designer' ? 'Дизайнер / Архитектор' : 'Пользователь'}
              </div>
              <small className="form-hint">
                Роль назначается при регистрации и не может быть изменена
              </small>
            </div>

            <div className="bottom-section">
                <button className="btn-primary">
                    Предпросмотр профиля
                </button>
              <button 
                onClick={handleSave} 
                className="btn-primary"
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
              <button 
                onClick={handleLogout} 
                className="btn-danger"
              >
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