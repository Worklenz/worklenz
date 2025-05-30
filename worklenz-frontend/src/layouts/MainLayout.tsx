import { Col, ConfigProvider, Layout } from 'antd';
import { Outlet, useNavigate } from 'react-router-dom';
import Navbar from '../features/navbar/navbar';
import { useAppSelector } from '../hooks/useAppSelector';
import { useMediaQuery } from 'react-responsive';
import { colors } from '../styles/colors';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { useEffect, useState } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';

const MainLayout = () => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDesktop = useMediaQuery({ query: '(min-width: 1024px)' });
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentSession = useAuthService().getCurrentSession();
  
  // State for alert visibility
  const [showAlert, setShowAlert] = useState(false);

  const verifyAuthStatus = async () => {
    const session = await dispatch(verifyAuthentication()).unwrap();
    if (!session.user.setup_completed) {
      navigate('/worklenz/setup');
    }
  };

  useEffect(() => {
    void verifyAuthStatus();
  }, [dispatch, navigate]);

  const alertHeight = showAlert ? 64 : 0; // Fixed height for license alert

  const headerStyles = {
    zIndex: 999,
    position: 'fixed',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
    borderBottom: themeMode === 'dark' ? '1px solid #303030' : 'none',
    top: alertHeight, // Push navbar down when alert is shown
  } as const;

  const contentStyles = {
    paddingInline: isDesktop ? 0 : 24,
    overflowX: 'hidden',
    marginTop: alertHeight + 64, // Adjust top margin based on alert height + navbar height
  } as const;

  return (
    <ConfigProvider
      theme={{
        components: {
          Layout: {
            colorBgLayout: themeMode === 'dark' ? colors.darkGray : colors.white,
            headerBg: themeMode === 'dark' ? colors.darkGray : colors.white,
          },
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Header
          className={`shadow-md ${themeMode === 'dark' ? '' : 'shadow-[#18181811]'}`}
          style={headerStyles}
        >
          <Navbar />
        </Layout.Header>

        <Layout.Content>
          <Col
            xxl={{ span: 18, offset: 3, flex: '100%' }}
            style={contentStyles}
          >
            <Outlet />
          </Col>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
};

export default MainLayout;
