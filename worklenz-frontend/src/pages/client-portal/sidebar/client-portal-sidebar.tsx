import { ConfigProvider, Flex, Menu, Badge } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { clientPortalItems, ClientPortalMenuItems } from '@/lib/client-portal/client-portal-constants';
import { useMemo } from 'react';
import { RightOutlined } from '@ant-design/icons';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { themeWiseColor } from '../../../utils/themeWiseColor';

interface ClientPortalSidebarProps {
  items?: ClientPortalMenuItems[];
}

const ClientPortalSidebar: React.FC<ClientPortalSidebarProps> = ({ items }) => {
  const location = useLocation();
  const { t } = useTranslation('client-portal-common');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
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
        label: (
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
      })),
    [t, unreadChatsCount, themeMode, menuSource]
  );

  // Memoize the active key calculation
  const activeKey = useMemo(() => {
    const afterWorklenzString = location.pathname?.split('/worklenz/client-portal/')[1];
    return afterWorklenzString?.split('/')[0];
  }, [location.pathname]);

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
      <div
        style={{
          background: themeWiseColor('#fff', colors.darkGray, themeMode),
          borderRight: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
          height: '100vh',
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: 18,
            color: themeWiseColor('#222', '#fff', themeMode),
            paddingBottom: 16,
          }}
        >
          {t('client-portal')}
        </div>
        <Menu
          items={menuItems}
          selectedKeys={[activeKey]}
          mode="inline"
          style={{ width: 240, border: 'none', background: 'transparent' }}
        />
      </div>
    </ConfigProvider>
  );
};

export default ClientPortalSidebar;
