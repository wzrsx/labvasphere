import React from 'react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-btn"
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
      style={{
        top: '16px',
        right: '16px',
        zIndex: 10000,
        width: '35px',
        height: '35px',
        borderRadius: '50%',
        background: 'var(--bg-secondary)',
        border: '2px solid var(--accent-primary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-md)',
        fontSize: '16px',
        transition: 'transform 0.2s ease',
      }}
      onMouseEnter={(e) => (e.target.style.transform = 'scale(1.1)')}
      onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
};

export default ThemeToggle;
