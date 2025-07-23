import { Col, ConfigProvider, Layout } from '@/shared/antd-imports';
import { Outlet } from 'react-router-dom';
import { memo, useMemo, useEffect, useRef } from 'react';
import { useMediaQuery } from 'react-responsive';

import Navbar from '../features/navbar/navbar';
import { useAppSelector } from '../hooks/useAppSelector';
import { colors } from '../styles/colors';

import { useRenderPerformance } from '@/utils/performance';
import { DynamicCSSLoader, LayoutStabilizer } from '@/utils/css-optimizations';

const MainLayout = memo(() => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDesktop = useMediaQuery({ query: '(min-width: 1024px)' });
  const layoutRef = useRef<HTMLDivElement>(null);

  // Performance monitoring in development
  useRenderPerformance('MainLayout');

  // Apply layout optimizations
  useEffect(() => {
    if (layoutRef.current) {
      // Prevent layout shifts in main content area
      LayoutStabilizer.applyContainment(layoutRef.current, 'layout');
      
      // Load non-critical CSS dynamically
      DynamicCSSLoader.loadCSS('/styles/non-critical.css', {
        priority: 'low',
        media: 'all'
      });
    }
  }, []);

  

  // Memoize styles to prevent object recreation on every render
  const headerStyles = useMemo(
    () => ({
      zIndex: 999,
      position: 'fixed' as const,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      padding: 0,
      borderBottom: themeMode === 'dark' ? '1px solid #303030' : 'none',
    }),
    [themeMode]
  );

  const contentStyles = useMemo(
    () => ({
      paddingInline: isDesktop ? 64 : 24,
      overflowX: 'hidden' as const,
    }),
    [isDesktop]
  );

  // Memoize theme configuration
  const themeConfig = useMemo(
    () => ({
      components: {
        Layout: {
          colorBgLayout: themeMode === 'dark' ? colors.darkGray : colors.white,
          headerBg: themeMode === 'dark' ? colors.darkGray : colors.white,
        },
      },
    }),
    [themeMode]
  );

  // Memoize header className
  const headerClassName = useMemo(
    () => `shadow-md ${themeMode === 'dark' ? '' : 'shadow-[#18181811]'}`,
    [themeMode]
  );

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout ref={layoutRef} style={{ minHeight: '100vh' }} className="prevent-layout-shift">
        <Layout.Header className={`${headerClassName} gpu-accelerated`} style={headerStyles}>
          <Navbar />
        </Layout.Header>

        <Layout.Content className="layout-contained">
          <Col xxl={{ span: 18, offset: 3, flex: '100%' }} style={contentStyles} className="task-content-container">
            <Outlet />
          </Col>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
