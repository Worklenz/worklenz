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
    const currentEndpoint = pathParts[1].split('/')[0];
    return settingsItems.find(item => item.endpoint === currentEndpoint)?.key ?? '';
  };

  // Get accessible settings based on user role
  const accessibleSettings = getAccessibleSettings(isOwnerOrAdmin, currentSession).filter(
    item => item.showInSidebar !== false
  );

  const groupedSettings = accessibleSettings.reduce<
    Array<{
      key: string;
      label: string;
      items: NonNullable<Required<MenuProps>['items']>;
    }>
  >((groups, item) => {
    if (currentSession?.is_google && item.key === 'change-password') {
      return groups;
    }

    if (!item.groupKey) {
      return groups;
    }

    const menuItem = {
      key: item.key,
      label: (
        <Flex gap={8} justify="space-between" align="center">
          <Flex gap={8} align="center">
            {item.icon}
            <Link
              to={`/worklenz/settings/${item.endpoint}`}
              style={{ color: item.isDangerous ? '#ff4d4f' : undefined }}
            >
              {t(item.name, { defaultValue: item.defaultValue })}
            </Link>
          </Flex>
          <RightOutlined style={{ fontSize: 12 }} />
        </Flex>
      ),
    };

    const existingGroup = groups.find(group => group.key === item.groupKey);
    if (existingGroup) {
      existingGroup.items.push(menuItem);
      return groups;
    }

    groups.push({
      key: item.groupKey,
      label: (
        <span
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {t(item.groupKey, {
            defaultValue: item.groupDefaultValue ?? item.groupKey,
          })}
        </span>
      ),
      items: [menuItem],
    });

    return groups;
  }, []);

  const items: Required<MenuProps>['items'] = groupedSettings.map(group => ({
    type: 'group',
    key: group.key,
    label: group.label,
    children: group.items,
  }));

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            itemHoverBg: colors.transparent,
            itemHoverColor: colors.skyBlue,
            borderRadius: 12,
            itemMarginBlock: 4,
            groupTitleColor: colors.lightGray,
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
