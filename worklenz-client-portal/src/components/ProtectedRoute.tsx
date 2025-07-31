import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin, Layout } from 'antd';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { checkTokenExpiry } from '@/store/slices/authSlice';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, token } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const location = useLocation();

  // Check token expiry on mount and periodically
  useEffect(() => {
    dispatch(checkTokenExpiry());
    
    // Check token expiry every 5 minutes
    const interval = setInterval(() => {
      dispatch(checkTokenExpiry());
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [dispatch]);

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