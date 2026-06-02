// src/pages/AuthPage.jsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import ResetPasswordForm from '../components/auth/ResetPasswordForm';
import './AuthPage.css';

const AuthPage = () => {
  const location = useLocation(); 
  const [authMode, setAuthMode] = useState('login');

  const handleLogin = (credentials) => {
    console.log('Логин:', credentials);
    alert('Вход выполнен (заглушка)');
  };

  const handleRegister = (userData) => {
    console.log('Регистрация:', userData);
    alert('Регистрация успешна (заглушка)');
  };
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const role = params.get('role');

    if (mode === 'register') {
      setAuthMode('register');
    }
  }, [location.search]);
  return (
    <div className="auth-page">
      <header className="auth-header">
        LABVASPHERE
        <div className="header-underline"></div>
      </header>

      <div className="auth-main">
        {authMode === 'login' && (
          <LoginForm
            onLogin={handleLogin}
            onSwitchToRegister={() => setAuthMode('register')}
            onSwitchToResetPass={() => setAuthMode('reset')}
          />
        )}

        {authMode === 'register' && (
          <RegisterForm
            onRegister={handleRegister}
            onSwitchToLogin={() => setAuthMode('login')}
          />
        )}

        {authMode === 'reset' && (
          <ResetPasswordForm onSwitchToLogin={() => setAuthMode('login')} />
        )}
      </div>
    </div>
  );
};

export default AuthPage;
