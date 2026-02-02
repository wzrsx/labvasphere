// src/components/auth/RegisterForm.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const RegisterForm = ({ onRegister }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    login: "",
    password: "",
    confirmPassword: "",
  });
  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Пароли не совпадают!");
      return;
    }
    // TODO: отправка на сервер
    console.log("Регистрация:", formData);
    navigate("/main"); // ← переход после "успешной" регистрации
  };
  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1>Добро пожаловать</h1>
      <p className="subtitle">Регистрация</p>
      <input
        name="name"
        type="text"
        placeholder="Ваше имя"
        className="input-field"
        required
      />
      <input
        name="login"
        type="text"
        placeholder="Придумайте логин"
        className="input-field"
        required
      />
      <div className="password-row">
        <input
          name="password"
          type="password"
          placeholder="Пароль"
          className="input-field"
          required
        />
        <input
          name="confirmPassword"
          type="password"
          placeholder="Повторите пароль"
          className="input-field"
          required
        />
      </div>

      <button type="submit" className="login-button">
        Создать аккаунт
      </button>
    </form>
  );
};

export default RegisterForm;
