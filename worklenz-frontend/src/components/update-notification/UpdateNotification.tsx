// Update Notification Component
// Shows a passive banner when a new build is available

import React from 'react';
import { Alert, Button, Space, Typography } from '@/shared/antd-imports';
import { ReloadOutlined, CloseOutlined, DownloadOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useServiceWorker } from '../../utils/serviceWorkerRegistration';

const { Text } = Typography;

interface UpdateNotificationProps {
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ visible, onClose, onUpdate }) => {
  const { t } = useTranslation('common');
  const [isUpdating, setIsUpdating] = React.useState(false);
  const { hardReload } = useServiceWorker();

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      if (hardReload) {
        await hardReload();
      } else {
        // Fallback to regular reload
        window.location.reload();
      }
      onUpdate();
    } catch (error) {
      console.error('Error during update:', error);
      // Fallback to regular reload
      window.location.reload();
    }
  };

  const handleLater = () => {
    onClose();
  };

  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
        left: 0,
        right: 0,
        width: '100%',
        zIndex: 1100,
      }}
    >
      <div
        style={{
          width: '100%',
          padding: '8px 48px',
          background:
            'linear-gradient(90deg, rgba(24,144,255,0.08) 0%, rgba(54,207,201,0.08) 100%)',
          borderBottom: '1px solid rgba(24,144,255,0.22)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Alert
          message={
            <Space
              size="large"
              style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}
            >
              <Space size="middle" wrap>
                <DownloadOutlined style={{ color: '#1890ff' }} />
                <Text strong>
                  {t('update-banner-message', { defaultValue: 'A new version is available.' })}
                </Text>
                <Text type="secondary">
                  {t('update-banner-description', {
                    defaultValue: 'Refresh when you are ready to get the latest improvements.',
                  })}
                </Text>
              </Space>
              <Space>
                <Button
                  type="primary"
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={isUpdating}
                  onClick={handleUpdate}
                  style={{
                    background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
                    border: 'none',
                  }}
                >
                  {isUpdating
                    ? t('updating', { defaultValue: 'Updating...' })
                    : t('update-now', { defaultValue: 'Refresh' })}
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleLater}
                  disabled={isUpdating}
                  style={{ color: '#595959' }}
                  title={t('update-later', { defaultValue: 'Later' })}
                />
              </Space>
            </Space>
          }
          type="info"
          showIcon={false}
          closable={false}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '4px 0',
          }}
        />
      </div>
    </div>
  );
};

export default UpdateNotification;
