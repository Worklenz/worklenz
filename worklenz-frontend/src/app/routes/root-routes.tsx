import { Navigate, RouteObject } from 'react-router-dom';

const rootRoutes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/auth/login" replace />,
  },
];

export default rootRoutes;
