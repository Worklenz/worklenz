import React, { useState } from 'react';
import { Button, Card, Tabs } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetNotificationsV2Query,
  useMarkAllNotificationsReadV2Mutation,
  useSetNotificationReadMutation,
} from '@/store/api-v2';
import { EmptyState, NotificationRow, PageHeader, QueryState } from '@/components/v2';
import { targetPath } from '@/utils/targets';
import type { ClientNotificationV2 } from '@/types/v2';

/** Everything addressed to this person. Opening one marks it read and goes to the item. */
export const NotificationsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useGetNotificationsV2Query();
  const [setRead] = useSetNotificationReadMutation();
  const [markAll, { isLoading: markingAll }] = useMarkAllNotificationsReadV2Mutation();
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const items = query.data?.items ?? [];
  const unreadCount = query.data?.unread_count ?? 0;
  const rows = tab === 'all' ? items : items.filter(item => item.unread);

  const open = (item: ClientNotificationV2) => {
    if (item.unread) void setRead({ id: item.id, read: true });
    navigate(targetPath(item.target));
  };

  return (
    <div>
      <PageHeader
        title={t('notifications.title', { defaultValue: 'Notifications' })}
        subtitle={t('notifications.subtitle', { defaultValue: 'Approvals, replies, shared files and updates from your team.' })}
        extra={
          <Button size="small" disabled={unreadCount === 0} loading={markingAll} onClick={() => void markAll()}>
            {t('notifications.markAllRead', { defaultValue: 'Mark all as read' })}
          </Button>
        }
      />
      <Tabs
        activeKey={tab}
        onChange={key => setTab(key as 'all' | 'unread')}
        items={[
          { key: 'all', label: t('notifications.tabAll', { count: items.length, defaultValue: 'All ({{count}})' }) },
          { key: 'unread', label: t('notifications.tabUnread', { count: unreadCount, defaultValue: 'Unread ({{count}})' }) },
        ]}
      />
      <QueryState {...query} refetch={query.refetch}>
        {rows.length === 0 ? (
          <EmptyState
            title={
              tab === 'unread'
                ? t('notifications.noUnread', { defaultValue: 'No unread notifications' })
                : t('notifications.caughtUpTitle', { defaultValue: "You're all caught up" })
            }
          />
        ) : (
          <Card styles={{ body: { padding: 0 } }}>
            {rows.map(item => (
              <NotificationRow
                key={item.id}
                item={item}
                onOpen={open}
                onToggleRead={target => void setRead({ id: target.id, read: target.unread })}
              />
            ))}
          </Card>
        )}
      </QueryState>
    </div>
  );
};

export default NotificationsPage;
