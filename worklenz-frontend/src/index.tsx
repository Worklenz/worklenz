import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/performance-optimizations.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import './i18n';
import { Provider } from 'react-redux';
import { store } from './app/store';
import { applyCssVariables } from './styles/colors';
import { ConfigProvider } from '@/shared/antd-imports';
import { getInitialTheme } from './utils/get-initial-theme';
import { initializePerformanceMonitoring } from './utils/enhanced-performance-monitoring';
import { getThemeConfig } from './config/theme.config';
import { initSentry } from './config/sentry';
import SentryErrorBoundary from '@/components/common/SentryErrorBoundary';

// Handle chunk load failures (CSS/JS preload errors after deployment)
const RELOAD_KEY = 'app_reload_attempted';
const RELOAD_TIMEOUT = 10000; // 10 seconds

window.addEventListener(
  'error',
  event => {
    const isChunkLoadError =
      event.message?.includes('Failed to fetch dynamically imported module') ||
      event.message?.includes('Unable to preload CSS') ||
      event.message?.includes('Loading chunk') ||
      event.message?.includes('Loading CSS chunk');

    if (isChunkLoadError) {
      const lastReload = sessionStorage.getItem(RELOAD_KEY);
      const now = Date.now();

      // Prevent reload loop - only reload once per session within timeout
      if (!lastReload || now - parseInt(lastReload) > RELOAD_TIMEOUT) {
        console.warn('Chunk load error detected, reloading page...', event.message);
        sessionStorage.setItem(RELOAD_KEY, now.toString());
        window.location.reload();
      } else {
        console.error('Chunk load error persists after reload:', event.message);
      }
    }
  },
  true
);

const initialTheme = getInitialTheme();

// Apply CSS variables and initial theme
applyCssVariables();

// Initialize Sentry for error tracking
initSentry();

// Initialize enhanced performance monitoring
initializePerformanceMonitoring();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

document.documentElement.classList.add(initialTheme);
document.documentElement.style.colorScheme = initialTheme;

root.render(
  <SentryErrorBoundary>
    <ConfigProvider theme={getThemeConfig(initialTheme as 'light' | 'dark')}>
      <Provider store={store}>
        <React.StrictMode>
          <App />
        </React.StrictMode>
      </Provider>
    </ConfigProvider>
  </SentryErrorBoundary>
);

reportWebVitals();
