// src/hooks/useAuth.js
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

  const hasRole = (roles) =>
    Array.isArray(roles) ? roles.includes(role) : role === roles;

  const canAccessProjects = hasRole(['designer', 'admin']);
  const canAccessSettings = hasRole(['designer', 'admin']);

  const logout = () => {
    localStorage.clear();
    window.location.href = '/auth';
  };

  return {
    user,
    token,
    role,
    isAuthenticated,
    hasRole,
    canAccessProjects,
    canAccessSettings,
    logout,
  };
};
