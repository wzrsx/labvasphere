import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ExitIcon from "../exit.svg"; // убедитесь, что путь верный
import { useAuth } from "../hooks/useAuth";

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  // Получаем имя пользователя (второе слово из ФИО)
  const getUserName = () => {
    if (!isAuthenticated) return null;
    
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      if (userData && userData.full_name) {
        const words = userData.full_name.trim().split(/\s+/);
        if (words.length >= 2) {
          return words[1]; // Второе слово (имя)
        }
        return words[0]; // Если только одно слово
      }
    } catch (error) {
      console.error('Ошибка получения имени:', error);
    }
    
    return null;
  };

  const handleLogout = () => {
    // Очищаем токен и данные пользователя
    logout();
    // Перенаправляем на страницу входа
    navigate("/auth");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="dashboard-header">
      <div className="logo">LABVASPHERE</div>
      <nav className="nav-links">
        <Link to="/main" className={isActive("/main") ? "active" : ""}>
          Мои проекты
        </Link>
        <Link to="/partner" className={isActive("/partner") ? "active" : ""}>
          Партнёрская программа
        </Link>
        <Link to="/guide" className={isActive("/guide") ? "active" : ""}>
          Инструкция
        </Link>
        <Link to="/settings" className={isActive("/settings") ? "active" : ""}>
          Настройки
        </Link>
      </nav>
      {isAuthenticated && (
        <div className="user-profile">
          <span>{getUserName() || 'Пользователь'}</span>
          <button
            onClick={handleLogout}
            aria-label="Выйти"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: "0.5rem",
            }}
          >
            <img src={ExitIcon} alt="" width="23" height="23" />
          </button>
          <button className="lang-button">RU</button>
        </div>
      )}
    </header>
  );
};

export default Header;