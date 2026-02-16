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
