import React, { useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import ConfigProvider from 'antd/es/config-provider';
import Flex from 'antd/es/flex';
import Layout from 'antd/es/layout';

import { useAppSelector } from '@/hooks/use-app-selector';
import { colors } from '@/styles/colors';

interface AuthLayoutProps {}

const AuthLayout: React.FC<AuthLayoutProps> = React.memo(() => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Memoize theme configuration to prevent recreation
  const themeConfig = useMemo(() => ({
    components: {
      Layout: {
        colorBgLayout: themeMode === 'dark' ? colors.darkGray : '#fafafa',
      },
    },
  }), [themeMode]);

  // Memoize styles to prevent recreation on every render
  const layoutStyles = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    minHeight: '100vh',
    width: '100%',
  }), []);

  const flexStyles = useMemo(() => ({
    marginBlockStart: 96,
    marginBlockEnd: 48,
    marginInline: 24,
    width: '90%',
    maxWidth: 440,
  }), []);

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout style={layoutStyles}>
        <Flex style={flexStyles}>
          <Outlet />
        </Flex>
      </Layout>
    </ConfigProvider>
  );
});

AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;
