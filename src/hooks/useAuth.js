// src/hooks/useAuth.js
import { useEffect } from "react";
export const useAuth = () => {
  const getUser = () => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  };

  const user = getUser();
  const token = localStorage.getItem('token');
  const isAuthenticated = !!token && !!user;
  const role = user?.role;

  const hasRole = (allowed) => {
  if (!user?.role) return false; // ← Нет роли = нет доступа
  
  // Если roles — строка:
  if (typeof user.role === 'string') {
    return allowed.includes(user.role);
  }
  // Если roles — массив:
  if (Array.isArray(user.roles)) {
    return user.role.some(role => allowed.includes(role));
  }
  return false;
};

  const canAccessProjects = hasRole(['designer', 'admin']);
  const canAccessRef = hasRole(['designer', 'admin']);
  const canAccessGuide = hasRole(['designer', 'admin']);
  const canAccessSettings = hasRole(['designer', 'admin']);

  const logout = () => {
    localStorage.clear();
    window.location.href = '/auth';
  };
  useEffect(() => {
    console.log('👤 User roles:', user?.role);
    console.log('🔑 hasRole(["designer","admin"]):', hasRole(['designer', 'admin']));
    console.log('✅ canAccessRef:', canAccessRef);
    console.log('✅ canAccessGuide:', canAccessGuide);
  }, [user]);
  return {
    user,
    token,
    role,
    isAuthenticated,
    hasRole,
    canAccessProjects,
    canAccessSettings,
    canAccessRef,
    canAccessGuide,
    logout,
  };
};
