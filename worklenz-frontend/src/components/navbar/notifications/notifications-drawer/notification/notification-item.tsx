import { IWorklenzNotification } from '@/types/notifications/notifications.types';
import { BankOutlined } from '@/shared/antd-imports';
import { Button, Tag, Typography, theme } from '@/shared/antd-imports';
import DOMPurify from 'dompurify';
import React, { useState } from 'react';
import { fromNow } from '@/utils/dateUtils';
import './notification-item.css';

const { Text } = Typography;

interface NotificationItemProps {
  notification: IWorklenzNotification;
  isUnreadNotifications?: boolean;
  markNotificationAsRead?: (id: string) => Promise<void>;
  goToUrl?: (e: React.MouseEvent, notification: IWorklenzNotification) => Promise<void>;
}

const NotificationItem = ({
  notification,
  isUnreadNotifications = true,
  markNotificationAsRead,
  goToUrl,
}: NotificationItemProps) => {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const isDarkMode =
    token.colorBgContainer === '#141414' ||
    token.colorBgContainer.includes('dark') ||
    document.documentElement.getAttribute('data-theme') === 'dark';

  const handleNotificationClick = async (e: React.MouseEvent) => {
    await goToUrl?.(e, notification);
    await markNotificationAsRead?.(notification.id);
  };

  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.id) return;

    setLoading(true);
    try {
      await markNotificationAsRead?.(notification.id);
    } finally {
      setLoading(false);
    }
  };

  const createSafeHtml = (html: string) => {
    return { __html: DOMPurify.sanitize(html) };
  };

  const getTagBackground = (color?: string) => {
    if (!color) return {};

    // Create a more transparent version of the color for the background
    // This is equivalent to the color + '4d' in the Angular template
    const bgColor = `${color}4d`;

    // For dark mode, we might need to adjust the text color for better contrast
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
  };

  return (
    <div
      style={{
        width: 'auto',
        border: notification.color ? `2px solid ${notification.color}4d` : undefined,
        cursor: notification.url ? 'pointer' : 'default',
      }}
      onClick={handleNotificationClick}
      className="ant-notification-notice worklenz-notification rounded-4"
    >
      <div className="ant-notification-notice-content">
        <div className="ant-notification-notice-description">
          {/* Team name */}
          <div className="mb-1">
            <Text type="secondary">
              <BankOutlined /> {notification.team}
            </Text>
          </div>

          {/* Message with HTML content */}
          <div className="mb-1" dangerouslySetInnerHTML={createSafeHtml(notification.message)} />

          {/* Project tag */}
          {notification.project && (
            <div>
              <Tag style={getTagBackground(notification.color)}>{notification.project}</Tag>
            </div>
          )}
        </div>

        {/* Footer with mark as read button and timestamp */}
        <div className="d-flex align-items-baseline justify-content-between mt-1">
          {isUnreadNotifications && markNotificationAsRead && (
            <Button
              loading={loading}
              type="link"
              size="small"
              shape="round"
              className="p-0"
              onClick={e => handleMarkAsRead(e)}
            >
              <u>Mark as read</u>
            </Button>
          )}
          <Text type="secondary" className="small">
            {notification.created_at ? fromNow(notification.created_at) : ''}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
