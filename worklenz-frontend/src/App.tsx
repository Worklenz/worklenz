// Core dependencies
import React, { Suspense, useEffect, memo, useMemo, useCallback } from 'react';
import { RouterProvider } from 'react-router-dom';
import i18next from 'i18next';

// Components
import ThemeWrapper from './features/theme/ThemeWrapper';
import ModuleErrorBoundary from './components/ModuleErrorBoundary';
import { UpdateNotificationProvider } from './components/update-notification';

// Routes
import router from './app/routes';

// Hooks & Utils
import { useAppSelector } from './hooks/useAppSelector';
import { initMixpanel } from './utils/mixpanelInit';
import { initializeCsrfToken } from './api/api-client';
import CacheCleanup from './utils/cache-cleanup';

// Types & Constants
import { Language } from './features/i18n/localesSlice';
import logger from './utils/errorLogger';
import { SuspenseFallback } from './components/suspense-fallback/suspense-fallback';

// Performance optimizations
import {
  CSSPerformanceMonitor,
  LayoutStabilizer,
  CriticalCSSManager,
} from './utils/css-optimizations';

// Service Worker
import { registerSW } from './utils/serviceWorkerRegistration';

/**
 * Main App Component - Performance Optimized
 *
 * Performance optimizations applied:
 * 1. React.memo() - Prevents unnecessary re-renders
 * 2. useMemo() - Memoizes expensive computations
 * 3. useCallback() - Memoizes event handlers
 * 4. Lazy loading - All route components loaded on demand
 * 5. Suspense boundaries - Better loading states
 * 6. Optimized guard components with memoization
 * 7. Deferred initialization - Non-critical operations moved to background
 */
const App: React.FC = memo(() => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const language = useAppSelector(state => state.localesReducer.lng);

  // Memoize mixpanel initialization to prevent re-initialization
  const mixpanelToken = useMemo(() => import.meta.env.VITE_MIXPANEL_TOKEN as string, []);

  // Defer mixpanel initialization to not block initial render
  useEffect(() => {
    const initializeMixpanel = () => {
      try {
        initMixpanel(mixpanelToken);
      } catch (error) {
        logger.error('Failed to initialize Mixpanel:', error);
      }
    };

    // Use requestIdleCallback to defer mixpanel initialization
    if ('requestIdleCallback' in window) {
      requestIdleCallback(initializeMixpanel, { timeout: 2000 });
    } else {
      setTimeout(initializeMixpanel, 1000);
    }
  }, [mixpanelToken]);

  // Memoize language change handler
  const handleLanguageChange = useCallback((lng: string) => {
    i18next.changeLanguage(lng, err => {
      if (err) return logger.error('Error changing language', err);
    });
  }, []);

  // Apply theme immediately to prevent flash
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  // Handle language changes
  useEffect(() => {
    handleLanguageChange(language || Language.EN);
  }, [language, handleLanguageChange]);

  // Initialize critical app functionality
  useEffect(() => {
    let isMounted = true;

    const initializeCriticalApp = async () => {
      try {
        // Initialize CSRF token immediately as it's needed for API calls
        await initializeCsrfToken();

        // Start CSS performance monitoring
        CSSPerformanceMonitor.monitorLayoutShifts();
        CSSPerformanceMonitor.monitorRenderBlocking();

        // Preload critical fonts to prevent layout shifts
        LayoutStabilizer.preloadFonts([
          { family: 'Inter', weight: '400' },
          { family: 'Inter', weight: '500' },
          { family: 'Inter', weight: '600' },
        ]);
      } catch (error) {
        if (isMounted) {
          logger.error('Failed to initialize critical app functionality:', error);
        }
      }
    };

    // Initialize critical functionality immediately
    initializeCriticalApp();

    return () => {
      isMounted = false;
    };
  }, []);

  // Global error handlers for module loading issues
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;

      // Check if this is a module loading error
      if (
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.name === 'ChunkLoadError'
      ) {
        console.error('Unhandled module loading error:', error);
        event.preventDefault(); // Prevent default browser error handling

        // Clear caches and reload
        CacheCleanup.clearAllCaches()
          .then(() => CacheCleanup.forceReload('/auth/login'))
          .catch(() => window.location.reload());
      }
    };

    const handleError = (event: ErrorEvent) => {
      const error = event.error;

      // Check if this is a module loading error
      if (
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.name === 'ChunkLoadError'
      ) {
        console.error('Global module loading error:', error);
        event.preventDefault(); // Prevent default browser error handling

        // Clear caches and reload
        CacheCleanup.clearAllCaches()
          .then(() => CacheCleanup.forceReload('/auth/login'))
          .catch(() => window.location.reload());
      }
    };

    // Add global error handlers
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    registerSW({
      onSuccess: registration => {
        console.log('Service Worker registered successfully', registration);
      },
      onUpdate: registration => {
        console.log(
          'New content is available and will be used when all tabs for this page are closed.'
        );
        // You could show a toast notification here for user to refresh
      },
      onOfflineReady: () => {
        console.log('This web app has been cached for offline use.');
      },
      onError: error => {
        logger.error('Service Worker registration failed:', error);
      },
    });
  }, []);

  // Defer non-critical initialization
  useEffect(() => {
    const initializeNonCriticalApp = () => {
      // Any non-critical initialization can go here
      // For example: analytics, feature flags, etc.
    };

    // Defer non-critical initialization to not block initial render
    if ('requestIdleCallback' in window) {
      requestIdleCallback(initializeNonCriticalApp, { timeout: 3000 });
    } else {
      setTimeout(initializeNonCriticalApp, 1500);
    }
  }, []);

  return (
    <Suspense fallback={<SuspenseFallback />}>
      <ThemeWrapper>
        <UpdateNotificationProvider>
          <ModuleErrorBoundary>
            <RouterProvider
              router={router}
              future={{
                v7_startTransition: true,
              }}
            />
          </ModuleErrorBoundary>
        </UpdateNotificationProvider>
      </ThemeWrapper>
    </Suspense>
  );
});

App.displayName = 'App';

export default App;
