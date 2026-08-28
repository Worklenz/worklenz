import { Middleware } from '@reduxjs/toolkit';
import { logoutUser, refreshToken } from '@/store/slices/authSlice';
import { TokenManager } from '@/utils/tokenManager';

export const authMiddleware: Middleware = (store) => (next) => (action: unknown) => {
  const result = next(action);
  const state = store.getState();
  
  // Check if we need to handle token expiry after any action
  if ((action as { type?: string }).type && ((action as { type: string }).type.endsWith('/fulfilled') || (action as { type: string }).type.endsWith('/rejected'))) {
    const { auth } = state;
    
    if (auth.isAuthenticated && auth.token) {
      // Check if token is expired
      if (TokenManager.isTokenExpired()) {
        store.dispatch(logoutUser() as never);
        return result;
      }
      
      // Check if token should be refreshed
      if (TokenManager.shouldRefreshToken()) {
        store.dispatch(refreshToken() as never);
      }
    }
  }
  
  return result;
};