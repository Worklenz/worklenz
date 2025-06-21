import React, { memo } from 'react';
import { colors } from '@/styles/colors';
import { getInitialTheme } from '@/utils/get-initial-theme';
import { ConfigProvider, theme, Layout, Spin } from 'antd';

// Memoized loading component with theme awareness
export const SuspenseFallback = memo(() => {
  const currentTheme = getInitialTheme();
  const isDark = currentTheme === 'dark';

  // Memoize theme configuration to prevent unnecessary re-renders
  const themeConfig = React.useMemo(() => ({
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    components: {
      Layout: {
        colorBgLayout: isDark ? colors.darkGray : '#fafafa',
      },
      Spin: {
        colorPrimary: isDark ? '#fff' : '#1890ff',
      },
    },
  }), [isDark]);

  // Memoize layout style to prevent object recreation
  const layoutStyle = React.useMemo(() => ({
    position: 'fixed' as const,
    width: '100vw',
    height: '100vh',
    background: 'transparent',
    transition: 'none',
  }), []);

  // Memoize spin style to prevent object recreation
  const spinStyle = React.useMemo(() => ({
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  }), []);

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout className="app-loading-container" style={layoutStyle}>
        <Spin size="large" style={spinStyle} />
      </Layout>
    </ConfigProvider>
  );
});

SuspenseFallback.displayName = 'SuspenseFallback';
