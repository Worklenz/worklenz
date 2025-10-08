import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin, Layout } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, token } = useAppSelector((state) => state.auth);
  const location = useLocation();

  // If we're still loading, show a loading spinner
  if (isLoading) {
    return (
      <Layout style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" />
      </Layout>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated || !token) {
    return (
      <Navigate 
        to="/auth/login" 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // If authenticated, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;