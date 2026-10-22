import { Button, Flex, Tag, Tooltip, Typography, CheckOutlined, MailOutlined, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/hooks/useFormatters';
import { formatRelative } from '@/utils/dates';
import { decodeHtmlEntities } from '@/utils/html-entities';
import type { ClientNotificationV2 } from '@/types/v2';
import { notificationIcon } from './notificationMeta';

interface NotificationRowProps {
  item: ClientNotificationV2;
  onOpen: (item: ClientNotificationV2) => void;
  /** Adds a mark read / mark unread control. */
  onToggleRead?: (item: ClientNotificationV2) => void;
  /** Dense layout for the bell popover: icon-only toggle, no type/emailed tags. */
  compact?: boolean;
}

export const NotificationRow = ({ item, onOpen, onToggleRead, compact = !onToggleRead }: NotificationRowProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { zone } = useFormatters();

  return (
    <Flex
      role="button"
      tabIndex={0}
      gap={12}
      align="flex-start"
      onClick={() => onOpen(item)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(item);
        }
      }}
      style={{
        padding: compact ? '10px 14px' : '14px 16px',
        cursor: 'pointer',
        background: item.unread ? 'var(--portal-brand-tint-soft)' : 'transparent',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <span aria-hidden style={{ color: token.colorPrimary, marginTop: 2 }}>
        {notificationIcon(item.type)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Flex gap={8} align="center" wrap="wrap">
          <Typography.Text strong={item.unread} style={{ fontSize: compact ? token.fontSizeSM : token.fontSize }}>
            {decodeHtmlEntities(item.title)}
          </Typography.Text>
          {!compact && (
            <Tag style={{ marginInlineEnd: 0 }}>{t(`notificationType.${item.type}`, { defaultValue: item.type })}</Tag>
          )}
          {!compact && item.emailed && (
            <Tag color="blue" icon={<MailOutlined />} style={{ marginInlineEnd: 0 }}>
              {t('notifications.emailed', { defaultValue: 'Emailed' })}
            </Tag>
          )}
        </Flex>
        <Typography.Paragraph type="secondary" style={{ margin: '2px 0 0', fontSize: token.fontSizeSM }}>
          {decodeHtmlEntities(item.body)}
        </Typography.Paragraph>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM - 1 }}>
          {compact ? `${t(`notificationType.${item.type}`, { defaultValue: item.type })} · ` : ''}
          {formatRelative(item.at, zone)}
        </Typography.Text>
      </div>
      {item.unread && compact && !onToggleRead && (
        <span
          role="img"
          aria-label={t('notifications.unread', { defaultValue: 'Unread' })}
          style={{ width: 8, height: 8, borderRadius: '50%', background: token.colorPrimary, marginTop: 6 }}
        />
      )}
      {onToggleRead && compact && (
        <Tooltip
          title={
            item.unread
              ? t('notifications.markRead', { defaultValue: 'Mark read' })
              : t('notifications.markUnread', { defaultValue: 'Mark unread' })
          }
        >
          <Button
            type="text"
            size="small"
            icon={item.unread ? <CheckOutlined /> : <MailOutlined />}
            aria-label={
              item.unread
                ? t('notifications.markRead', { defaultValue: 'Mark read' })
                : t('notifications.markUnread', { defaultValue: 'Mark unread' })
            }
            onClick={event => {
              event.stopPropagation();
              onToggleRead(item);
            }}
          />
        </Tooltip>
      )}
      {onToggleRead && !compact && (
        <Button
          size="small"
          onClick={event => {
            event.stopPropagation();
            onToggleRead(item);
          }}
        >
          {item.unread
            ? t('notifications.markRead', { defaultValue: 'Mark read' })
            : t('notifications.markUnread', { defaultValue: 'Mark unread' })}
        </Button>
      )}
    </Flex>
  );
};
