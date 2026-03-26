import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ConfigProvider, Layout, Typography, Button, Flex, Spin } from '@/shared/antd-imports';
import { LogoutOutlined } from '@ant-design/icons';
import { usePortal } from './portal-context';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';

const { Header, Content, Footer } = Layout;

const PPM_BLUE = '#0061FF';

const PortalLayout: React.FC = () => {
  const { user, branding, loading, logout } = usePortal();
  const navigate = useNavigate();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';

  const primaryColor = branding?.branding_config?.primary_color || PPM_BLUE;
  const clientName = branding?.name || 'Client Portal';
  const logoUrl = branding?.branding_config?.logo_url;

  const handleLogout = async () => {
    await logout();
    navigate('/portal/login');
  };

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <ConfigProvider
      theme={{
        components: {
          Layout: {
            colorBgLayout: isDark ? colors.darkGray : colors.white,
            headerBg: isDark ? colors.darkGray : colors.white,
          },
        },
      }}
    >
      <Layout className="min-h-screen">
        {user && (
          <Header
            className={`sticky top-0 z-[999] flex items-center p-0 shadow-md ${
              isDark ? 'border-b border-[#303030]' : 'shadow-[#18181811]'
            }`}
            style={{
              padding: '0 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 56,
              lineHeight: '56px',
            }}
          >
            <Flex align="center" gap={12}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={clientName}
                  style={{ height: 28, objectFit: 'contain' }}
                />
              ) : (
                <svg width={16} height={24} viewBox="0 0 13 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9.83268 0H0V19.648L4.47421 12.5322H9.83268C11.4847 12.5322 12.8226 11.1943 12.8226 9.54237V2.98983C12.8226 1.33786 11.4847 0 9.83268 0Z" fill={PPM_BLUE} />
                </svg>
              )}
              <Typography.Text strong style={{ fontSize: 15 }}>
                {clientName}
              </Typography.Text>
            </Flex>

            <Flex align="center" gap={16}>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {user.email}
              </Typography.Text>
              <Button
                type="text"
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                size="small"
              >
                Sign out
              </Button>
            </Flex>
          </Header>
        )}

        <Content className="px-4 sm:px-8 lg:px-12 xl:px-16 max-w-[1120px] mx-auto w-full" style={{ paddingTop: 32, paddingBottom: 32 }}>
          <Outlet />
        </Content>

        <Footer style={{ textAlign: 'center', padding: '12px 24px', fontSize: 12, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
          Powered by{' '}
          <a
            href="https://github.com/Worklenz/worklenz"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
          >
            Worklenz
          </a>
        </Footer>
      </Layout>
    </ConfigProvider>
  );
};

export default PortalLayout;
