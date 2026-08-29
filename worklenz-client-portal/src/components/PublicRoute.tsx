import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';

interface PublicRouteProps {
  children: React.ReactNode;
  restricted?: boolean; // If true, redirect authenticated users to dashboard
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children, restricted = false }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  // If the route is restricted (like login page) and user is authenticated, redirect to dashboard
  if (restricted && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Otherwise, render the public content
  return <>{children}</>;
};

export default PublicRoute;