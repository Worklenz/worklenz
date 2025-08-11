import { Alert, Button, Space } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CloseOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuthService } from '@/hooks/useAuth';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';

export const TrialExpirationAlert = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const authService = useAuthService();
  const [visible, setVisible] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  
  const currentSession = authService.getCurrentSession();

  useEffect(() => {
    // Check if user has already dismissed this alert today
    const dismissedDate = localStorage.getItem('license-alert-dismissed');
    const today = new Date().toDateString();
    
    if (dismissedDate === today) {
      setVisible(false);
      return;
    }

    // Calculate days remaining for expirable subscription types
    const expirableTypes = [
      ISUBSCRIPTION_TYPE.TRIAL,
      ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL,
      ISUBSCRIPTION_TYPE.PADDLE,
      ISUBSCRIPTION_TYPE.CUSTOM
    ];

    if (
      expirableTypes.includes(currentSession?.subscription_type as ISUBSCRIPTION_TYPE) &&
      (currentSession.valid_till_date || currentSession.trial_expire_date)
    ) {
      const today = new Date();
      const expireDateStr = currentSession.valid_till_date || currentSession.trial_expire_date;
      const expiryDate = new Date(expireDateStr);
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Show alert if:
      // 1. 3 days or less remaining before expiry (diffDays <= 3 && diffDays >= 0)
      // 2. Within 7 days grace period after expiry (diffDays < 0 && diffDays >= -7)
      if ((diffDays <= 3 && diffDays >= 0) || (diffDays < 0 && diffDays >= -7)) {
        setDaysRemaining(diffDays);
        setVisible(true);
      } else {
        setVisible(false);
      }
    } else {
      setVisible(false);
    }
  }, [currentSession]);

  const handleClose = () => {
    setVisible(false);
    // Remember dismissal for today only
    localStorage.setItem('license-alert-dismissed', new Date().toDateString());
  };

  const handleUpgrade = () => {
    navigate('/worklenz/admin-center/billing');
  };

  if (!visible || daysRemaining === null) {
    return null;
  }

  const getAlertType = () => {
    if (daysRemaining !== null && daysRemaining < 0) return 'error'; // Already expired
    if (daysRemaining === 0) return 'error';
    if (daysRemaining === 1) return 'warning';
    return 'info';
  };

  const getMessage = () => {
    if (daysRemaining !== null && daysRemaining < 0) {
      const daysExpired = Math.abs(daysRemaining);
      const remainingGraceDays = 7 - daysExpired;
      return t('license-expired-grace-period', { 
        days: remainingGraceDays, 
        count: remainingGraceDays 
      });
    }
    if (daysRemaining === 0) {
      return t('license-expiring-today');
    }
    return t('license-expiring-soon', { days: daysRemaining, count: daysRemaining });
  };

  return (
    <div style={{ 
      width: '100%',
      padding: '8px 48px',
      background: 'linear-gradient(90deg, rgba(250,173,20,0.1) 0%, rgba(245,34,45,0.1) 100%)',
      borderBottom: '1px solid rgba(250,173,20,0.3)',
      backdropFilter: 'blur(10px)'
    }}>
      <Alert
        message={
          <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <ExclamationCircleOutlined />
              <span style={{ fontWeight: 500 }}>{getMessage()}</span>
              <span style={{ opacity: 0.8, fontSize: 13 }}>
                {t('license-expiring-upgrade')}
              </span>
            </Space>
            <Space>
              <Button 
                type="primary" 
                size="small"
                onClick={handleUpgrade}
                style={{
                  background: daysRemaining === 0 
                    ? 'linear-gradient(135deg, #f5222d 0%, #ff4d4f 100%)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none'
                }}
              >
                {t('license-expired-upgrade')}
              </Button>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleClose}
                style={{ color: '#595959' }}
                title={t('trial-alert-dismiss')}
              />
            </Space>
          </Space>
        }
        type={getAlertType()}
        showIcon={false}
        closable={false}
        style={{ 
          border: 'none',
          background: 'transparent',
          padding: '4px 0'
        }}
      />
    </div>
  );
};