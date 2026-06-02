// src/pages/AccessDenied.jsx
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getUserRole, getRedirectPath } from '../utils/roleRedirect';
import './AccessDenied.css';

const AccessDenied = () => {
  const navigate = useNavigate();
  const role = getUserRole();
  const [countdown, setCountdown] = useState(5);

  // Обратный отсчёт для авто-редиректа
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate(role ? getRedirectPath(role) : '/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, role]);

  const handleGoBack = () => {
    navigate(role ? getRedirectPath(role) : '/');
  };

  const handleContactSupport = () => {
    navigate('/contact');
  };

  return (
    <div className="access-denied">
      <div className="access-denied__bg" />

      <div className="access-denied__content">
        <div className="access-denied__icon">
          <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <rect
              x="38"
              y="32"
              width="24"
              height="20"
              rx="4"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <path
              d="M42 32V26C42 21 46 18 50 18C54 18 58 21 58 26V32"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M50 58V72"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="50" cy="78" r="3" fill="currentColor" />
          </svg>
        </div>

        <h1 className="access-denied__title">Доступ ограничен</h1>
        <p className="access-denied__subtitle">
          У вас недостаточно прав для просмотра этой страницы
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details className="access-denied__debug">
            <summary>Техническая информация</summary>
            <dl>
              <dt>Ваша роль:</dt>
              <dd>{role || 'не авторизован'}</dd>

              <dt>Требуемые роли:</dt>
              <dd>designer, admin</dd>

              <dt>Маршрут:</dt>
              <dd>{window.location.pathname}</dd>
            </dl>
          </details>
        )}

        <div className="access-denied__actions">
          <button
            onClick={handleGoBack}
            className="btn btn--primary hover-lift"
          >
            {role ? 'Вернуться в кабинет' : 'На главную'}
          </button>

          <button
            onClick={handleContactSupport}
            className="btn btn--secondary hover-lift"
          >
            Связаться с поддержкой
          </button>
        </div>

        {role === 'user' && (
          <div className="access-denied__hint">
            <p>
              💡 <strong>Хотите больше возможностей?</strong>
              <br />
              <Link to="/auth?mode=register&role=designer">
                Оформите профиль архитектора{' '}
              </Link>
              для публикации 360° панорам и доступа к инструментам
            </p>
          </div>
        )}
      </div>

      <div className="access-denied__footer">
        <p>
          Перенаправление через{' '}
          <span className="access-denied__countdown">{countdown}</span> сек...
        </p>
      </div>
    </div>
  );
};

export default AccessDenied;
