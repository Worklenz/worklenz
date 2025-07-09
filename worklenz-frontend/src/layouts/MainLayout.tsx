import { Col, ConfigProvider, Layout } from 'antd';
import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, memo, useMemo, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive';

import Navbar from '../features/navbar/navbar';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { colors } from '../styles/colors';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { useRenderPerformance } from '@/utils/performance';
import HubSpot from '@/components/HubSpot';

const MainLayout = memo(() => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDesktop = useMediaQuery({ query: '(min-width: 1024px)' });
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Performance monitoring in development
  useRenderPerformance('MainLayout');

  // Memoize auth verification function
  const verifyAuthStatus = useCallback(async () => {
    const session = await dispatch(verifyAuthentication()).unwrap();
    if (!session.user.setup_completed) {
      navigate('/worklenz/setup');
    }
  }, [dispatch, navigate]);

  useEffect(() => {
    void verifyAuthStatus();
  }, [verifyAuthStatus]);

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
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Header className={headerClassName} style={headerStyles}>
          <Navbar />
        </Layout.Header>

        <Layout.Content>
          <Col xxl={{ span: 18, offset: 3, flex: '100%' }} style={contentStyles}>
            <Outlet />
          </Col>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
