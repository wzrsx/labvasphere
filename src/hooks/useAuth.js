import { useState, useEffect } from 'react';
import { getToken, logout as logoutService } from '../services/authService';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const token = getToken();
      setIsAuthenticated(!!token);
      setLoading(false);
    };

    checkAuth();
  }, []);

  const logout = () => {
    logoutService();
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    loading,
    logout,
  };
};