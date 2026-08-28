import { configureStore } from '@reduxjs/toolkit';
import { clientPortalApi } from './api';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import { authMiddleware } from '@/middleware/authMiddleware';

export const store = configureStore({
  reducer: {
    [clientPortalApi.reducerPath]: clientPortalApi.reducer,
    auth: authReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }).concat(clientPortalApi.middleware, authMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 