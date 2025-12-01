import React from 'react';
import {
  Layout,
  Avatar,
  Dropdown,
  theme,
  Select,
  Switch,
  UserOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  TranslationOutlined,
} from '@/shared/antd-imports';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { logout, setUser } from '@/store/slices/authSlice';
import { toggleSidebar, setTheme, setLanguage } from '@/store/slices/uiSlice';
import { useGetProfileQuery, useGetNotificationsQuery } from '@/store/api';
import type { RootState } from '@/store';
import { useTranslation } from 'react-i18next';
import ClientPortalSidebar from './ClientPortalSidebar';
import { useResponsive } from '@/hooks/useResponsive';
import NotificationCenter from '../NotificationCenter';
import OrganizationSwitcher from '../OrganizationSwitcher';

const { Header, Sider, Content } = Layout;

const ClientLayout: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const { t, i18n } = useTranslation();
  const { isMobile } = useResponsive();
  
  const { isAuthenticated } = useAppSelector((state: RootState) => state.auth);

  // Redirect unauthenticated users to login
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  
  const sidebarCollapsed = useAppSelector((state: RootState) => state.ui.sidebarCollapsed);
  const currentTheme = useAppSelector((state: RootState) => state.ui.theme);
  const currentLanguage = useAppSelector((state: RootState) => state.ui.language);
  const user = useAppSelector((state: RootState) => state.auth.user);

  // RTK Query hooks
  const { data: profileData } = useGetProfileQuery();
  const { data: notificationsData } = useGetNotificationsQuery({ limit: 10 });

  // Update user data when profile is loaded
  React.useEffect(() => {
    if (profileData?.body && !user) {
      dispatch(setUser(profileData.body));
    }
  }, [profileData, user, dispatch]);

  // Update notification count
  React.useEffect(() => {
    // if (notificationsData?.body) {
    //   const unreadCount = notificationsData.body.filter(n => !n.read).length;
    //   // dispatch(setUnreadNotifications(unreadCount));
    // }
  }, [notificationsData]);

  // Sync i18n language with Redux state on mount
  React.useEffect(() => {
    if (currentLanguage && i18n.language !== currentLanguage) {
      i18n.changeLanguage(currentLanguage);
    }
  }, [currentLanguage, i18n]);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/auth/login');
  };

  const handleThemeToggle = () => {
    dispatch(setTheme(currentTheme === 'light' ? 'dark' : 'light'));
  };

  const handleLanguageChange = async (language: string) => {
    try {
      await i18n.changeLanguage(language);
      dispatch(setLanguage(language));
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'pt', label: 'Português' },
    { value: 'de', label: 'Deutsch' },
    { value: 'al', label: 'Shqip' },
    { value: 'zh', label: '中文' },
  ];


  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: '600',
            color: token.colorText,
            marginBottom: '4px',
          }}>
            {user?.name || t('user.defaultName', 'Client User')}
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: token.colorTextSecondary,
          }}>
            {user?.email || 'user@example.com'}
          </div>
        </div>
      ),
      disabled: true,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'settings',
      icon: <UserOutlined />,
      label: t('user.profile', 'Profile Settings'),
      onClick: () => navigate('/profile'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('user.logout', 'Logout'),
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={sidebarCollapsed}
          width={280}
          collapsedWidth={80}
          style={{
            borderRight: `1px solid ${token.colorBorder}`,
            background: token.colorBgContainer,
            position: 'fixed',
            height: '100vh',
            left: 0,
            top: 0,
            zIndex: 1001,
          }}
        >
          <ClientPortalSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => dispatch(toggleSidebar())}
          />
        </Sider>
      )}
      
      {isMobile && (
        <ClientPortalSidebar
          collapsed={false}
          onToggleCollapse={() => dispatch(toggleSidebar())}
        />
      )}
      
      <Layout
        style={{
          marginLeft: isMobile ? 0 : sidebarCollapsed ? 80 : 280,
          transition: 'margin-left 0.2s ease',
        }}
      >
        <Header
          style={{
            padding: 0,
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorder}`,
            height: 64,
            zIndex: 1000,
            position: 'sticky',
            top: 0,
            boxShadow: currentTheme === 'dark' ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{
            width: '100%',
            height: '100%',
            paddingInline: isMobile ? 24 : 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}>
            {/* Actions Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              {/* Theme & Language Controls */}
              {!isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch
                    checked={currentTheme === 'dark'}
                    onChange={handleThemeToggle}
                    checkedChildren={<MoonOutlined />}
                    unCheckedChildren={<SunOutlined />}
                  />
                  <Select
                    value={currentLanguage}
                    onChange={handleLanguageChange}
                    style={{ width: 120 }}
                    size="small"
                    options={languageOptions}
                    suffixIcon={<TranslationOutlined />}
                    variant="borderless"
                  />
                </div>
              )}
              
              {!isMobile && <OrganizationSwitcher />}
              <NotificationCenter />
              
              <Dropdown
                menu={{ items: userMenuItems }}
                placement="bottomRight"
                trigger={['click']}
              >
                <div style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center',
                  height: '100%',
                }}
                >
                  <Avatar 
                    icon={<UserOutlined />} 
                    style={{ 
                      backgroundColor: token.colorPrimary,
                      width: 40,
                      height: 40,
                    }}
                  />
                </div>
              </Dropdown>
            </div>
          </div>
        </Header>
        
        <Content
          style={{
            margin: isMobile ? '16px' : '24px',
            padding: isMobile ? '20px' : '32px',
            background: token.colorBgContainer,
            borderRadius: isMobile ? '12px' : '16px',
            minHeight: 280,
            overflow: 'auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ 
            maxWidth: '1200px', 
            margin: '0 auto',
            minHeight: 'calc(100vh - 200px)',
            width: '100%',
          }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ClientLayout; 