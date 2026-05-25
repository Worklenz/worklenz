import {
  ConfigProvider,
  Flex,
  Menu,
  Badge,
  Button,
  Drawer,
  Typography,
} from '@/shared/antd-imports';
import { Link, useLocation, useNavigate, useNavigation } from 'react-router-dom';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';
import {
  clientPortalItems,
  ClientPortalMenuItems,
} from '@/lib/client-portal/client-portal-constants';
import { useMemo, useState, useRef, useCallback } from 'react';
import {
  RightOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { themeWiseColor } from '../../../utils/themeWiseColor';
import { useResponsive } from '../../../hooks/useResponsive';
import { useMixpanelTracking } from '../../../hooks/useMixpanelTracking';
import {
  MixpanelEvents,
  ClientPortalNavigationEventProps,
} from '../../../types/mixpanel-events.types';
import { createPortal } from 'react-dom';

const { Title } = Typography;

const SidebarTooltip: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }
    setVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => setVisible(false), []);

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'flex', alignItems: 'center' }}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: 'translateY(-50%)',
              backgroundColor: '#000000',
              color: '#ffffff',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '14px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 99999,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {label}
          </div>,
          document.body
        )}
    </>
  );
};

interface ClientPortalSidebarProps {
  items?: ClientPortalMenuItems[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ClientPortalSidebar: React.FC<ClientPortalSidebarProps> = ({
  items,
  collapsed = false,
  onToggleCollapse,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('client-portal-common');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { isMobile } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Example: get unread chat count from Redux (replace with real selector)
  const unreadChatsCount = useAppSelector(
    state => state.clientsPortalReducer?.chatsReducer?.chatList || []
  ).filter(chat => chat.status === 'unread').length;

  // Track navigation
  const handleNavigation = (
    toPage: string,
    fromPage?: string,
    method: 'sidebar' | 'link' = 'sidebar'
  ) => {
    const navigationProps: ClientPortalNavigationEventProps = {
      from_page: fromPage || activeKey,
      to_page: toPage,
      navigation_method: method,
      page: 'client_portal',
      source: 'sidebar',
    };

    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_NAVIGATION, navigationProps);
  };

  const menuSource = items || clientPortalItems;

  // Memoize the menu items for performance
  const menuItems = useMemo(
    () =>
      menuSource.map(item => ({
        key: item.key,
        icon: collapsed ? (
          <SidebarTooltip label={t(item.name)}>{item.icon}</SidebarTooltip>
        ) : (
          item.icon
        ),
        title: undefined,
        label: collapsed ? null : (
          <Link to={`/worklenz/client-portal/${item.endpoint}`}>
            <Flex align="center" justify="space-between" style={{ width: '100%' }}>
              <Flex align="center" gap={8}>
                <span>{t(item.name)}</span>
                {item.key === 'chats' && unreadChatsCount > 0 && (
                  <Badge
                    count={unreadChatsCount}
                    style={{ backgroundColor: '#ff4d4f', marginLeft: 4 }}
                  />
                )}
              </Flex>
              <RightOutlined
                style={{ fontSize: 12, color: themeWiseColor('#bfbfbf', '#888', themeMode) }}
              />
            </Flex>
          </Link>
        ),
        onClick: collapsed
          ? () => {
              // Handle navigation for collapsed state
              handleNavigation(item.key, activeKey, 'sidebar');
              navigate(`/worklenz/client-portal/${item.endpoint}`);
            }
          : () => {
              // Handle navigation for expanded state
              handleNavigation(item.key, activeKey, 'sidebar');
            },
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
