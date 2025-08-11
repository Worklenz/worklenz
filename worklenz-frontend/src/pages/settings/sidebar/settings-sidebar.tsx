import { RightOutlined } from '@/shared/antd-imports';
import { ConfigProvider, Flex, Menu, MenuProps } from '@/shared/antd-imports';
import { Link, useLocation } from 'react-router-dom';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { settingsItems, getAccessibleSettings } from '@/lib/settings/settings-constants';
import { useAuthService } from '@/hooks/useAuth';

const SettingSidebar: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation('settings/sidebar');
  const currentSession = useAuthService().getCurrentSession();
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();

  const getCurrentActiveKey = () => {
    const pathParts = location.pathname.split('/worklenz/settings/');
    if (pathParts.length < 2) return '';
    return pathParts[1].split('/')[0];
  };

  // Get accessible settings based on user role
  const accessibleSettings = getAccessibleSettings(isOwnerOrAdmin);

  const items: Required<MenuProps>['items'] = accessibleSettings
    .map(item => {
      if (currentSession?.is_google && item.key === 'change-password') {
        return null;
      }
      const isDangerous = item.isDangerous;
      return {
        key: item.key,
        label: (
          <Flex gap={8} justify="space-between" align="center">
            <Flex gap={8} align="center">
              {item.icon}
              <Link 
                to={`/worklenz/settings/${item.endpoint}`}
                style={{ color: isDangerous ? '#ff4d4f' : undefined }}
              >
                {t(item.name)}
              </Link>
            </Flex>
            <RightOutlined style={{ fontSize: 12 }} />
          </Flex>
        ),
        style: undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            itemHoverBg: colors.transparent,
            itemHoverColor: colors.skyBlue,
            borderRadius: 12,
            itemMarginBlock: 4,
          },
        },
      }}
    >
      <Menu
        items={items}
        selectedKeys={[getCurrentActiveKey()]}
        mode="vertical"
        style={{
          border: 'none',
          width: '100%',
        }}
      />
    </ConfigProvider>
  );
};

export default SettingSidebar;
