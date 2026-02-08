import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from '../../services/authService';
const LoginForm = ({ onSwitchToRegister }) => {
  const navigate = useNavigate();
  
  // Состояние для полей формы
  const [formData, setFormData] = useState({
    email: '',
    password: '',
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
    
    const { email, password } = formData;
    
    // Валидация на фронтенде
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
        // Сохраняем пользователя в localStorage
        localStorage.setItem('user', JSON.stringify(result.user));
        // Перенаправляем на главную страницу
        navigate('/main');
      } else {
        setError(result.error);
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

      {/* Отображение ошибки */}
      {error && (
        <div className="error-message">
          {error}
        </div>
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

      <button 
        type="submit" 
        className="login-button"
        disabled={isLoading}
      >
        {isLoading ? 'Вход...' : 'Войти'}
      </button>
    </form>
  );
};

export default LoginForm;