import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ExitIcon from '../exit.svg'; // убедитесь, что путь верный
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';
import { useTranslation } from 'react-i18next';

const Header = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    role,
    canAccessProjects,
    canAccessSettings,
    logout,
  } = useAuth();

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

  const handleProfile = () => {
    navigate('/profile');
  };
  const isActive = (path) => location.pathname === path;

  return (
    <header className="dashboard-header">
      <div className="logo">LABVASPHERE</div>
      <nav className="nav-links">
        {canAccessProjects ? (
          <Link to="/main" className={isActive('/main') ? 'active' : ''}>
            {t('nav.projects')}
          </Link>
        ) : (
          <Link
            to="/main-client"
            className={isActive('/main-client') ? 'active' : ''}
          >
            {t('nav.projects_client')}
          </Link>
        )}
        <Link to="/partner" className={isActive('/partner') ? 'active' : ''}>
          {t('nav.partner')}
        </Link>
        <Link to="/guide" className={isActive('/guide') ? 'active' : ''}>
          {t('nav.guide')}
        </Link>
        {canAccessSettings && (
          <Link
            to="/settings"
            className={isActive('/settings') ? 'active' : ''}
          >
            {t('nav.settings')}
          </Link>
        )}
      </nav>
      {isAuthenticated && (
        <div className="user-profile">
          <span onClick={handleProfile}>
            {getUserName() || t('user.default')}
          </span>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      )}
    </header>
  );
};

export default Header;
