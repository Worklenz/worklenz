import { Button, Tooltip, Badge } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { CrownOutlined, ClockCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';

const UpgradePlanButton = () => {
  // localization
  const { t } = useTranslation('navbar');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const authService = useAuthService();
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const currentSession = authService.getCurrentSession();

  useEffect(() => {
    // Calculate days remaining for expirable subscription types
    const expirableTypes = [
      ISUBSCRIPTION_TYPE.TRIAL,
      ISUBSCRIPTION_TYPE.PADDLE,
      ISUBSCRIPTION_TYPE.CUSTOM
    ];

    if (
      expirableTypes.includes(currentSession?.subscription_type as ISUBSCRIPTION_TYPE) &&
      (currentSession?.valid_till_date || currentSession?.trial_expire_date)
    ) {
      const today = new Date();
      const expireDateStr = currentSession.valid_till_date || currentSession.trial_expire_date;
      const expiryDate = new Date(expireDateStr!);
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Show badge if 7 days or less remaining
      if (diffDays <= 7 && diffDays >= 0) {
        setDaysRemaining(diffDays);
      } else {
        setDaysRemaining(null);
      }
    }
  }, [currentSession]);

  const getBadgeColor = () => {
    if (daysRemaining === null) return undefined;
    if (daysRemaining === 0) return '#ff4d4f';
    if (daysRemaining <= 3) return '#faad14';
    return '#52c41a';
  };

  const getBadgeText = () => {
    if (daysRemaining === null) return '';
    if (daysRemaining === 0) return tCommon('license-badge-today');
    return tCommon('license-badge-days', { days: daysRemaining });
  };

  const getButtonIcon = () => {
    if (daysRemaining === 0) return <ThunderboltOutlined />;
    if (daysRemaining !== null && daysRemaining <= 3) return <ClockCircleOutlined />;
    return <CrownOutlined />;
  };

  const getButtonStyles = () => {
    const isDark = themeMode === 'dark';
    const baseStyles = {
      padding: '5px 16px',
      height: '32px',
      borderRadius: '6px',
      fontWeight: 500,
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)',
      border: 'none',
      boxShadow: isDark ? '0 2px 4px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.05)',
    };

    if (daysRemaining === 0) {
      return {
        ...baseStyles,
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ff4d4f 100%)',
        color: '#fff',
      };
    }
    
    if (daysRemaining !== null && daysRemaining <= 3) {
      return {
        ...baseStyles,
        background: 'linear-gradient(135deg, #ffc53d 0%, #faad14 100%)',
        color: '#fff',
      };
    }

    return {
      ...baseStyles,
      background: isDark 
        ? 'linear-gradient(135deg, #d4a574 0%, #b38750 100%)' 
        : 'linear-gradient(135deg, #fef3d7 0%, #fde8b5 100%)',
      color: isDark ? '#fff' : '#8b6914',
    };
  };

  const button = (
    <Button
      style={getButtonStyles()}
      size="small"
      type="primary"
      icon={getButtonIcon()}
      onClick={() => navigate('/worklenz/admin-center/billing')}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = themeMode === 'dark' 
          ? '0 4px 8px rgba(0,0,0,0.3)' 
          : '0 4px 8px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = themeMode === 'dark' 
          ? '0 2px 4px rgba(0,0,0,0.2)' 
          : '0 2px 4px rgba(0,0,0,0.05)';
      }}
    >
      {t('upgradePlan')}
    </Button>
  );

  const getTooltipContent = () => {
    if (daysRemaining === 0) {
      return (
        <div style={{ textAlign: 'center' }}>
          <ThunderboltOutlined style={{ fontSize: '16px', marginBottom: '4px' }} />
          <div>{tCommon('license-badge-today')}</div>
          <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
            {t('upgradePlanTooltip')}
          </div>
        </div>
      );
    }
    
    if (daysRemaining !== null && daysRemaining <= 7) {
      return (
        <div style={{ textAlign: 'center' }}>
          <ClockCircleOutlined style={{ fontSize: '16px', marginBottom: '4px' }} />
          <div>{getBadgeText()}</div>
          <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
            {t('upgradePlanTooltip')}
          </div>
        </div>
      );
    }
    
    return t('upgradePlanTooltip');
  };

  if (daysRemaining !== null) {
    return (
      <Tooltip 
        title={getTooltipContent()}
        placement="bottom"
        overlayStyle={{ maxWidth: '280px' }}
      >
        <Badge 
          count={getBadgeText()} 
          style={{ 
            backgroundColor: getBadgeColor(),
            fontSize: '11px',
            height: '20px',
            lineHeight: '20px',
            padding: '0 8px',
            borderRadius: '10px',
            fontWeight: 600,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            animation: daysRemaining === 0 ? 'pulse 2s infinite' : undefined,
          }}
        >
          <style>
            {`
              @keyframes pulse {
                0% {
                  box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.7);
                }
                70% {
                  box-shadow: 0 0 0 10px rgba(255, 77, 79, 0);
                }
                100% {
                  box-shadow: 0 0 0 0 rgba(255, 77, 79, 0);
                }
              }
            `}
          </style>
          {button}
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip 
      title={getTooltipContent()}
      placement="bottom"
    >
      {button}
    </Tooltip>
  );
};

export default UpgradePlanButton;
