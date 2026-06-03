import React, { useState } from 'react';
import { requestPasswordReset } from '../../services/authService';

const ResetPasswordForm = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setEmail(e.target.value);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('Пожалуйста, введите email');
      return;
    }

    // Простая валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Введите корректный email');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await requestPasswordReset(email);
      setIsLoading(false);

      if (result.success) {
        setSuccess(result.message);
        setEmail('');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setIsLoading(false);
      setError('Произошла ошибка. Попробуйте снова.');
      console.error('Ошибка восстановления:', err);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Восстановление пароля</h1>
      <p className="subtitle">Введите email для получения инструкций</p>

      {/* Отображение ошибки */}
      {error && <div className="error-message">{error}</div>}

      {/* Отображение успеха */}
      {success && <div className="success-message success-message-email">{success}</div>}

      {!success ? (
        <>
          <input
            name="email"
            type="email"
            placeholder="Email"
            className="input-field"
            value={email}
            onChange={handleChange}
            disabled={isLoading}
            autoComplete="email"
          />

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Отправка...' : 'Отправить инструкции'}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="login-button"
          onClick={onSwitchToLogin}
        >
          Вернуться ко входу
        </button>
      )}
    </form>
  );
};

export default ResetPasswordForm;
