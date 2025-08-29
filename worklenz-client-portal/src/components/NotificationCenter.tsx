import React, { useState, useEffect } from 'react';
import {
  Badge,
  Button,
  Dropdown,
  List,
  Spin,
  Typography,
  Empty,
  Space,
  Divider,
  Avatar,
  MenuProps
} from '@/shared/antd-imports';
import {
  BellOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import clientPortalAPI from '@/services/api';
import { ClientNotification, ApiResponse } from '@/types';
import { useAppSelector } from '@/hooks/useAppSelector';

const { Text } = Typography;

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const { theme } = useAppSelector((state) => state.ui);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const response: ApiResponse<ClientNotification[]> = await clientPortalAPI.getNotifications({
        page: 1,
        limit: 10,
        unread_only: false
      });
      if (response.done && response.body) {
        setNotifications(response.body);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await clientPortalAPI.markNotificationRead(notificationId);
      if (response.done) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        );
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await clientPortalAPI.markAllNotificationsRead();
      if (response.done) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'request_update':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
      case 'invoice_created':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'project_update':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'message':
        return <BellOutlined style={{ color: '#722ed1' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const getUnreadCount = () => {
    return notifications.filter(n => !n.isRead).length;
  };

  const formatNotificationTime = (createdAt: string) => {
    const now = new Date();
    const notificationTime = new Date(createdAt);
    const diff = now.getTime() - notificationTime.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return notificationTime.toLocaleDateString();
  };

  const handleNotificationClick = (notification: ClientNotification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    
    // Handle navigation based on notification type and reference
    switch (notification.type) {
      case 'request_update':
        if (notification.referenceId) {
          window.location.href = `/requests/${notification.referenceId}`;
        }
        break;
      case 'invoice_created':
        if (notification.referenceId) {
          window.location.href = `/invoices/${notification.referenceId}`;
        }
        break;
      case 'project_update':
        if (notification.referenceId) {
          window.location.href = `/projects/${notification.referenceId}`;
        }
        break;
      case 'message':
        window.location.href = '/chats';
        break;
    }
    
    setDropdownVisible(false);
  };

  const notificationMenuItems: MenuProps['items'] = [
    {
      key: 'header',
      type: 'group',
      label: (
        <div style={{ padding: '8px 0' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text strong>Notifications</Text>
            {getUnreadCount() > 0 && (
              <Button
                type="link"
                size="small"
                onClick={markAllAsRead}
                style={{ padding: 0, height: 'auto' }}
              >
                Mark all read
              </Button>
            )}
          </Space>
        </div>
      ),
    },
    {
      type: 'divider',
    },
    {
      key: 'notifications',
      label: (
        <div style={{ width: 350, maxHeight: 400, overflowY: 'auto' }}>
          <Spin spinning={isLoading}>
            {notifications.length > 0 ? (
              <List
                dataSource={notifications}
                renderItem={(notification) => (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      backgroundColor: notification.isRead 
                        ? 'transparent' 
                        : (theme === 'dark' ? '#1890ff10' : '#f6ffed'),
                      padding: '12px 16px',
                      borderLeft: !notification.isRead ? '3px solid #1890ff' : 'none'
                    }}
                    onClick={() => handleNotificationClick(notification)}
                    actions={[
                      !notification.isRead && (
                        <Button
                          type="text"
                          size="small"
                          icon={<CheckOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                        />
                      )
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          size="small"
                          icon={getNotificationIcon(notification.type)}
                          style={{ backgroundColor: 'transparent', border: 'none' }}
                        />
                      }
                      title={
                        <div>
                          <Text strong={!notification.isRead} style={{ fontSize: '14px' }}>
                            {notification.title}
                          </Text>
                          {notification.referenceNumber && (
                            <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
                              #{notification.referenceNumber}
                            </Text>
                          )}
                        </div>
                      }
                      description={
                        <div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {notification.message}
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            {formatNotificationTime(notification.createdAt)}
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ padding: '50px 20px', textAlign: 'center' }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No notifications yet"
                />
              </div>
            )}
          </Spin>
          
          {notifications.length > 0 && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ textAlign: 'center', padding: '8px' }}>
                <Button type="link" size="small">
                  View All Notifications
                </Button>
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Dropdown
      menu={{ items: notificationMenuItems }}
      trigger={['click']}
      open={dropdownVisible}
      onOpenChange={setDropdownVisible}
      placement="bottomRight"
    >
      <Button
        type="text"
        icon={
          <Badge count={getUnreadCount()} size="small">
            <BellOutlined style={{ fontSize: '18px' }} />
          </Badge>
        }
        style={{ border: 'none' }}
      />
    </Dropdown>
  );
};

export default NotificationCenter;