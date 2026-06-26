import { ConfigProvider, Flex, Input, SearchOutlined, theme, Typography } from '@/shared/antd-imports';
import { Link, useLocation } from 'react-router-dom';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { settingsItems, getAccessibleSettings } from '@/lib/settings/settings-constants';
import { useAuthService } from '@/hooks/useAuth';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useMemo, useState } from 'react';

const normalizeSearchText = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const SettingSidebar: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation('settings/sidebar');
  const currentSession = useAuthService().getCurrentSession();
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const { hasBusinessAccess } = useBusinessFeatures();
  const [searchValue, setSearchValue] = useState('');
  const { token } = theme.useToken();

  const getCurrentActiveKey = () => {
    const pathParts = location.pathname.split('/worklenz/settings/');
    if (pathParts.length < 2) return '';
    const currentEndpoint = pathParts[1].split('/')[0];
    return settingsItems.find(item => item.endpoint === currentEndpoint)?.key ?? '';
  };

  const activeKey = getCurrentActiveKey();

  const groupedSettings = useMemo(
    () =>
      getAccessibleSettings(isOwnerOrAdmin, hasBusinessAccess)
        .filter(item => item.showInSidebar !== false)
        .filter(item => !(currentSession?.is_google && item.key === 'change-password'))
        .reduce<
    Array<{
      key: string;
      label: string;
      isDangerous?: boolean;
      items: typeof settingsItems;
    }>
  >((groups, item) => {
          if (!item.groupKey) {
            return groups;
          }

          const groupLabel = t(item.groupKey, {
            defaultValue: item.groupDefaultValue ?? item.groupKey,
          });
          const itemLabel = t(item.name, { defaultValue: item.defaultValue });
          const itemSearchMetadata = t(`${item.key}-search`, {
            defaultValue: '',
          });
          const normalizedQuery = normalizeSearchText(searchValue);
          const normalizedGroupLabel = normalizeSearchText(groupLabel);
          const normalizedItemLabel = normalizeSearchText(itemLabel);
          const normalizedItemSearchMetadata = normalizeSearchText(itemSearchMetadata);
          const matchesSearch =
            normalizedQuery.length === 0 ||
            normalizedGroupLabel.includes(normalizedQuery) ||
            normalizedItemLabel.includes(normalizedQuery) ||
            normalizedItemSearchMetadata.includes(normalizedQuery);

          if (!matchesSearch) {
            return groups;
          }

          const existingGroup = groups.find(group => group.key === item.groupKey);
          if (existingGroup) {
            existingGroup.items.push(item);
            return groups;
          }

          groups.push({
            key: item.groupKey,
            label: groupLabel,
            isDangerous: item.groupKey === 'danger-zone',
            items: [item],
          });

          return groups;
        }, []),
    [currentSession, isOwnerOrAdmin, searchValue, t]
  );

  return (
    <ConfigProvider
      theme={{
        components: {
          Input: {
            activeBorderColor: token.colorPrimary,
            hoverBorderColor: token.colorBorder,
          },
        },
      }}
    >
      <Flex
        vertical
        gap={16}
        style={{
          width: '100%',
          paddingRight: 8,
        }}
      >
        <Input
          allowClear
          value={searchValue}
          onChange={event => setSearchValue(event.target.value)}
          placeholder={t('searchSettings', { defaultValue: 'Search settings...' })}
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          aria-label={t('searchSettings', { defaultValue: 'Search settings...' })}
        />

        <Flex vertical gap={16}>
          {groupedSettings.map((group, groupIndex) => (
            <Flex
              key={group.key}
              vertical
              gap={8}
              style={{
                paddingBottom: 16,
                borderBottom:
                  groupIndex === groupedSettings.length - 1
                    ? 'none'
                    : `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Typography.Text
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontSize: 12,
                  fontWeight: 600,
                  color: group.isDangerous ? token.colorError : token.colorTextSecondary,
                }}
              >
                {group.label}
              </Typography.Text>

              <Flex vertical gap={4}>
                {group.items.map(item => {
                  const isActive = activeKey === item.key;

                  return (
                    <Link
                      key={item.key}
                      to={`/worklenz/settings/${item.endpoint}`}
                      aria-current={isActive ? 'page' : undefined}
                      style={{
                        textDecoration: 'none',
                        color: item.isDangerous ? token.colorError : token.colorText,
                        background: isActive ? token.colorPrimaryBg : colors.transparent,
                        borderLeft: isActive
                          ? `3px solid ${token.colorPrimary}`
                          : '3px solid transparent',
                        padding: '8px 12px',
                      }}
                    >
                      <Flex gap={10} align="center">
                        <span
                          style={{
                            display: 'inline-flex',
                            color: item.isDangerous
                              ? token.colorError
                              : isActive
                                ? token.colorPrimary
                                : token.colorTextSecondary,
                          }}
                        >
                          {item.icon}
                        </span>
                        <Typography.Text
                          style={{
                            margin: 0,
                            color: item.isDangerous
                              ? token.colorError
                              : isActive
                                ? token.colorPrimary
                                : token.colorText,
                            fontWeight: isActive ? 600 : 400,
                          }}
                        >
                          {t(item.name, { defaultValue: item.defaultValue })}
                        </Typography.Text>
                      </Flex>
                    </Link>
                  );
                })}
              </Flex>
            </Flex>
          ))}
        </Flex>
      </Flex>
    </ConfigProvider>
  );
};

export default SettingSidebar;
