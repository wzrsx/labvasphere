// src/utils/roleRedirect.js
export const getRedirectPath = (role) => {
  const routes = {
    designer: '/main',
    user: '/main-client',
    admin: '/admin',
  };
  return routes[role] || '/main-client'; // fallback по умолчанию
};

export const getUserRole = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user.role;
  } catch {
    return null;
  }
};
