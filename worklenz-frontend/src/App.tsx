// Core dependencies
import React, { Suspense, useEffect, memo, useMemo, useCallback } from 'react';
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
import { useRoutePreloader } from './utils/routePreloader';

// Types & Constants
import { Language } from './features/i18n/localesSlice';
import logger from './utils/errorLogger';
import { SuspenseFallback } from './components/suspense-fallback/suspense-fallback';

/**
 * Main App Component - Performance Optimized
 * 
 * Performance optimizations applied:
 * 1. React.memo() - Prevents unnecessary re-renders
 * 2. useMemo() - Memoizes expensive computations
 * 3. useCallback() - Memoizes event handlers
 * 4. Route preloading - Preloads critical routes
 * 5. Lazy loading - Components loaded on demand
 * 6. Suspense boundaries - Better loading states
 */
const App: React.FC = memo(() => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const language = useAppSelector(state => state.localesReducer.lng);

  // Memoize mixpanel initialization to prevent re-initialization
  const mixpanelToken = useMemo(() => import.meta.env.VITE_MIXPANEL_TOKEN as string, []);
  
  // Preload critical routes for better navigation performance
  useRoutePreloader([
    {
      path: '/worklenz/home',
      loader: () => import('./pages/home/home-page'),
      priority: 'high'
    },
    {
      path: '/worklenz/projects',
      loader: () => import('./pages/projects/project-list'),
      priority: 'high'
    },
    {
      path: '/worklenz/schedule',
      loader: () => import('./pages/schedule/schedule'),
      priority: 'medium'
    }
  ]);
  
  useEffect(() => {
    initMixpanel(mixpanelToken);
  }, [mixpanelToken]);

  // Memoize language change handler
  const handleLanguageChange = useCallback((lng: string) => {
    i18next.changeLanguage(lng, err => {
      if (err) return logger.error('Error changing language', err);
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    handleLanguageChange(language || Language.EN);
  }, [language, handleLanguageChange]);

  // Initialize CSRF token on app startup - memoize to prevent re-initialization
  useEffect(() => {
    let isMounted = true;
    
    initializeCsrfToken().catch(error => {
      if (isMounted) {
        logger.error('Failed to initialize CSRF token:', error);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Suspense fallback={<SuspenseFallback />}>
      <ThemeWrapper>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </ThemeWrapper>
    </Suspense>
  );
});

App.displayName = 'App';

export default App;
