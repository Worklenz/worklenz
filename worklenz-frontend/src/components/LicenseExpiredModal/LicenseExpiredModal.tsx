import { Modal, Button, Typography, Space, Card, Tag } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ClockCircleOutlined, CrownOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface LicenseExpiredModalProps {
  open: boolean;
}

export const LicenseExpiredModal = ({ open }: LicenseExpiredModalProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    setVisible(open);
    // Prevent scrolling when modal is open
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  const handleUpgrade = () => {
    navigate('/worklenz/admin-center/billing');
  };

  const features = [
    t('license-expired-feature-1'),
    t('license-expired-feature-2'),
    t('license-expired-feature-3'),
    t('license-expired-feature-4'),
  ];

  return (
    <Modal
      open={visible}
      closable={false}
      footer={null}
      centered
      width={600}
      maskClosable={false}
      keyboard={false}
      maskStyle={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)'
      }}
      style={{ top: 20 }}
    >
      <div style={{ padding: '20px 0' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          {/* Icon and Title */}
          <div>
            <ClockCircleOutlined style={{ fontSize: 64, color: '#faad14', marginBottom: 16 }} />
            <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
              {t('license-expired-title')}
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 16, marginBottom: 0 }}>
              {t('license-expired-subtitle')}
            </Paragraph>
          </div>

          {/* Features Card */}
          <Card 
            style={{ 
              backgroundColor: '#f6ffed', 
              border: '1px solid #b7eb8f',
              marginTop: 24 
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong style={{ fontSize: 16, color: '#52c41a' }}>
                {t('license-expired-features')}
              </Text>
              <Space direction="vertical" size="small" align="start" style={{ width: '100%', marginTop: 12 }}>
                {features.map((feature, index) => (
                  <Text key={index} style={{ fontSize: 14, color: '#595959' }}>
                    {feature}
                  </Text>
                ))}
              </Space>
            </Space>
          </Card>

          {/* Upgrade Button */}
          <Button
            type="primary"
            size="large"
            onClick={handleUpgrade}
            icon={<CrownOutlined />}
            style={{ 
              minWidth: 200, 
              height: 48,
              fontSize: 16,
              marginTop: 8,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              boxShadow: '0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08)'
            }}
          >
            {t('license-expired-upgrade')}
          </Button>

          {/* Note */}
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            <Tag color="orange" style={{ marginRight: 4 }}>Note</Tag>
            {t('trial-alert-admin-note')}
          </Text>
        </Space>
      </div>
    </Modal>
  );
};