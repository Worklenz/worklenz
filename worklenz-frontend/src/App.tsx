// Core dependencies
import React, { Suspense, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import i18next from 'i18next';

// Components
import ThemeWrapper from './features/theme/ThemeWrapper';
import PreferenceSelector from './components/PreferenceSelector';

// Routes
import router from './app/routes';

// Hooks & Utils
import { useAppSelector } from './hooks/useAppSelector';
import { initMixpanel } from './utils/mixpanelInit';
import { initializeCsrfToken } from './api/api-client';

// Types & Constants
import { Language } from './features/i18n/localesSlice';
import logger from './utils/errorLogger';
import { SuspenseFallback } from './components/suspense-fallback/suspense-fallback';

const App: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const language = useAppSelector(state => state.localesReducer.lng);

  initMixpanel(import.meta.env.VITE_MIXPANEL_TOKEN as string);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    i18next.changeLanguage(language || Language.EN, err => {
      if (err) return logger.error('Error changing language', err);
    });
  }, [language]);

  // Initialize CSRF token on app startup
  useEffect(() => {
    initializeCsrfToken().catch(error => {
      logger.error('Failed to initialize CSRF token:', error);
    });
  }, []);

  return (
    <Suspense fallback={<SuspenseFallback />}>
      <ThemeWrapper>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </ThemeWrapper>
    </Suspense>
  );
};

export default App;
