// Update Notification Component
// Shows a notification when new build is available and provides update options

import React from 'react';
import { Modal, Button, Space, Typography } from '@/shared/antd-imports';
import { ReloadOutlined, CloseOutlined, DownloadOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useServiceWorker } from '../../utils/serviceWorkerRegistration';

const { Text, Title } = Typography;

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

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DownloadOutlined style={{ color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
            {t('update-available')}
          </Title>
        </div>
      }
      open={visible}
      onCancel={handleLater}
      footer={null}
      centered
      closable={false}
      maskClosable={false}
      width={460}
      styles={{
        body: { padding: '20px 24px' },
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <Text style={{ fontSize: '16px', lineHeight: '1.6' }}>{t('update-description')}</Text>
        <br />
        <br />
        <Text style={{ fontSize: '14px', color: '#8c8c8c' }}>{t('update-instruction')}</Text>
      </div>

      <div
        style={{
          background: '#f6ffed',
          border: '1px solid #b7eb8f',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
        }}
      >
        <Text style={{ fontSize: '13px', color: '#389e0d' }}>
          {t('update-whats-new', {
            interpolation: { escapeValue: false },
          })}
        </Text>
      </div>

      <Space
        style={{
          width: '100%',
          justifyContent: 'flex-end',
        }}
        size="middle"
      >
        <Button icon={<CloseOutlined />} onClick={handleLater} disabled={isUpdating}>
          {t('update-later')}
        </Button>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={isUpdating}
          onClick={handleUpdate}
        >
          {isUpdating ? t('updating') : t('update-now')}
        </Button>
      </Space>
    </Modal>
  );
};

export default UpdateNotification;
