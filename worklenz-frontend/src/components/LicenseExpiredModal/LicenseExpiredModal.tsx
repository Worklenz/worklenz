import { Modal, Button, Typography, Space, Card, Tag } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ClockCircleOutlined, CrownOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { supportApiService } from '@/api/support/support.api.service';
import { useAuthService } from '@/hooks/useAuth';

const { Title, Text, Paragraph } = Typography;

interface LicenseExpiredModalProps {
  open: boolean;
  subscriptionType?: ISUBSCRIPTION_TYPE;
}

export const LicenseExpiredModal = ({ open, subscriptionType = ISUBSCRIPTION_TYPE.TRIAL }: LicenseExpiredModalProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const authService = useAuthService();
  const [visible, setVisible] = useState(open);
  const [isContactingSupport, setIsContactingSupport] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  useEffect(() => {
    setVisible(open);
    // Prevent scrolling when modal is open and add custom backdrop
    if (open) {
      document.body.style.overflow = 'hidden';
      
      // Create custom backdrop that excludes navbar
      const backdrop = document.createElement('div');
      backdrop.id = 'license-modal-backdrop';
      backdrop.style.cssText = `
        position: fixed;
        top: 64px;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(4px);
        z-index: 999;
        pointer-events: none;
      `;
      document.body.appendChild(backdrop);
    }
    
    return () => {
      document.body.style.overflow = 'unset';
      const backdrop = document.getElementById('license-modal-backdrop');
      if (backdrop) {
        document.body.removeChild(backdrop);
      }
    };
  }, [open]);

  const handleUpgrade = async () => {
    if (subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM) {
      if (messageSent) return; // Prevent multiple clicks after message is sent
      
      try {
        setIsContactingSupport(true);
        
        // Get current session data
        const currentSession = authService?.getCurrentSession();
        
        await supportApiService.contactSupport({
          subscription_type: subscriptionType,
          reason: 'Custom plan renewal/support request'
        });

        setMessageSent(true);
        // Success message is handled by the API client interceptor
      } catch (error) {
        console.error('Failed to contact support:', error);
        // Error message is handled by the API client interceptor
      } finally {
        setIsContactingSupport(false);
      }
    } else {
      navigate('/worklenz/admin-center/billing');
    }
  };

  // Get subscription-specific translations
  const getTitle = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.TRIAL:
        return t('license-expired-trial-title');
      case ISUBSCRIPTION_TYPE.CUSTOM:
        return t('license-expired-custom-title');
      default:
        return t('license-expired-title');
    }
  };

  const getSubtitle = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.TRIAL:
        return t('license-expired-trial-subtitle');
      case ISUBSCRIPTION_TYPE.CUSTOM:
        return t('license-expired-custom-subtitle');
      default:
        return t('license-expired-subtitle');
    }
  };

  const getFeaturesTitle = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.TRIAL:
        return t('license-expired-trial-features');
      case ISUBSCRIPTION_TYPE.CUSTOM:
        return t('license-expired-custom-features');
      default:
        return t('license-expired-features');
    }
  };

  const getUpgradeText = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.TRIAL:
        return t('license-expired-trial-upgrade');
      case ISUBSCRIPTION_TYPE.CUSTOM:
        return t('license-expired-custom-upgrade');
      default:
        return t('license-expired-upgrade');
    }
  };

  const getUpgradeIcon = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.CUSTOM:
        return <CustomerServiceOutlined />;
      default:
        return <CrownOutlined />;
    }
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
      mask={false}
      style={{ 
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000
      }}
      wrapClassName="license-expired-modal-wrap"
    >
      <div style={{ padding: '20px 0' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          {/* Icon and Title */}
          <div>
            <ClockCircleOutlined style={{ fontSize: 64, color: '#1890ff', marginBottom: 16 }} />
            <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
              {getTitle()}
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 16, marginBottom: 0 }}>
              {getSubtitle()}
            </Paragraph>
          </div>

          {/* Features Card */}
          <Card 
            style={{ 
              backgroundColor: '#e6f7ff', 
              border: '1px solid #91d5ff',
              marginTop: 24 
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                {getFeaturesTitle()}
              </Text>
              <Space direction="vertical" size="small" align="start" style={{ width: '100%', marginTop: 12 }}>
                {features.map((feature, index) => (
                  <Text key={index} style={{ fontSize: 14 }}>
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
            loading={isContactingSupport && subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM}
            icon={!isContactingSupport ? getUpgradeIcon() : undefined}
            style={{ 
              minWidth: 200, 
              height: 48,
              fontSize: 16,
              marginTop: 8,
              background: subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM 
                ? 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)'
                : 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
              border: 'none',
              boxShadow: '0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08)'
            }}
          >
            {subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM 
              ? (messageSent 
                  ? t('license-expired-message-sent') 
                  : (isContactingSupport 
                      ? t('license-expired-contacting-support') 
                      : getUpgradeText()
                    )
                )
              : getUpgradeText()
            }
          </Button>

          {/* Note */}
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            <Tag color="blue" style={{ marginRight: 4 }}>Note</Tag>
            {t('trial-alert-admin-note')}
          </Text>
        </Space>
      </div>
    </Modal>
  );
};