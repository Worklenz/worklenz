import React from 'react';
import {
  Layout,
  Avatar,
  Dropdown,
  Badge,
  Button,
  theme,
  Select,
  Switch,
  Typography,
  UserOutlined,
  BellOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  TranslationOutlined,
} from '@/shared/antd-imports';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { logout, setUser } from '@/store/slices/authSlice';
import { toggleSidebar, setTheme, toggleNotificationPanel, setLanguage } from '@/store/slices/uiSlice';
import { useGetProfileQuery, useGetNotificationsQuery } from '@/store/api';
import type { RootState } from '@/store';
import { useTranslation } from 'react-i18next';
import ClientPortalSidebar from './ClientPortalSidebar';
import { useResponsive } from '@/hooks/useResponsive';
import { useGetSettingsQuery } from '@/store/api';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

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
  const notifications = useAppSelector((state: RootState) => state.ui.notifications);
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

  const handleLogout = () => {
    dispatch(logout());
    navigate('/auth/login');
  };

  const handleThemeToggle = () => {
    dispatch(setTheme(currentTheme === 'light' ? 'dark' : 'light'));
  };

  const handleLanguageChange = (language: string) => {
    dispatch(setLanguage(language));
    i18n.changeLanguage(language);
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
      label: t('user.profile', 'Profile'),
      onClick: () => navigate('/profile'),
    },
    {
      key: 'theme',
      icon: currentTheme === 'light' ? <MoonOutlined /> : <SunOutlined />,
      label: t(`theme.${currentTheme === 'light' ? 'dark' : 'light'}`, currentTheme === 'light' ? 'Dark Mode' : 'Light Mode'),
      onClick: handleThemeToggle,
    },
    {
      key: 'language',
      icon: <TranslationOutlined />,
      label: (
        <Select
          value={currentLanguage}
          onChange={handleLanguageChange}
          style={{ width: 120 }}
          size="small"
          bordered={false}
          options={languageOptions}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('user.logout', 'Logout'),
      onClick: handleLogout,
    },
  ];

  const notificationMenuItems = [
    {
      key: 'notifications',
      label: (
        <div style={{ padding: '8px 0', maxWidth: '280px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{t('notifications.title', 'Notifications')}</div>
          {Array.isArray(notificationsData?.body) && notificationsData.body.length > 0 ? (
            notificationsData.body.slice(0, 3).map((notification) => (
              <div key={notification.id} style={{ 
                fontSize: '12px', 
                marginBottom: '6px',
                padding: '4px 0',
                borderBottom: '1px solid #f0f0f0'
              }}>
                <Text ellipsis={{ tooltip: notification.title }}>{notification.title}</Text>
              </div>
            ))
          ) : (
            <div style={{ fontSize: '12px', color: token.colorTextSecondary }}>
              {t('notifications.empty', 'No new notifications')}
            </div>
          )}
        </div>
      ),
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
            padding: isMobile ? '0 16px' : '0 24px',
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            height: 72,
            zIndex: 1000,
            position: 'sticky',
            top: 0,
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? 8 : 16,
            background: token.colorBgLayout,
            padding: isMobile ? '6px 12px' : '8px 16px',
            borderRadius: '12px',
            border: `1px solid ${token.colorBorder}`,
          }}>
            <Switch
              checked={currentTheme === 'dark'}
              onChange={handleThemeToggle}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
              size="small"
              style={{
                backgroundColor: currentTheme === 'dark' ? '#1890ff' : '#d9d9d9',
                borderColor: currentTheme === 'dark' ? '#1890ff' : '#d9d9d9',
              }}
            />
            {!isMobile && (
              <Select
                value={currentLanguage}
                onChange={handleLanguageChange}
                style={{ width: 110 }}
                size="small"
                options={languageOptions}
                suffixIcon={<TranslationOutlined />}
                bordered={false}
              />
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 20 }}>
            <Dropdown
              menu={{ items: notificationMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Badge count={notifications.unreadCount} size="small" offset={[-2, 2]}>
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  style={{ 
                    fontSize: '18px',
                    width: 44,
                    height: 44,
                    borderRadius: '10px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onClick={() => dispatch(toggleNotificationPanel())}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = token.colorBgTextHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                />
              </Badge>
            </Dropdown>
            
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div style={{ 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: isMobile ? 8 : 12,
                padding: isMobile ? '6px 12px' : '8px 16px',
                borderRadius: '12px',
                transition: 'all 0.2s ease',
                border: `1px solid ${token.colorBorder}`,
                background: token.colorBgContainer,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = token.colorBgTextHover;
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = token.colorBgContainer;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >
                <Avatar 
                  icon={<UserOutlined />} 
                  style={{ 
                    backgroundColor: token.colorPrimary,
                    width: isMobile ? 32 : 36,
                    height: isMobile ? 32 : 36,
                  }}
                />
                {!isMobile && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: '600',
                      color: token.colorText,
                      lineHeight: '1.2',
                    }}>
                      {user?.name || t('user.defaultName', 'Client User')}
                    </span>
                    <span style={{ 
                      fontSize: '12px', 
                      color: token.colorTextSecondary,
                      lineHeight: '1.2',
                    }}>
                      {user?.email || 'user@example.com'}
                    </span>
                  </div>
                )}
              </div>
            </Dropdown>
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