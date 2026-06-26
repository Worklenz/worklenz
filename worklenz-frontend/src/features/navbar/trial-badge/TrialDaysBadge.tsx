import { useMemo } from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { useNavigate } from 'react-router-dom';
import './TrialDaysBadge.css';

export const TrialDaysBadge = () => {
  const { t } = useTranslation('common');
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const navigate = useNavigate();

  const trialInfo = useMemo(() => {
    // Show for the full trial period in navbar (not only near expiry)
    if (currentSession?.subscription_type !== ISUBSCRIPTION_TYPE.TRIAL) {
      return null;
    }

    const expireDateStr = currentSession.valid_till_date || currentSession.trial_expire_date;
    if (!expireDateStr) return null;

    const today = new Date();
    const expiryDate = new Date(expireDateStr);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Hide once trial has expired
    if (diffDays < 0) return null;

    const isLastDay = diffDays === 0;
    const isAboutToExpire = diffDays > 0 && diffDays <= 3;

    let badgeText = '';
    let badgeType: 'success' | 'warning' | 'critical' = 'success';
    let tooltipText = '';
    let icon = <ClockCircleOutlined />;
    let showShine = false;

    if (isLastDay) {
      badgeText = t('trial-badge-today');
      badgeType = 'critical';
      tooltipText = t('trial-expiring-today');
      icon = <ClockCircleOutlined />;
      showShine = true;
    } else if (isAboutToExpire) {
      badgeText = t('trial-badge-days', { days: diffDays });
      badgeType = 'warning';
      tooltipText = t('trial-expiring-soon', { days: diffDays, count: diffDays });
      icon = <ClockCircleOutlined />;
      showShine = false;
    } else {
      badgeText = t('trial-badge-days', { days: diffDays });
      badgeType = 'success';
      tooltipText = t('license-expired-days-remaining', { days: diffDays });
      icon = <ClockCircleOutlined />;
    }

    return {
      text: badgeText,
      type: badgeType,
      tooltip: tooltipText,
      icon,
      isLastDay,
      showShine,
      daysRemaining: diffDays,
    };
  }, [currentSession, t]);

  if (!trialInfo) return null;

  const handleClick = () => {
    navigate('/worklenz/admin-center/billing');
  };

  return (
    <Tooltip
      title={
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{trialInfo.tooltip}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            {t('business-trial-upgrade')}
          </div>
        </div>
      }
      placement="bottom"
    >
      <div
        className={`trial-badge trial-badge-${trialInfo.type}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
          }
        }}
      >
        <span className="trial-badge-icon">{trialInfo.icon}</span>
        <span className="trial-badge-text">{trialInfo.text}</span>
      </div>
    </Tooltip>
  );
};
