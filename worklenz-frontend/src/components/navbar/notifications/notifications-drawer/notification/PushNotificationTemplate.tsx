import React, { memo, useCallback, useMemo } from 'react';
import { notification } from '@/shared/antd-imports';
import { IWorklenzNotification } from '@/types/notifications/notifications.types';
import { teamsApiService } from '@/api/teams/teams.api.service';
import { toQueryString } from '@/utils/toQueryString';
import { BankOutlined } from '@/shared/antd-imports';
import './PushNotificationTemplate.css';

interface PushNotificationTemplateProps {
  notification: IWorklenzNotification;
}

const PushNotificationTemplate = memo(({
  notification: notificationData,
}: PushNotificationTemplateProps) => {
  const handleClick = useCallback(async () => {
    if (!notificationData.url) return;
    
    try {
      let url = notificationData.url;
      if (notificationData.params && Object.keys(notificationData.params).length) {
        const q = toQueryString(notificationData.params);
        url += q;
      }

      if (notificationData.team_id) {
        await teamsApiService.setActiveTeam(notificationData.team_id);
      }

      window.location.href = url;
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  }, [notificationData.url, notificationData.params, notificationData.team_id]);

  const containerStyle = useMemo(
    () => ({
      cursor: notificationData.url ? 'pointer' : 'default',
      padding: '8px 0',
      borderRadius: '8px',
    }),
    [notificationData.url]
  );

  const headerStyle = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      marginBottom: '8px',
      color: '#262626',
      fontSize: '14px',
      fontWeight: 500,
    }),
    []
  );

  const iconStyle = useMemo(
    () => ({ marginRight: '8px', color: '#1890ff' }),
    []
  );

  const messageStyle = useMemo(
    () => ({
      color: '#595959',
      fontSize: '13px',
      lineHeight: '1.5',
      marginTop: '4px',
    }),
    []
  );

  const className = useMemo(
    () => `notification-content ${notificationData.url ? 'clickable' : ''}`,
    [notificationData.url]
  );

  const messageHtml = useMemo(
    () => ({ __html: notificationData.message }),
    [notificationData.message]
  );

  return (
    <div
      onClick={handleClick}
      className={className}
      style={containerStyle}
    >
      <div style={headerStyle}>
        {notificationData.team ? (
          <>
            <BankOutlined style={iconStyle} />
            {notificationData.team}
          </>
        ) : (
          'Worklenz'
        )}
      </div>
      <div
        style={messageStyle}
        dangerouslySetInnerHTML={messageHtml}
      />
    </div>
  );
});

PushNotificationTemplate.displayName = 'PushNotificationTemplate';

// Notification queue management
class NotificationQueueManager {
  private queue: IWorklenzNotification[] = [];
  private isProcessing = false;
  private readonly maxQueueSize = 10;
  private readonly notificationStyle = {
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    padding: '12px 16px',
    minWidth: '300px',
    maxWidth: '400px',
  };

  private processQueue = () => {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const notificationData = this.queue.shift();

    if (notificationData) {
      notification.info({
        message: null,
        description: <PushNotificationTemplate notification={notificationData} />,
        placement: 'topRight',
        duration: 5,
        style: this.notificationStyle,
        onClose: () => {
          this.isProcessing = false;
          // Use setTimeout to prevent stack overflow with rapid notifications
          setTimeout(() => this.processQueue(), 0);
        },
      });
    } else {
      this.isProcessing = false;
    }
  };

  public addNotification = (notificationData: IWorklenzNotification) => {
    // Prevent queue overflow
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('Notification queue is full, dropping oldest notification');
      this.queue.shift();
    }
    
    this.queue.push(notificationData);
    this.processQueue();
  };

  public clearQueue = () => {
    this.queue.length = 0;
    this.isProcessing = false;
  };

  public getQueueLength = () => this.queue.length;
}

const notificationManager = new NotificationQueueManager();

export const showNotification = (notificationData: IWorklenzNotification) => {
  notificationManager.addNotification(notificationData);
};

export const clearNotificationQueue = () => {
  notificationManager.clearQueue();
};

export const getNotificationQueueLength = () => {
  return notificationManager.getQueueLength();
};
