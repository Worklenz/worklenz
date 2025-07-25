import React, { memo, useState, useCallback, useMemo } from 'react';
import { IWorklenzNotification } from '@/types/notifications/notifications.types';
import { BankOutlined } from '@/shared/antd-imports';
import { Button, Tag, Typography, theme } from '@/shared/antd-imports';
import DOMPurify from 'dompurify';
import { fromNow } from '@/utils/dateUtils';
import './NotificationItem.css';

const { Text } = Typography;

interface NotificationItemProps {
  notification: IWorklenzNotification;
  isUnreadNotifications?: boolean;
  markNotificationAsRead?: (id: string) => Promise<void>;
  goToUrl?: (e: React.MouseEvent, notification: IWorklenzNotification) => Promise<void>;
}

const NotificationItem = memo<NotificationItemProps>(({
  notification,
  isUnreadNotifications = true,
  markNotificationAsRead,
  goToUrl,
}) => {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  
  const isDarkMode = useMemo(
    () =>
      token.colorBgContainer === '#141414' ||
      token.colorBgContainer.includes('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark',
    [token.colorBgContainer]
  );

  const handleNotificationClick = useCallback(
    async (e: React.MouseEvent) => {
      await goToUrl?.(e, notification);
      await markNotificationAsRead?.(notification.id);
    },
    [goToUrl, markNotificationAsRead, notification]
  );

  const handleMarkAsRead = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!notification.id) return;

      setLoading(true);
      try {
        await markNotificationAsRead?.(notification.id);
      } finally {
        setLoading(false);
      }
    },
    [markNotificationAsRead, notification.id]
  );

  const safeMessageHtml = useMemo(
    () => ({ __html: DOMPurify.sanitize(notification.message) }),
    [notification.message]
  );

  const tagStyle = useMemo(() => {
    if (!notification.color) return {};

    const bgColor = `${notification.color}4d`;

    if (isDarkMode) {
      return {
        backgroundColor: bgColor,
        color: '#ffffff',
        borderColor: 'transparent',
      };
    }

    return {
      backgroundColor: bgColor,
      borderColor: 'transparent',
    };
  }, [notification.color, isDarkMode]);

  const containerStyle = useMemo(
    () => ({
      border: notification.color ? `2px solid ${notification.color}4d` : undefined,
    }),
    [notification.color]
  );

  const containerClasses = useMemo(
    () => [
      'w-auto p-3 mb-3 rounded border border-gray-200 bg-white shadow-sm transition-all duration-300',
      'hover:shadow-md hover:bg-gray-50',
      notification.url ? 'cursor-pointer' : 'cursor-default',
      'dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
    ].join(' '),
    [notification.url]
  );

  const formattedDate = useMemo(
    () => (notification.created_at ? fromNow(notification.created_at) : ''),
    [notification.created_at]
  );

  const shouldShowProject = useMemo(
    () => Boolean(notification.project),
    [notification.project]
  );

  const shouldShowMarkAsRead = useMemo(
    () => Boolean(isUnreadNotifications && markNotificationAsRead),
    [isUnreadNotifications, markNotificationAsRead]
  );

  return (
    <div
      style={containerStyle}
      onClick={handleNotificationClick}
      className={containerClasses}
    >
      <div className="notification-content">
        <div className="notification-description">
          {/* Team name */}
          <div className="mb-2">
            <Text type="secondary" className="flex items-center gap-2">
              <BankOutlined /> {notification.team}
            </Text>
          </div>

          {/* Message with HTML content */}
          <div className="mb-2" dangerouslySetInnerHTML={safeMessageHtml} />

          {/* Project tag */}
          {shouldShowProject && (
            <div className="mb-2">
              <Tag style={tagStyle}>{notification.project}</Tag>
            </div>
          )}
        </div>

        {/* Footer with mark as read button and timestamp */}
        <div className="flex items-baseline justify-between mt-2">
          {shouldShowMarkAsRead && (
            <Button
              loading={loading}
              type="link"
              size="small"
              shape="round"
              className="p-0"
              onClick={handleMarkAsRead}
            >
              <u>Mark as read</u>
            </Button>
          )}
          <Text type="secondary" className="text-xs">
            {formattedDate}
          </Text>
        </div>
      </div>
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';

export default NotificationItem;
