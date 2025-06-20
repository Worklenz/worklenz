import React, { useEffect, useMemo, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Col from 'antd/es/col';
import ConfigProvider from 'antd/es/config-provider';
import Layout from 'antd/es/layout';
import { useMediaQuery } from 'react-responsive';

import Navbar from '../features/navbar/navbar';
import { useAppSelector } from '../@/hooks/use-app-selector';
import { useAppDispatch } from '@/hooks/use-app-dispatch';
import { colors } from '../styles/colors';
import { verifyAuthentication } from '@/features/auth/auth-slice';
import HubSpot from '@/components/HubSpot';

interface MainLayoutProps {}

const MainLayout: React.FC<MainLayoutProps> = React.memo(() => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDesktop = useMediaQuery({ query: '(min-width: 1024px)' });
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Memoize the verification function to prevent recreating on every render
  const verifyAuthStatus = useCallback(async () => {
    const session = await dispatch(verifyAuthentication()).unwrap();
    if (!session.user.setup_completed) {
      navigate('/worklenz/setup');
    }
  }, [dispatch, navigate]);

  useEffect(() => {
    void verifyAuthStatus();
  }, [verifyAuthStatus]);

  // Memoize styles to prevent recreation on every render
  const headerStyles = useMemo(() => ({
    zIndex: 999,
    position: 'fixed' as const,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
    borderBottom: themeMode === 'dark' ? '1px solid #303030' : 'none',
  }), [themeMode]);

  const contentStyles = useMemo(() => ({
    paddingInline: isDesktop ? 64 : 24,
    overflowX: 'hidden' as const,
  }), [isDesktop]);

  const layoutStyles = useMemo(() => ({
    minHeight: '100vh',
  }), []);

  const colSpanConfig = useMemo(() => ({
    xxl: { span: 18, offset: 3, flex: '100%' },
  }), []);

  // Memoize theme configuration
  const themeConfig = useMemo(() => ({
    components: {
      Layout: {
        colorBgLayout: themeMode === 'dark' ? colors.darkGray : colors.white,
        headerBg: themeMode === 'dark' ? colors.darkGray : colors.white,
      },
    },
  }), [themeMode]);

  const shadowClassName = useMemo(() => 
    `shadow-md ${themeMode === 'dark' ? '' : 'shadow-[#18181811]'}`,
    [themeMode]
  );

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout style={layoutStyles}>
        <Layout.Header
          className={shadowClassName}
          style={headerStyles}
        >
          <Navbar />
        </Layout.Header>

        <Layout.Content>
          <Col {...colSpanConfig} style={contentStyles}>
            <Outlet />
          </Col>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
