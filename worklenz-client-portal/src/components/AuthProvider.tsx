import React, { useEffect, useCallback } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { refreshToken, logoutUser, initializeAuth } from '@/store/slices/authSlice';
import { TokenManager } from '@/utils/tokenManager';

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { token, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  const handleTokenExpiry = useCallback(() => {
    dispatch(logoutUser());
  }, [dispatch]);

  const handleTokenRefresh = useCallback(() => {
    if (isAuthenticated && token) {
      dispatch(refreshToken());
    }
  }, [dispatch, isAuthenticated, token]);

  // Initialize authentication on app load
  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  // Set up periodic checks after authentication is initialized
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Set up periodic token expiry checks
      const stopExpiryCheck = TokenManager.startTokenExpiryCheck(handleTokenExpiry, 300000); // Check every 5 minutes
      
      // Set up periodic token refresh checks
      const stopRefreshCheck = TokenManager.startTokenRefreshCheck(handleTokenRefresh, 300000); // Check every 5 minutes

      return () => {
        stopExpiryCheck();
        stopRefreshCheck();
      };
    }
  }, [isLoading, isAuthenticated, handleTokenExpiry, handleTokenRefresh]);

  // Set up visibility change listener to check token when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated) {
        // Only check if token is actually expired, not just close to expiry
        if (TokenManager.isTokenExpired()) {
          dispatch(logoutUser());
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [dispatch, isAuthenticated]);

  // Listen for client deactivation event
  useEffect(() => {
    const handleClientDeactivated = () => {
      // Client has been deactivated, logout immediately
      // Token is already cleared by the API interceptor
      dispatch(logoutUser());
      // Redirect to login page
      if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/login') {
        window.location.href = '/login';
      }
    };

    window.addEventListener('client-deactivated', handleClientDeactivated);
    return () => window.removeEventListener('client-deactivated', handleClientDeactivated);
  }, [dispatch]);

  return <>{children}</>;
};

export default AuthProvider;