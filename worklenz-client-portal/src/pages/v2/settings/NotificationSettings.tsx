import React from 'react';
import { Card, Checkbox, Skeleton, Table, Typography } from '@/shared/antd-imports';
import type { TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { useGetNotificationPrefsQuery, useUpdateNotificationPrefsMutation } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS, QueryState } from '@/components/v2';
import type { NotificationType } from '@/types/v2';

/** In-app is always on. Email is offered only for the events the operator turned email on for. */
const NotificationSettings: React.FC = () => {
  const { t } = useTranslation();
  const { me } = useClientAccess();
  const query = useGetNotificationPrefsQuery();
  const [update] = useUpdateNotificationPrefsMutation();

  const offered = new Set<NotificationType>(me?.emailedEventTypes ?? []);
  const prefs = query.data;

  const columns: TableColumnsType<NotificationType> = [
    {
      title: t('account.notifications.event', { defaultValue: 'Event' }),
      render: (_: unknown, type) => t(`account.notifications.types.${type}`, { defaultValue: NOTIFICATION_TYPE_LABELS[type] }),
    },
    {
      title: t('account.notifications.inApp', { defaultValue: 'In-app' }),
      align: 'center',
      width: 100,
      render: (_: unknown, type) => (
        <Checkbox checked disabled aria-label={`${t('account.notifications.inApp', { defaultValue: 'In-app' })}: ${type}`} />
      ),
    },
    {
      title: t('account.notifications.email', { defaultValue: 'Email' }),
      align: 'center',
      width: 120,
      render: (_: unknown, type) =>
        offered.has(type) ? (
          <Checkbox
            checked={prefs?.[type] ?? true}
            aria-label={`${t('account.notifications.email', { defaultValue: 'Email' })}: ${type}`}
            onChange={event => void update({ [type]: event.target.checked })}
          />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('account.notifications.notOffered', { defaultValue: 'Not offered' })}
          </Typography.Text>
        ),
    },
  ];

  return (
    <Card title={t('settings.nav.notifications', { defaultValue: 'Notifications' })}>
      <div>
        <Typography.Paragraph type="secondary">
          {t('account.notifications.help', {
            defaultValue: 'In-app notifications are always on. Email is available for the events your project contact has enabled.',
          })}
        </Typography.Paragraph>
      </div>
      <QueryState isLoading={query.isLoading || !me} isError={query.isError} error={query.error} refetch={query.refetch}>
        {query.isLoading ? (
          <Skeleton active />
        ) : (
          <Table<NotificationType> rowKey={type => type} columns={columns} dataSource={NOTIFICATION_TYPES} pagination={false} />
        )}
      </QueryState>
    </Card>
  );
};

export default NotificationSettings;
