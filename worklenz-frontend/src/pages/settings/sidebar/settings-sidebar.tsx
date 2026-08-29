import {
  ConfigProvider,
  Collapse,
  Flex,
  Input,
  SearchOutlined,
  DownOutlined,
  theme,
  Typography,
} from '@/shared/antd-imports';
import { Link, useLocation } from 'react-router-dom';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { settingsItems, getAccessibleSettings } from '@/lib/settings/settings-constants';
import { useAuthService } from '@/hooks/useAuth';
import { useEffect, useMemo, useState } from 'react';

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
  const [searchValue, setSearchValue] = useState('');
  const { token } = theme.useToken();

  const getCurrentActiveKey = () => {
    const pathParts = location.pathname.split('/worklenz/settings/');
    if (pathParts.length < 2) return '';
    const currentEndpoint = pathParts[1].split('/')[0];
    return settingsItems.find(item => item.endpoint === currentEndpoint)?.key ?? '';
  };

  const activeKey = getCurrentActiveKey();

  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([]);
  const [hasInitializedExpansion, setHasInitializedExpansion] = useState(false);

  const groupedSettings = useMemo(
    () =>
      getAccessibleSettings(isOwnerOrAdmin, currentSession)
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

  useEffect(() => {
    if (hasInitializedExpansion || groupedSettings.length === 0) return;

    const firstGroupKey = groupedSettings[0].key;
    const activeGroupKey = groupedSettings.find(group =>
      group.items.some(item => item.key === activeKey)
    )?.key;

    setExpandedGroupKeys(
      activeGroupKey && activeGroupKey !== firstGroupKey
        ? [firstGroupKey, activeGroupKey]
        : [firstGroupKey]
    );
    setHasInitializedExpansion(true);
  }, [groupedSettings, activeKey, hasInitializedExpansion]);

  const isSearching = normalizeSearchText(searchValue).length > 0;
  const visibleExpandedKeys = isSearching
    ? groupedSettings.map(group => group.key)
    : expandedGroupKeys;

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

        <Collapse
          ghost
          activeKey={visibleExpandedKeys}
          onChange={keys => setExpandedGroupKeys(Array.isArray(keys) ? keys : [keys])}
          expandIcon={({ isActive }) => (
            <DownOutlined
              style={{
                fontSize: 11,
                color: token.colorTextSecondary,
                transition: 'transform 0.2s',
                transform: isActive ? 'rotate(0deg)' : 'rotate(-90deg)',
              }}
            />
          )}
          items={groupedSettings.map(group => ({
            key: group.key,
            label: (
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
            ),
            style: {
              marginBottom: 4,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            },
            children: (
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
            ),
          }))}
        />
      </Flex>
    </ConfigProvider>
  );
};

export default SettingSidebar;
