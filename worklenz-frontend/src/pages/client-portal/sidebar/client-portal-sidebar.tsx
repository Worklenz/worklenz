import { ConfigProvider, Flex, Menu, Badge, Button, Drawer, Typography } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { clientPortalItems, ClientPortalMenuItems } from '@/lib/client-portal/client-portal-constants';
import { useMemo, useState } from 'react';
import { RightOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MenuOutlined } from '@ant-design/icons';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { themeWiseColor } from '../../../utils/themeWiseColor';
import { useResponsive } from '../../../hooks/useResponsive';

const { Title } = Typography;

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
  const { t } = useTranslation('client-portal-common');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { isMobile } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Example: get unread chat count from Redux (replace with real selector)
  const unreadChatsCount = useAppSelector(
    (state) => state.clientsPortalReducer?.chatsReducer?.chatList || []
  ).filter((chat) => chat.status === 'unread').length;

  const menuSource = items || clientPortalItems;

  // Memoize the menu items for performance
  const menuItems = useMemo(
    () =>
      menuSource.map(item => ({
        key: item.key,
        icon: item.icon,
        label: collapsed ? null : (
          <Link to={`/worklenz/client-portal/${item.endpoint}`}>
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
          window.location.href = `/worklenz/client-portal/${item.endpoint}`;
        } : undefined,
      })),
    [t, unreadChatsCount, themeMode, menuSource, collapsed]
  );

  // Memoize the active key calculation
  const activeKey = useMemo(() => {
    const afterWorklenzString = location.pathname?.split('/worklenz/client-portal/')[1];
    return afterWorklenzString?.split('/')[0];
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
      title={t('client-portal')}
      placement="left"
      onClose={handleMobileMenuClose}
      open={mobileMenuOpen}
      width={280}
      styles={{
        body: {
          padding: 0,
        },
        header: {
          borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
        },
      }}
    >
      <div style={{ padding: '8px' }}>
        <Menu
          items={menuItems}
          selectedKeys={[activeKey]}
          mode="inline"
          style={{ 
            border: 'none', 
            background: 'transparent',
            width: '100%',
          }}
          onClick={handleMobileMenuClose}
        />
      </div>
    </Drawer>
  );

  // Desktop sidebar component
  const DesktopSidebar = () => (
    <div
      style={{
        background: themeWiseColor('#fff', colors.darkGray, themeMode),
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {/* Header with title and collapse button */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 64,
        }}
      >
        {!collapsed && (
          <Title 
            level={3} 
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: themeWiseColor('#222', '#fff', themeMode),
            }}
          >
            {t('client-portal')}
          </Title>
        )}
        {onToggleCollapse && (
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleCollapse}
            style={{
              fontSize: 16,
              color: themeWiseColor('#666', '#ccc', themeMode),
              border: 'none',
              padding: 4,
            }}
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
          style={{ 
            border: 'none', 
            background: 'transparent',
            width: '100%',
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
            itemHoverBg: colors.transparent,
            itemHoverColor: colors.skyBlue,
            borderRadius: 12,
            itemMarginBlock: 4,
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
            style={{
              position: 'fixed',
              top: 80,
              left: 16,
              zIndex: 1001,
              background: themeWiseColor('#fff', colors.darkGray, themeMode),
              border: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
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
