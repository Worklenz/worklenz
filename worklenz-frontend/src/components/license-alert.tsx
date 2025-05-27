import { Alert, Button, Space } from 'antd';
import { useState, useEffect } from 'react';
import { CrownOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { ILocalSession } from '@/types/auth/local-session.types';
import { LICENSE_ALERT_KEY } from '@/shared/constants';
import { format, isSameDay, differenceInDays, addDays, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface LicenseAlertProps {
  currentSession: ILocalSession;
  onVisibilityChange?: (visible: boolean) => void;
}

interface AlertConfig {
  type: 'success' | 'info' | 'warning' | 'error';
  message: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  licenseType: 'trial' | 'expired' | 'expiring';
  daysRemaining: number;
}

const LicenseAlert = ({ currentSession, onVisibilityChange }: LicenseAlertProps) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);

  const handleClose = () => {
    setVisible(false);
    setLastAlertDate(new Date());
  };

  const getLastAlertDate = () => {
    const lastAlertDate = localStorage.getItem(LICENSE_ALERT_KEY);
    return lastAlertDate ? new Date(lastAlertDate) : null;
  };

  const setLastAlertDate = (date: Date) => {
    localStorage.setItem(LICENSE_ALERT_KEY, format(date, 'yyyy-MM-dd'));
  };

  const handleUpgrade = () => {
    navigate('/worklenz/admin-center/billing');
  };

  const handleExtend = () => {
    navigate('/worklenz/admin-center/billing');
  };

  const getVisibleAndConfig = (): { visible: boolean; config: AlertConfig | null } => {
    const lastAlertDate = getLastAlertDate();
    
    // Check if alert was already shown today
    if (lastAlertDate && isSameDay(lastAlertDate, new Date())) {
      return { visible: false, config: null };
    }

    if (!currentSession.valid_till_date) {
      return { visible: false, config: null };
    }

    let validTillDate = new Date(currentSession.valid_till_date);
    const today = new Date();
    
    // If validTillDate is after today, add 1 day (matching Angular logic)
    if (isAfter(validTillDate, today)) {
      validTillDate = addDays(validTillDate, 1);
    }

    // Calculate the difference in days between the two dates
    const daysDifference = differenceInDays(validTillDate, today);
    
    // Don't show if no valid_till_date or difference is >= 7 days
    if (daysDifference >= 7) {
      return { visible: false, config: null };
    }

    const absDaysDifference = Math.abs(daysDifference);
    const dayText = `${absDaysDifference} day${absDaysDifference === 1 ? '' : 's'}`;

    let string1 = '';
    let string2 = dayText;
    let licenseType: 'trial' | 'expired' | 'expiring' = 'expiring';
    let alertType: 'success' | 'info' | 'warning' | 'error' = 'warning';

    if (currentSession.subscription_status === 'trialing') {
      licenseType = 'trial';
      if (daysDifference < 0) {
        string1 = 'Your Worklenz trial expired';
        string2 = string2 + ' ago';
        alertType = 'error';
        licenseType = 'expired';
      } else if (daysDifference !== 0 && daysDifference < 7) {
        string1 = 'Your Worklenz trial expires in';
      } else if (daysDifference === 0 && daysDifference < 7) {
        string1 = 'Your Worklenz trial expires';
        string2 = 'today';
      }
    } else if (currentSession.subscription_status === 'active') {
      if (daysDifference < 0) {
        string1 = 'Your Worklenz subscription expired';
        string2 = string2 + ' ago';
        alertType = 'error';
        licenseType = 'expired';
      } else if (daysDifference !== 0 && daysDifference < 7) {
        string1 = 'Your Worklenz subscription expires in';
      } else if (daysDifference === 0 && daysDifference < 7) {
        string1 = 'Your Worklenz subscription expires';
        string2 = 'today';
      }
    } else {
      return { visible: false, config: null };
    }

    const config: AlertConfig = {
      type: alertType,
      message: (
        <>
          Action required! {string1} <strong>{string2}</strong>
        </>
      ),
      description: '',
      icon: licenseType === 'expired' || licenseType === 'trial' ? <CrownOutlined /> : <ClockCircleOutlined />,
      licenseType,
      daysRemaining: absDaysDifference
    };

    return { visible: true, config };
  };

  useEffect(() => {
    const { visible: shouldShow, config } = getVisibleAndConfig();
    setVisible(shouldShow);
    setAlertConfig(config);
    
    // Notify parent about visibility change
    if (onVisibilityChange) {
      onVisibilityChange(shouldShow);
    }
  }, [currentSession, onVisibilityChange]);

  const alertStyles = {
    margin: 0,
    borderRadius: 0,
  } as const;

  const actionButtons = alertConfig && (
    <Space>
      {/* Show button only if user is owner or admin */}
      {(currentSession.owner || currentSession.is_admin) && (
        <Button 
          type="primary" 
          size="small" 
          onClick={currentSession.subscription_status === 'trialing' ? handleUpgrade : handleExtend}
        >
          {currentSession.subscription_status === 'trialing' ? 'Upgrade now' : 'Go to Billing'}
        </Button>
      )}
    </Space>
  );

  if (!visible || !alertConfig) {
    return null;
  }

  return (
    <div data-license-alert>
      <Alert
        message={alertConfig.message}
        type={alertConfig.type}
        closable
        onClose={handleClose}
        style={{
          ...alertStyles,
          fontWeight: 500,
        }}
        showIcon
        action={actionButtons}
      />
    </div>
  );
};

export default LicenseAlert; 