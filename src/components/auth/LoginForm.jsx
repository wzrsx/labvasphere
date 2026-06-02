// src/components/auth/LoginForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '../../services/authService';
import { getRedirectPath } from '../../utils/roleRedirect';

const LoginForm = ({ onSwitchToRegister, onSwitchToResetPass }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [redirectPath, setRedirectPath] = useState(null);

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
    const { email, password } = formData;

    if (!email || !password) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password);
      setIsLoading(false);

      if (result.success) {
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));

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
      setError('Произошла ошибка при входе. Попробуйте снова.');
      console.error('Ошибка входа:', err);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Добро пожаловать</h1>
      <p className="subtitle">Авторизуйтесь для начала работы</p>

      {error && <div className="error-message error-message-form">{error}</div>}

      {/* Показываем подсказку только если есть явный редирект */}
      {redirectPath && (
        <p
          className="redirect-hint"
          style={{ fontSize: '0.85rem', color: '#999999', marginBottom: '1rem' }}
        >
          После входа вы вернётесь на: <strong>{redirectPath}</strong>
        </p>
      )}

      <input
        name="email"
        type="email"
        placeholder="Email"
        className="input-field"
        value={formData.email}
        onChange={handleChange}
        disabled={isLoading}
      />
      <input
        name="password"
        type="password"
        placeholder="Пароль"
        className="input-field"
        value={formData.password}
        onChange={handleChange}
        disabled={isLoading}
      />
      <div className="register-link">
        <p>Еще нет профиля?</p>
        <button
          type="button"
          className="link-button"
          onClick={onSwitchToRegister}
          disabled={isLoading}
        >
          Зарегистрируйтесь
        </button>
      </div>
      <div className="register-link">
        <p>Забыли пароль?</p>
        <button
          type="button"
          className="link-button"
          onClick={onSwitchToResetPass}
          disabled={isLoading}
        >
          Восстановить
        </button>
      </div>
      <button type="submit" className="login-button" disabled={isLoading}>
        {isLoading ? 'Вход...' : 'Войти'}
      </button>
    </form>
  );
};

export default LoginForm;
