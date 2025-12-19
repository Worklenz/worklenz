import React, { useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ConfigProvider } from '@/shared/antd-imports';
import { App as AntdApp } from 'antd';

import { store } from '@/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { socketManager } from '@/utils/socket';
import { getThemeConfig } from '@/config/theme.config';
import { AppRoutes } from '@/config/routes.config';
import AuthProvider from '@/components/AuthProvider';

const AppContent: React.FC = () => {
  const { theme: currentTheme } = useAppSelector((state) => state.ui);

  useEffect(() => {
    return () => {
      socketManager.disconnect();
    };
  }, []);

  return (
    <ConfigProvider theme={getThemeConfig(currentTheme)}>
      <AntdApp>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </AntdApp>
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

export default App;
