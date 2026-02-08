import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from '../../services/authService';

const RegisterForm = ({ onSwitchToLogin }) => {
  const navigate = useNavigate();
  
  // Состояние для полей формы
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user', // 'user' или 'designer'
  });
  
  // Состояние для ошибок и загрузки
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Обработчик изменения полей формы
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Очищаем ошибку при изменении
    setError('');
  };

  // Обработчик отправки формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { fullName, email, password, confirmPassword, role } = formData;
    
    // Базовая валидация на фронтенде
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
      const result = await register(fullName, email, password, role);
      
      setIsLoading(false);
      
      if (result.success) {
        // Сохраняем пользователя в localStorage
        localStorage.setItem('user', JSON.stringify(result.user));
        // Перенаправляем на главную страницу
        navigate('/main');
      } else {
        setError(result.error);
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

      {/* Отображение ошибки */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <input
        name="fullName"
        type="text"
        placeholder="ФИО"
        className="input-field"
        value={formData.fullName}
        onChange={handleChange}
        disabled={isLoading}
      />
      
      <input
        name="email"
        type="email"
        placeholder="Email"
        className="input-field"
        value={formData.email}
        onChange={handleChange}
        disabled={isLoading}
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
        />
        <input
          name="confirmPassword"
          type="password"
          placeholder="Повторите пароль"
          className="input-field"
          value={formData.confirmPassword}
          onChange={handleChange}
          disabled={isLoading}
        />
      </div>

      {/* Выбор роли */}
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

      <button 
        type="submit" 
        className="login-button"
        disabled={isLoading}
      >
        {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
      </button>
    </form>
  );
};

export default RegisterForm;