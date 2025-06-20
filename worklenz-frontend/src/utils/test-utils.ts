import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/auth-slice';
import userReducer from '@/features/user/user-slice';
export const mockStore = (preloadedState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      user: userReducer,
    },
    preloadedState,
  });
};
