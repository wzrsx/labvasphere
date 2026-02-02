// src/components/auth/LoginForm.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

const LoginForm = ({ onSwitchToRegister }) => {
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: отправка данных на сервер
    console.log("Форма входа отправлена");
    navigate("/main"); // ← переход после "успешного" входа
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Добро пожаловать</h1>
      <p className="subtitle">Авторизуйтесь для начала работы</p>

      <input
        name="email"
        type="text"
        placeholder="Логин"
        className="input-field"
        required
      />
      <input
        name="password"
        type="password"
        placeholder="Пароль"
        className="input-field"
        required
      />

      <div className="register-link">
        <p>Еще нет профиля?</p>
        <button
          type="button"
          className="link-button"
          onClick={onSwitchToRegister}
        >
          Зарегистрируйтесь
        </button>
      </div>

      <button type="submit" className="login-button">
        Войти
      </button>
    </form>
  );
};

export default LoginForm;
