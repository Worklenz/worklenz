import { Button, Tooltip, Badge } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';

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
    return '#1890ff';
  };

  const getBadgeText = () => {
    if (daysRemaining === null) return '';
    if (daysRemaining === 0) return tCommon('license-badge-today');
    return tCommon('license-badge-days', { days: daysRemaining });
  };

  const button = (
    <Button
      style={{
        backgroundColor: themeMode === 'dark' ? '#b38750' : colors.lightBeige,
        color: '#000000d9',
        padding: '4px 11px',
      }}
      size="small"
      type="text"
      onClick={() => navigate('/worklenz/admin-center/billing')}
    >
      {t('upgradePlan')}
    </Button>
  );

  if (daysRemaining !== null) {
    return (
      <Tooltip title={t('upgradePlanTooltip')}>
        <Badge 
          count={getBadgeText()} 
          style={{ 
            backgroundColor: getBadgeColor(),
            fontSize: 11,
            height: 18,
            lineHeight: '18px',
            padding: '0 6px'
          }}
        >
          {button}
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={t('upgradePlanTooltip')}>
      {button}
    </Tooltip>
  );
};

export default UpgradePlanButton;
