import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  isAllowed: boolean;
  redirectPath?: string;
}

const ProtectedRoute = ({
  children,
  isAllowed,
  redirectPath = '/worklenz/login',
}: ProtectedRouteProps) => {
  const location = useLocation();

  if (!isAllowed) {
    return <Navigate to={redirectPath} replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
