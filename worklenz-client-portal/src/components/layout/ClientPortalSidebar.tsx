import { ConfigProvider, Flex, Menu, Badge, Button, Drawer } from '@/shared/antd-imports';
import { Link, useLocation } from 'react-router-dom';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { clientPortalItems, ClientPortalMenuItems } from '@/lib/client-portal/client-portal-constants';
import { useMemo, useState } from 'react';
import { RightOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MenuOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useResponsive } from '@/hooks/useResponsive';
import worklenzLightLogo from '@/assets/images/worklenz-light-mode.png';
import worklenzDarkLogo from '@/assets/images/worklenz-dark-mode.png';
import { useGetSettingsQuery } from '@/store/api';

interface ClientPortalSidebarProps {
  items?: ClientPortalMenuItems[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ClientPortalSidebar: React.FC<ClientPortalSidebarProps> = ({ 
  items, 
  collapsed = false, 
  onToggleCollapse 
}) => {
  const location = useLocation();
  const { t } = useTranslation();
  const themeMode = useAppSelector(state => state.ui.theme);
  const { isMobile } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Get client portal settings for custom logo
  const { data: settingsData } = useGetSettingsQuery();
  
  // Example: get unread chat count from Redux (replace with real selector)
  const unreadChatsCount = useAppSelector(
    (state) => state.ui.notifications?.unreadCount || 0
  );

  const menuSource = items || clientPortalItems;

  // Memoize the menu items for performance
  const menuItems = useMemo(
    () =>
      menuSource.map(item => ({
        key: item.key,
        icon: item.icon,
        label: collapsed ? null : (
          <Link to={`/${item.endpoint}`}>
            <Flex align="center" justify="space-between" style={{ width: '100%' }}>
              <Flex align="center" gap={8}>
                <span>{t(item.name)}</span>
                {item.key === 'chats' && unreadChatsCount > 0 && (
                  <Badge count={unreadChatsCount} style={{ backgroundColor: '#ff4d4f', marginLeft: 4 }} />
                )}
              </Flex>
              <RightOutlined style={{ fontSize: 12, color: themeWiseColor('#bfbfbf', '#888', themeMode) }} />
            </Flex>
          </Link>
        ),
        onClick: collapsed ? () => {
          // Handle navigation for collapsed state
          window.location.href = `/${item.endpoint}`;
        } : undefined,
      })),
    [t, unreadChatsCount, themeMode, menuSource, collapsed]
  );

  // Memoize the active key calculation
  const activeKey = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    return pathSegments[0] || 'dashboard';
  }, [location.pathname]);

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };

  const handleMobileMenuOpen = () => {
    setMobileMenuOpen(true);
  };

  // Mobile menu component
  const MobileMenu = () => (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={(() => {
              // Check for custom logo from API first
              if (settingsData?.body?.logo_url) {
                return settingsData.body.logo_url;
              }
              // Fallback to Worklenz logo based on theme
              return themeMode === 'dark' ? worklenzDarkLogo : worklenzLightLogo;
            })()}
            alt="Logo"
            style={{ 
              maxHeight: '32px', 
              maxWidth: '140px',
              objectFit: 'contain'
            }}
          />
        </div>
      }
      placement="left"
      onClose={handleMobileMenuClose}
      open={mobileMenuOpen}
      width={320}
      styles={{
        body: {
          padding: '16px 0',
          background: themeWiseColor('#fafafa', '#1f1f1f', themeMode),
        },
        header: {
          borderBottom: `1px solid ${themeWiseColor('#e8e8e8', '#2a2a2a', themeMode)}`,
          background: themeWiseColor('#fff', '#262626', themeMode),
          padding: '16px 24px',
        },
      }}
    >
      <div className="animate-fadeIn" style={{ padding: '0 16px' }}>
        <Menu
          items={menuItems}
          selectedKeys={[activeKey]}
          mode="inline"
          style={{ 
            border: 'none', 
            background: 'transparent',
            width: '100%',
            fontSize: '14px',
          }}
          onClick={handleMobileMenuClose}
        />
      </div>
    </Drawer>
  );

  // Desktop sidebar component
  const DesktopSidebar = () => (
    <div
      className="animate-slideInLeft"
      style={{
        background: themeWiseColor('#fafafa', '#1f1f1f', themeMode),
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxShadow: themeWiseColor('2px 0 8px rgba(0,0,0,0.06)', '2px 0 8px rgba(0,0,0,0.2)', themeMode),
      }}
    >
      {/* Header with title and collapse button */}
      <div
        style={{
          padding: collapsed ? '17px 16px' : '17px 24px',
          borderBottom: `1px solid ${themeWiseColor('#e8e8e8', '#2a2a2a', themeMode)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 72,
          background: themeWiseColor('#fff', '#262626', themeMode),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <img
            src={(() => {
              // Check for custom logo from API first
              if (settingsData?.body?.logo_url) {
                return settingsData.body.logo_url;
              }
              // Fallback to Worklenz logo based on theme
              return themeMode === 'dark' ? worklenzDarkLogo : worklenzLightLogo;
            })()}
            alt="Logo"
            style={{ 
              maxHeight: collapsed ? '32px' : '36px', 
              maxWidth: collapsed ? '48px' : '160px',
              objectFit: 'contain'
            }}
          />
        </div>
        {onToggleCollapse && (
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleCollapse}
            style={{
              fontSize: 16,
              color: themeWiseColor('#666', '#ccc', themeMode),
              border: 'none',
              padding: '8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = themeWiseColor('#f0f0f0', '#333', themeMode);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          />
        )}
      </div>

      {/* Menu */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        <Menu
          items={menuItems}
          selectedKeys={[activeKey]}
          mode="inline"
          inlineCollapsed={collapsed}
          style={{ 
            border: 'none', 
            background: 'transparent',
            width: '100%',
            fontSize: '14px',
          }}
        />
      </div>
    </div>
  );

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            subMenuItemBg: colors.transparent,
            itemHoverBg: themeWiseColor('#f0f6ff', '#2a2a2a', themeMode),
            itemSelectedBg: themeWiseColor('#e6f4ff', '#1f4d7d', themeMode),
            itemHoverColor: themeWiseColor('#1890ff', '#4dabf7', themeMode),
            itemSelectedColor: themeWiseColor('#1890ff', '#ffffff', themeMode),
            itemColor: themeWiseColor('#424242', '#d9d9d9', themeMode),
            borderRadius: 12,
            itemMarginBlock: 6,
            itemMarginInline: 0,
            itemPaddingInline: 16,
            itemHeight: 48,
            fontSize: 14,
          },
        },
      }}
    >
      {isMobile ? (
        <>
          {/* Mobile menu button */}
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={handleMobileMenuOpen}
            className="smooth-hover animate-bounce"
            style={{
              position: 'fixed',
              top: 80,
              left: 16,
              zIndex: 1001,
              background: themeWiseColor('#ffffff', '#262626', themeMode),
              border: `1px solid ${themeWiseColor('#e8e8e8', '#3a3a3a', themeMode)}`,
              borderRadius: 12,
              boxShadow: themeWiseColor(
                '0 4px 12px rgba(0,0,0,0.1)',
                '0 4px 12px rgba(0,0,0,0.3)',
                themeMode
              ),
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: themeWiseColor('#424242', '#d9d9d9', themeMode),
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = themeWiseColor(
                '0 6px 16px rgba(0,0,0,0.15)',
                '0 6px 16px rgba(0,0,0,0.4)',
                themeMode
              );
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = themeWiseColor(
                '0 4px 12px rgba(0,0,0,0.1)',
                '0 4px 12px rgba(0,0,0,0.3)',
                themeMode
              );
            }}
          />
          <MobileMenu />
        </>
      ) : (
        <DesktopSidebar />
      )}
    </ConfigProvider>
  );
};

export default ClientPortalSidebar;