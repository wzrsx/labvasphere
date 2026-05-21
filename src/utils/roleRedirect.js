const ROUTES_BY_ROLE = {
  designer: '/main',
  user: '/main-client',
  admin: '/admin',
};

const ROLE_ACCESS_MAP = {
  '/main': ['designer', 'admin'], // только дизайнер и админ
  '/main-client': ['user', 'designer', 'admin'], // все авторизованные
  '/admin': ['admin'], // только админ
};

export const getRedirectPath = (role) => {
  return ROUTES_BY_ROLE[role] || '/main-client'; // fallback
};

//Проверяет, имеет ли пользователь с данной ролью доступ к маршруту
export const hasAccessToRoute = (pathname, role) => {
  if (!role) return false;

  // Если маршрут не в списке ограничений — считаем, что доступ открыт
  const allowedRoles = ROLE_ACCESS_MAP[pathname];
  if (!allowedRoles) return true;

  return allowedRoles.includes(role);
};

//Возвращает список ролей, имеющих доступ к маршруту
export const getAllowedRolesForRoute = (pathname) => {
  return ROLE_ACCESS_MAP[pathname] || [];
};

//Проверяет авторизацию и доступ к маршруту
export const checkRouteAccess = (pathname) => {
  try {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    // 🔹 Нет авторизации
    if (!token || !userStr) {
      return {
        allowed: false,
        reason: 'unauthorized',
        redirect: `/login?redirect=${encodeURIComponent(pathname)}`,
      };
    }

    const user = JSON.parse(userStr);
    const role = user?.role;

    // 🔹 Проверка доступа по роли
    if (!hasAccessToRoute(pathname, role)) {
      return {
        allowed: false,
        reason: 'forbidden',
        redirect: '/access-denied',
      };
    }

    // 🔹 Всё ок
    return { allowed: true, reason: null, redirect: null };
  } catch (error) {
    console.error('Ошибка проверки доступа:', error);
    return {
      allowed: false,
      reason: 'error',
      redirect: '/login',
    };
  }
};

//Хелпер для получения роли из localStorage
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
