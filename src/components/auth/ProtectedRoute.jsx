import { Navigate, useLocation } from 'react-router-dom';
import { checkRouteAccess } from '../../utils/roleRedirect';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const access = checkRouteAccess(location.pathname);

  if (!access.allowed) {
    return <Navigate to={access.redirect} replace />;
  }

  return children;
};

export default ProtectedRoute;
