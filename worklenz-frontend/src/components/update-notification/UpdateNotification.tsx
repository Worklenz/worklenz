// Update Notification Component
// Shows a passive banner when a new build is available

import React from 'react';
import { Alert, Button, Space, Typography, theme } from '@/shared/antd-imports';
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
  const { token } = theme.useToken();
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
        top: 'env(safe-area-inset-top, 0px)',
        left: 0,
        right: 0,
        width: '100%',
        zIndex: 1100,
      }}
    >
      <div
        style={{
          width: '100%',
          padding: '12px 24px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        <Alert
          message={
            <Space
              size="large"
              style={{
                width: '100%',
                justifyContent: 'space-between',
                alignItems: 'center',
                rowGap: 12,
                columnGap: 16,
                flexWrap: 'wrap',
              }}
            >
              <Space size="middle" wrap align="center">
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: token.colorInfoBg,
                    color: token.colorInfo,
                    flexShrink: 0,
                  }}
                >
                  <DownloadOutlined />
                </div>
                <Text strong style={{ color: token.colorText }}>
                  {t('update-banner-message', { defaultValue: 'A new version is available.' })}
                </Text>
                <Text style={{ color: token.colorTextSecondary }}>
                  {t('update-banner-description', {
                    defaultValue: 'Refresh when you are ready to get the latest improvements.',
                  })}
                </Text>
              </Space>
              <Space wrap>
                <Button
                  type="primary"
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={isUpdating}
                  onClick={handleUpdate}
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
                  aria-label={t('update-later', { defaultValue: 'Later' })}
                  style={{ color: token.colorTextSecondary }}
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
            padding: 0,
          }}
        />
      </div>
    </div>
  );
};

export default UpdateNotification;
