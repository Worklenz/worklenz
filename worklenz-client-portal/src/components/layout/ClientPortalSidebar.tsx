import { Flex, Menu, Badge, Button, Drawer, theme } from '@/shared/antd-imports';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clientPortalItems, ClientPortalMenuItems, VISIBILITY_GATED_KEYS } from '@/lib/client-portal/client-portal-constants';
import { useEffect, useMemo, useState } from 'react';
import { MenuFoldOutlined, MenuUnfoldOutlined, MenuOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useResponsive } from '@/hooks/useResponsive';
import worklenzLightLogo from '@/assets/images/worklenz-light-mode.png';
import worklenzDarkLogo from '@/assets/images/worklenz-dark-mode.png';
import { useGetOrganizationSettingsQuery } from '@/store/api';
import { setOrgBranding, setTheme } from '@/store/slices/uiSlice';

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
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const themeMode = useAppSelector(state => state.ui.theme);
  const orgPortalTitle = useAppSelector(state => state.ui.orgPortalTitle);
  const { isMobile } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { token } = theme.useToken();

  // Get organization settings for custom logo/branding (client-side)
  const { data: settingsData } = useGetOrganizationSettingsQuery();

  // Push the org's branding into Redux once it resolves, and — only the very first time this
  // viewer has never chosen a theme — apply the org's default. A returning viewer's own choice
  // (in localStorage) is never overwritten.
  useEffect(() => {
    if (!settingsData?.body) return;
    dispatch(setOrgBranding({
      primaryColor: settingsData.body.primary_color || null,
      portalTitle: settingsData.body.portal_title || null,
    }));
    if (!localStorage.getItem('theme') && settingsData.body.portal_theme) {
      dispatch(setTheme(settingsData.body.portal_theme));
    }
  }, [settingsData, dispatch]);

  // Example: get unread chat count from Redux (replace with real selector)
  const unreadChatsCount = useAppSelector(
    (state) => state.ui.notifications?.unreadCount || 0
  );

  const menuSource = (items || clientPortalItems).filter(item => {
    const visibilityField = VISIBILITY_GATED_KEYS[item.key];
    if (!visibilityField || !settingsData?.body) return true;
    return settingsData.body[visibilityField] !== false;
  });

  // Memoize the menu items for performance
  const menuItems = useMemo(
    () =>
      menuSource.map(item => ({
        key: item.key,
        icon: item.icon,
        label: (
          <Flex align="center" gap={8}>
            <span>{t(item.name)}</span>
            {item.key === 'chats' && unreadChatsCount > 0 && (
              <Badge count={unreadChatsCount} size="small" />
            )}
          </Flex>
        ),
        onClick: () => navigate(`/${item.endpoint}`),
      })),
    [t, unreadChatsCount, menuSource, navigate]
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

  // Get logo based on theme and settings
  const logoSrc = useMemo(() => {
    if (settingsData?.body?.logo_url) {
      return settingsData.body.logo_url;
    }
    return themeMode === 'dark' ? worklenzDarkLogo : worklenzLightLogo;
  }, [settingsData, themeMode]);

  // Mobile menu component
  const MobileMenu = () => (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', height: 32 }}>
          <img src={logoSrc} alt="Logo" style={{ height: '100%', objectFit: 'contain' }} />
        </div>
      }
      placement="left"
      onClose={handleMobileMenuClose}
      open={mobileMenuOpen}
      width={280}
      styles={{
        body: { padding: 0 },
      }}
    >
      <Menu
        items={menuItems}
        selectedKeys={[activeKey]}
        mode="inline"
        style={{ border: 'none' }}
        onClick={handleMobileMenuClose}
      />
    </Drawer>
  );

  // Desktop sidebar component
  const DesktopSidebar = () => (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with logo and collapse button */}
      <div
        style={{
          padding: collapsed ? '12px 8px' : '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          height: 56,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {!collapsed && (
          <Flex align="center" gap={8} style={{ height: 28, minWidth: 0 }}>
            <img src={logoSrc} alt="Logo" style={{ height: '100%', objectFit: 'contain', flexShrink: 0 }} />
            {orgPortalTitle && (
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: token.colorText,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {orgPortalTitle}
              </span>
            )}
          </Flex>
        )}
        {onToggleCollapse && (
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleCollapse}
            size="small"
          />
        )}
      </div>

      {/* Menu */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        <Menu
          items={menuItems}
          selectedKeys={[activeKey]}
          mode="inline"
          inlineCollapsed={collapsed}
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={handleMobileMenuOpen}
            style={{
              position: 'fixed',
              top: 72,
              left: 16,
              zIndex: 1001,
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              width: 40,
              height: 40,
            }}
          />
          <MobileMenu />
        </>
      ) : (
        <DesktopSidebar />
      )}
    </>
  );
};

export default ClientPortalSidebar;