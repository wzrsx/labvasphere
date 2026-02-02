// src/pages/AuthPage.jsx
import React, { useState } from "react";
import LoginForm from "../components/auth/LoginForm";
import RegisterForm from "../components/auth/RegisterForm";
import "./AuthPage.css";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);

  const handleLogin = (credentials) => {
    console.log("Логин:", credentials);
    alert("Вход выполнен (заглушка)");
  };

  const handleRegister = (userData) => {
    console.log("Регистрация:", userData);
    alert("Регистрация успешна (заглушка)");
  };

  return (
    <div className="auth-page">
      <header className="auth-header">
        LABVASPHERE
        <div className="header-underline"></div>
      </header>

      <div className="auth-main">
        {isLogin ? (
          <LoginForm
            onLogin={handleLogin}
            onSwitchToRegister={() => setIsLogin(false)}
          />
        ) : (
          <RegisterForm
            onRegister={handleRegister}
            onSwitchToLogin={() => setIsLogin(true)}
          />
        )}
      </div>
    </div>
  );
};

export default AuthPage;
