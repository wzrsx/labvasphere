// src/components/auth/RegisterForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // ← добавили useLocation
import { register } from '../../services/authService';
import { getRedirectPath } from '../../utils/roleRedirect';

const RegisterForm = ({ onSwitchToLogin }) => {
  const navigate = useNavigate();
  const location = useLocation(); // ← для чтения ?redirect=

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    refCode: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 🔹 Состояние для редиректа
  const [redirectPath, setRedirectPath] = useState(null);

  // 👇 Читаем реферал из localStorage
  useEffect(() => {
    const savedRef = localStorage.getItem('pending_ref');
    if (savedRef) {
      const clickTime = localStorage.getItem('referral_click_time');
      if (clickTime) {
        const daysDiff =
          (new Date() - new Date(clickTime)) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 30) {
          setFormData((prev) => ({ ...prev, refCode: savedRef }));
        } else {
          localStorage.removeItem('pending_ref');
          localStorage.removeItem('referral_click_time');
        }
      } else {
        setFormData((prev) => ({ ...prev, refCode: savedRef }));
      }
    }
  }, []);

  // 🔹 Читаем ?redirect= из URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const redirect = urlParams.get('redirect');
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      setRedirectPath(redirect);
    }
  }, [location.search]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { fullName, email, password, confirmPassword, role, refCode } =
      formData;

    if (!fullName || !email || !password || !confirmPassword) {
      setError('Пожалуйста, заполните все поля');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await register(
        fullName,
        email,
        password,
        role,
        refCode || undefined,
      );
      setIsLoading(false);

      if (result.success) {
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        localStorage.removeItem('pending_ref');
        localStorage.removeItem('referral_click_time');

        // 🔹 Явная проверка на null
        const finalRedirect =
          redirectPath !== null
            ? redirectPath
            : getRedirectPath(result.user.role);

        navigate(finalRedirect);
      } else {
        setError(result.error || 'Ошибка при регистрации. Попробуйте снова.');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Произошла ошибка при регистрации. Попробуйте снова.');
      console.error('Ошибка регистрации:', err);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Регистрация</h1>
      <p className="subtitle">Создайте аккаунт для начала работы</p>

      {error && <div className="error-message-form error-message">{error}</div>}

      {/* 🔹 Индикация, куда вернётся пользователь */}
      {redirectPath && redirectPath !== '/project' && (
        <p
          className="redirect-hint"
          style={{ fontSize: '0.85rem', color: '#999999', marginBottom: '1rem' }}
        >
          После регистрации вы вернётесь на: <strong>{redirectPath}</strong>
        </p>
      )}

      {formData.refCode && (
        <div
          className="referral-badge"
          style={{
            fontSize: '0.8rem',
            color: '#8B7355',
            marginTop: '0.5rem',
            padding: '0.5rem 1rem',
            background: '#F5F0E6',
            borderRadius: '8px',
            display: 'inline-block',
            border: '1px solid #D4C4B0',
          }}
        >
          🎁 Вы регистрируетесь по приглашению партнёра
        </div>
      )}

      {/* ... остальные поля формы (без изменений) ... */}
      <input
        name="fullName"
        type="text"
        placeholder="ФИО"
        className="input-field"
        value={formData.fullName}
        onChange={handleChange}
        disabled={isLoading}
        required
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        className="input-field"
        value={formData.email}
        onChange={handleChange}
        disabled={isLoading}
        required
      />

      <div className="password-row">
        <input
          name="password"
          type="password"
          placeholder="Пароль"
          className="input-field"
          value={formData.password}
          onChange={handleChange}
          disabled={isLoading}
          required
        />
        <input
          name="confirmPassword"
          type="password"
          placeholder="Повторите пароль"
          className="input-field"
          value={formData.confirmPassword}
          onChange={handleChange}
          disabled={isLoading}
          required
        />
      </div>

      <select
        name="role"
        className="input-field"
        value={formData.role}
        onChange={handleChange}
        disabled={isLoading}
      >
        <option value="user">Пользователь</option>
        <option value="designer">Дизайнер / Архитектор</option>
      </select>

      <div className="register-link">
        <p>Уже есть аккаунт?</p>
        <button
          type="button"
          className="link-button"
          onClick={onSwitchToLogin}
          disabled={isLoading}
        >
          Войти
        </button>
      </div>

      <button type="submit" className="login-button" disabled={isLoading}>
        {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
      </button>
    </form>
  );
};

export default RegisterForm;
