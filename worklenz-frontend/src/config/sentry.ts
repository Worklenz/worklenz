import * as Sentry from '@sentry/react';
import React from 'react';
import { store } from '@/app/store';

// Get environment variables
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.VITE_APP_ENV;
const RELEASE = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Initialize Sentry configuration
export const initSentry = () => {
  // Only initialize Sentry in production environment
  if (ENVIRONMENT !== 'production') {
    console.log('[Sentry] Skipping initialization in non-production environment:', ENVIRONMENT);
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE,

    // Setting this option to true will send default PII data to Sentry
    sendDefaultPii: true,

    // Performance monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Capture 10% of sessions for replay
        sessionSampleRate: 0.1,
        // Capture 100% of sessions with an error
        errorSampleRate: 1.0,
      }),
    ],

    // Set traces sample rate to 1.0 for performance monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Before sending any event, enrich with additional context
    beforeSend: (event, hint) => {
      // Add Redux state context
      try {
        const state = store.getState();
        event.contexts = {
          ...event.contexts,
          redux: {
            user: state.auth?.user,
            userId: state.userReducer?.id,
          },
        };
      } catch (error) {
        console.warn('Failed to add Redux context to Sentry event:', error);
      }

      // Add user agent and browser info
      if (typeof navigator !== 'undefined') {
        event.contexts = {
          ...event.contexts,
          browser: {
            name: navigator.userAgent.split(' ').pop()?.split('/')[0],
            version: navigator.userAgent.split(' ').pop()?.split('/')[1],
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
          },
        };
      }

      return event;
    },

    // Filter out certain errors
    ignoreErrors: [
      // Network errors that are expected
      'Network Error',
      'Failed to fetch',
      // ResizeObserver errors (common in modern browsers)
      'ResizeObserver loop limit exceeded',
      // Chunk loading errors (handled by our error boundary)
      'Loading chunk',
      'ChunkLoadError',
    ],

    // Deny certain URLs from being sent
    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      // Firefox extensions
      /^moz-extension:\/\//i,
      // Local files
      /^file:\/\//i,
    ],

    // Debug mode disabled in production
    debug: false,
  });
};

// Helper functions for manual error reporting
export const captureException = (error: Error, context?: Record<string, any>) => {
  Sentry.captureException(error, {
    contexts: { custom: context },
  });
};

export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
) => {
  Sentry.captureMessage(message, {
    level,
    contexts: { custom: context },
  });
};

export const setUser = (user: Sentry.User | null) => {
  Sentry.setUser(user);
};

export const setTag = (key: string, value: string) => {
  Sentry.setTag(key, value);
};

export const addBreadcrumb = (breadcrumb: Sentry.Breadcrumb) => {
  Sentry.addBreadcrumb(breadcrumb);
};

// Performance monitoring helpers
export const startSpan = (
  name: string,
  op: string = 'navigation',
  fn: () => void | Promise<void>
) => {
  return Sentry.startSpan(
    {
      name,
      op,
    },
    fn
  );
};

export const measurePerformance = (name: string, fn: () => void | Promise<void>) => {
  return startSpan(name, 'custom', fn);
};

export default Sentry;
