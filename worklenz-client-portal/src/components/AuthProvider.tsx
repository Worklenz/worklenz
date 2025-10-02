import React, { useEffect, useCallback } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { checkTokenExpiry, refreshToken, logoutUser } from '@/store/slices/authSlice';
import { TokenManager } from '@/utils/tokenManager';
import { clientPortalAPI } from '@/services/api';

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { token, isAuthenticated } = useAppSelector((state) => state.auth);

  const handleTokenExpiry = useCallback(() => {
    dispatch(logoutUser());
  }, [dispatch]);

  const handleTokenRefresh = useCallback(() => {
    if (isAuthenticated && token) {
      dispatch(refreshToken());
    }
  }, [dispatch, isAuthenticated, token]);

  // Initialize token in API service on mount
  useEffect(() => {
    if (token) {
      clientPortalAPI.setToken(token);
    }
  }, [token]);

  // Check token expiry and set up periodic checks
  useEffect(() => {
    // Initial check
    dispatch(checkTokenExpiry());

    // Set up periodic token expiry checks
    const stopExpiryCheck = TokenManager.startTokenExpiryCheck(handleTokenExpiry, 300000); // Check every 5 minutes
    
    // Set up periodic token refresh checks
    const stopRefreshCheck = TokenManager.startTokenRefreshCheck(handleTokenRefresh, 300000); // Check every 5 minutes

    return () => {
      stopExpiryCheck();
      stopRefreshCheck();
    };
  }, [dispatch, handleTokenExpiry, handleTokenRefresh]);

  // Set up visibility change listener to check token when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated) {
        // Only check if token is actually expired, not just close to expiry
        if (TokenManager.isTokenExpired()) {
          dispatch(checkTokenExpiry());
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [dispatch, isAuthenticated]);

  return <>{children}</>;
};

export default AuthProvider;