import React, { Suspense, useMemo, useState } from 'react';
import { Card, Flex, Input, Skeleton, Typography, SearchOutlined, theme } from '@/shared/antd-imports';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SETTINGS_SECTION, settingsItems } from '@/lib/client-portal/settings-constants';
import { PageHeader } from '@/components/v2';

const normalize = (value: string): string =>
  value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Personal preferences: a searchable left nav and a content card, modelled on the main app's Settings. */
export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { section } = useParams();
  const [search, setSearch] = useState('');

  const active = settingsItems.find(item => item.endpoint === section);

  const groups = useMemo(() => {
    const query = normalize(search);
    return settingsItems
      .map(item => ({
        item,
        label: t(item.name, { defaultValue: item.defaultLabel }),
        group: t(item.groupKey, { defaultValue: item.groupDefaultLabel }),
      }))
      .filter(
        ({ item, label, group }) =>
          !query || normalize(label).includes(query) || normalize(group).includes(query) || normalize(item.keywords ?? '').includes(query)
      )
      .reduce<Array<{ key: string; label: string; isDanger: boolean; items: Array<{ item: (typeof settingsItems)[number]; label: string }> }>>((acc, entry) => {
        const existing = acc.find(group => group.key === entry.item.groupKey);
        if (existing) existing.items.push({ item: entry.item, label: entry.label });
        else acc.push({ key: entry.item.groupKey, label: entry.group, isDanger: entry.item.isDanger === true, items: [{ item: entry.item, label: entry.label }] });
        return acc;
      }, []);
  }, [search, t]);

  // /settings and unknown sections open the first one.
  if (!active) return <Navigate to={`/settings/${DEFAULT_SETTINGS_SECTION}`} replace />;
  const Section = active.component;

  return (
    <div>
      <PageHeader
        title={t('settings.title', { defaultValue: 'Settings' })}
        subtitle={t('settings.subtitle', { defaultValue: 'Manage your preferences, notifications, organization and members.' })}
      />
      <Flex gap={16} wrap="wrap" align="flex-start">
        <Card style={{ flex: '0 0 260px', maxWidth: '100%' }} styles={{ body: { padding: 12 } }}>
          <Input
            allowClear
            prefix={<SearchOutlined aria-hidden />}
            placeholder={t('settings.search', { defaultValue: 'Search settings' })}
            aria-label={t('settings.search', { defaultValue: 'Search settings' })}
            value={search}
            onChange={event => setSearch(event.target.value)}
            style={{ marginBottom: 8 }}
          />
          <nav aria-label={t('settings.navLabel', { defaultValue: 'Settings sections' })}>
            {groups.map(group => (
              <div key={group.key} style={{ marginBottom: 8 }}>
                <Typography.Text type={group.isDanger ? 'danger' : 'secondary'} strong style={{ fontSize: token.fontSizeSM, display: 'block', padding: '4px 8px' }}>
                  {group.label}
                </Typography.Text>
                {group.items.map(({ item, label }) => {
                  const isActive = item.endpoint === active.endpoint;
                  return (
                    <Link
                      key={item.key}
                      to={`/settings/${item.endpoint}`}
                      aria-current={isActive ? 'page' : undefined}
                      className="portal-brand-hover"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: token.borderRadius,
                        color: token.colorText,
                        background: isActive ? 'var(--portal-brand-tint)' : 'transparent',
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      <span aria-hidden>{item.icon}</span>
                      {label}
                    </Link>
                  );
                })}
              </div>
            ))}
            {groups.length === 0 && (
              <Typography.Text type="secondary" style={{ padding: 8, display: 'block' }}>
                {t('settings.noResults', { defaultValue: 'No settings match your search.' })}
              </Typography.Text>
            )}
          </nav>
        </Card>
        <div style={{ flex: '1 1 380px', minWidth: 0 }}>
          <Suspense fallback={<Skeleton active />}>
            <Section />
          </Suspense>
        </div>
      </Flex>
    </div>
  );
};

export default SettingsPage;
