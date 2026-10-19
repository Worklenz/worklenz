import React, { useEffect, useCallback } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { refreshToken, logoutUser, initializeAuth, clearAuth } from '@/store/slices/authSlice';
import { TokenManager } from '@/utils/tokenManager';
import {
  ACCESS_REMOVED_EVENT,
  ACCESS_REMOVED_PATH,
  accessRemovedPath,
  type AccessRemovedEventDetail,
} from '@/utils/accessRemoved';
import { clientPortalAPI } from '@/services/api';

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

  // The server said this client's access was removed (401, 403 ACCESS_REVOKED, deactivated).
  // The token is already cleared by whoever raised the event. The session is dropped locally: asking the
  // server to log out would only be refused again, and a refused request must not raise this event twice.
  useEffect(() => {
    const handleAccessRemoved = (event: Event) => {
      const reason = (event as CustomEvent<AccessRemovedEventDetail>).detail?.reason ?? null;
      clientPortalAPI.clearToken();
      dispatch(clearAuth());
      if (window.location.pathname !== ACCESS_REMOVED_PATH) {
        window.location.assign(accessRemovedPath(reason));
      }
    };

    window.addEventListener(ACCESS_REMOVED_EVENT, handleAccessRemoved);
    return () => window.removeEventListener(ACCESS_REMOVED_EVENT, handleAccessRemoved);
  }, [dispatch]);

  return <>{children}</>;
};

export default AuthProvider;