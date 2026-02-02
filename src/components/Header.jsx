// src/components/Header.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ExitIcon from "../exit.svg"; // убедитесь, что путь верный

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("authToken"); // или ваш способ очистки сессии
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
      <div className="user-profile">
        <span>Name</span>
        <button
          onClick={handleLogout}
          aria-label="Выйти"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <img src={ExitIcon} alt="" width="23" height="23" />
        </button>
        <button className="lang-button">RU</button>
      </div>
    </header>
  );
};

export default Header;
