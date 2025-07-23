import { notification } from '@/shared/antd-imports';
import { IWorklenzNotification } from '@/types/notifications/notifications.types';
import { teamsApiService } from '@/api/teams/teams.api.service';
import { toQueryString } from '@/utils/toQueryString';
import { BankOutlined } from '@/shared/antd-imports';
import './push-notification-template.css';

const PushNotificationTemplate = ({
  notification: notificationData,
}: {
  notification: IWorklenzNotification;
}) => {
  const handleClick = async () => {
    if (notificationData.url) {
      let url = notificationData.url;
      if (notificationData.params && Object.keys(notificationData.params).length) {
        const q = toQueryString(notificationData.params);
        url += q;
      }

      if (notificationData.team_id) {
        await teamsApiService.setActiveTeam(notificationData.team_id);
      }

      window.location.href = url;
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`notification-content ${notificationData.url ? 'clickable' : ''}`}
      style={{
        cursor: notificationData.url ? 'pointer' : 'default',
        padding: '8px 0',
        borderRadius: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '8px',
          color: '#262626',
          fontSize: '14px',
          fontWeight: 500,
        }}
      >
        {notificationData.team && (
          <>
            <BankOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            {notificationData.team}
          </>
        )}
        {!notificationData.team && 'Worklenz'}
      </div>
      <div
        style={{
          color: '#595959',
          fontSize: '13px',
          lineHeight: '1.5',
          marginTop: '4px',
        }}
        dangerouslySetInnerHTML={{ __html: notificationData.message }}
      />
    </div>
  );
};

let notificationQueue: IWorklenzNotification[] = [];
let isProcessing = false;

const processNotificationQueue = () => {
  if (isProcessing || notificationQueue.length === 0) return;

  isProcessing = true;
  const notificationData = notificationQueue.shift();

  if (notificationData) {
    notification.info({
      message: null,
      description: <PushNotificationTemplate notification={notificationData} />,
      placement: 'topRight',
      duration: 5,
      style: {
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        padding: '12px 16px',
        minWidth: '300px',
        maxWidth: '400px',
      },
      onClose: () => {
        isProcessing = false;
        processNotificationQueue();
      },
    });
  } else {
    isProcessing = false;
  }
};

export const showNotification = (notificationData: IWorklenzNotification) => {
  notificationQueue.push(notificationData);
  processNotificationQueue();
};
