import { useState } from 'react';
import { Badge, Button, Flex, Popover, Typography, BellOutlined, theme } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetNotificationsV2Query,
  useMarkAllNotificationsReadV2Mutation,
  useSetNotificationReadMutation,
} from '@/store/api-v2';
import PillToggle from '@/components/PillToggle';
import { NotificationRow } from '@/components/v2/NotificationRow';
import { targetPath } from '@/utils/targets';
import type { ClientNotificationV2 } from '@/types/v2';

const COLLAPSED_COUNT = 5;

type Filter = 'new' | 'read';

/**
 * The one place for notifications: unread badge, New / Read filter, open an item to jump to its source
 * (marking it read), mark read / unread per row, mark all read. "View all" expands the popover into a taller,
 * scrollable list instead of leaving for another page.
 */
export const NotificationBell = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<Filter>('new');
  const { data } = useGetNotificationsV2Query();
  const [setRead] = useSetNotificationReadMutation();
  const [markAll, { isLoading: markingAll }] = useMarkAllNotificationsReadV2Mutation();

  const items = data?.items ?? [];
  const unreadCount = data?.unread_count ?? 0;
  const readCount = items.length - unreadCount;
  const filtered = items.filter(item => (filter === 'new' ? item.unread : !item.unread));
  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_COUNT);
  const hasMore = filtered.length > COLLAPSED_COUNT;

  const openItem = (item: ClientNotificationV2) => {
    setOpen(false);
    if (item.unread) void setRead({ id: item.id, read: true });
    navigate(targetPath(item.target));
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setExpanded(false);
  };

  const content = (
    <div style={{ width: expanded ? 460 : 360, maxWidth: 'calc(100vw - 32px)' }}>
      <Flex
        justify="space-between"
        align="center"
        gap={8}
        style={{ padding: '10px 14px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Typography.Text strong>{t('notifications.title', { defaultValue: 'Notifications' })}</Typography.Text>
        <Button type="link" size="small" disabled={unreadCount === 0} loading={markingAll} onClick={() => void markAll()}>
          {t('notifications.markAllRead', { defaultValue: 'Mark all as read' })}
        </Button>
      </Flex>
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <PillToggle<Filter>
          value={filter}
          onChange={setFilter}
          ariaLabel={t('notifications.filter', { defaultValue: 'Filter notifications' })}
          style={{ height: token.controlHeightSM }}
          options={[
            { value: 'new', label: t('notifications.tabNew', { count: unreadCount, defaultValue: 'New ({{count}})' }) },
            { value: 'read', label: t('notifications.tabRead', { count: readCount, defaultValue: 'Read ({{count}})' }) },
          ]}
        />
      </div>
      <div style={{ maxHeight: expanded ? 'min(520px, 65vh)' : 340, overflowY: 'auto' }}>
        {visible.length > 0 ? (
          visible.map(item => (
            <NotificationRow
              key={item.id}
              item={item}
              compact
              onOpen={openItem}
              onToggleRead={target => void setRead({ id: target.id, read: target.unread })}
            />
          ))
        ) : (
          <Typography.Paragraph type="secondary" style={{ padding: 20, textAlign: 'center', margin: 0 }}>
            {filter === 'new'
              ? t('notifications.caughtUp', { defaultValue: "You're all caught up." })
              : t('notifications.noRead', { defaultValue: 'No read notifications yet' })}
          </Typography.Paragraph>
        )}
      </div>
      {(hasMore || expanded) && (
        <Flex justify="center" style={{ padding: '6px 14px', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Button type="link" size="small" aria-expanded={expanded} onClick={() => setExpanded(prev => !prev)}>
            {expanded
              ? t('notifications.showLess', { defaultValue: 'Show less' })
              : t('notifications.viewAll', { defaultValue: 'View all' })}
          </Button>
        </Flex>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={handleOpenChange}
      arrow={false}
      styles={{ body: { padding: 0 } }}
    >
      <Badge count={unreadCount} size="small" offset={[-4, 4]}>
        <Button
          type="text"
          shape="circle"
          aria-label={t('notifications.openLabel', { defaultValue: 'Open notifications' })}
          icon={<BellOutlined style={{ fontSize: 16 }} />}
          style={{ border: `1px solid ${token.colorBorder}` }}
        />
      </Badge>
    </Popover>
  );
};
