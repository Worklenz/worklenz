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

const initialTheme = getInitialTheme();

// Apply CSS variables and initial theme
applyCssVariables();

// Initialize enhanced performance monitoring
initializePerformanceMonitoring();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

document.documentElement.classList.add(initialTheme);
document.documentElement.style.colorScheme = initialTheme;

root.render(
  <ConfigProvider theme={getThemeConfig(initialTheme)}>
    <Provider store={store}>
      <React.StrictMode>
        <App />
      </React.StrictMode>
    </Provider>
  </ConfigProvider>
);

reportWebVitals();
