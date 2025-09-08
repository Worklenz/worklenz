import { Button, Tooltip, Badge, Modal } from '@/shared/antd-imports';
import React, { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import {
  CrownOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import type {
  UserPersonalization,
  PricingCalculation,
} from '@/components/pricing-modal/PricingModal';
import { fetchBillingInfo } from '@/features/admin-center/admin-center.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { 
  MixpanelBillingEvents, 
  UpgradeButtonEventProps,
  PricingModalEventProps,
  UserType 
} from '@/types/mixpanel-events.types';

// Lazy load the PricingModal to avoid circular dependencies and improve performance
const PricingModal = lazy(() => import('@/components/pricing-modal/PricingModal'));

interface UpgradePlanButtonProps {
  showModal?: boolean;
  redirectToBilling?: boolean;
}

const UpgradePlanButton: React.FC<UpgradePlanButtonProps> = ({
  showModal = false,
  redirectToBilling = true,
}) => {
  // localization
  const { t } = useTranslation('navbar');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [isAppSumoUser, setIsAppSumoUser] = useState(false);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const currentSession = authService.getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Detect AppSumo user
  const checkAppSumoUser = useCallback(() => {
    const planName = billingInfo?.plan_name?.toLowerCase() || '';
    const subscriptionType = currentSession?.subscription_type?.toLowerCase() || '';

    return (
      planName.includes('appsumo') ||
      subscriptionType.includes('appsumo') ||
      planName.includes('lifetime') ||
      subscriptionType.includes('lifetime')
    );
  }, [billingInfo, currentSession]);

  useEffect(() => {
    // Fetch billing info if not loaded
    if (!billingInfo) {
      dispatch(fetchBillingInfo());
    }
  }, [dispatch, billingInfo]);

  useEffect(() => {
    // Check if AppSumo user
    setIsAppSumoUser(checkAppSumoUser());

    // Calculate days remaining for expirable subscription types
    const expirableTypes = [
      ISUBSCRIPTION_TYPE.TRIAL,
      ISUBSCRIPTION_TYPE.PADDLE,
      ISUBSCRIPTION_TYPE.CUSTOM,
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
  }, [currentSession, checkAppSumoUser]);

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
    if (isAppSumoUser) return <RocketOutlined />;
    if (daysRemaining === 0) return <ThunderboltOutlined />;
    if (daysRemaining !== null && daysRemaining <= 3) return <ClockCircleOutlined />;
    return <CrownOutlined />;
  };

  // Helper function to get user type for tracking
  const getUserType = useCallback((): UserType => {
    if (isAppSumoUser) return 'appsumo';
    if (currentSession?.subscription_type === ISUBSCRIPTION_TYPE.TRIAL) return 'trial';
    if (currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE) return 'free';
    return 'paid';
  }, [isAppSumoUser, currentSession]);

  // Helper function to get badge state for tracking
  const getBadgeState = useCallback(() => {
    if (isAppSumoUser) return 'appsumo';
    if (daysRemaining === 0) return 'last_day';
    if (daysRemaining !== null && daysRemaining <= 7) return 'trial_expiring';
    return null;
  }, [isAppSumoUser, daysRemaining]);

  // Helper function to get button style type for tracking
  const getButtonStyleType = useCallback(() => {
    if (isAppSumoUser) return 'appsumo';
    if (daysRemaining === 0) return 'urgent';
    if (daysRemaining !== null && daysRemaining <= 3) return 'warning';
    return 'default';
  }, [isAppSumoUser, daysRemaining]);

  // Create user personalization object for pricing modal
  const userPersonalization: UserPersonalization | undefined = useMemo(() => {
    if (!billingInfo) return undefined;

    const userType = isAppSumoUser
      ? 'appsumo'
      : currentSession?.subscription_type === ISUBSCRIPTION_TYPE.TRIAL
        ? 'trial'
        : currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE
          ? 'free'
          : 'paid';

    return {
      userType,
      currentPlan: billingInfo.plan_name,
      trialDaysRemaining: daysRemaining || undefined,
    };
  }, [billingInfo, isAppSumoUser, currentSession, daysRemaining]);

  const handlePlanSelect = useCallback(
    (calculation: PricingCalculation) => {
      console.log('Plan selected:', calculation);
      setShowPricingModal(false);
      navigate('/worklenz/admin-center/billing');
    },
    [navigate]
  );

  const handleModalClose = useCallback(() => {
    setShowPricingModal(false);
    // Track modal close event
    trackMixpanelEvent(MixpanelBillingEvents.PRICING_MODAL_CLOSED, {
      user_type: getUserType(),
      current_plan: billingInfo?.plan_name,
      is_appsumo_user: isAppSumoUser,
      trigger_source: 'upgrade_button',
    });
  }, [trackMixpanelEvent, getUserType, billingInfo, isAppSumoUser]);

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

    if (isAppSumoUser) {
      return {
        ...baseStyles,
        background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
        color: '#fff',
      };
    }

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
      onClick={() => {
        // Track upgrade button click
        const eventProps: UpgradeButtonEventProps = {
          user_type: getUserType(),
          current_plan: billingInfo?.plan_name,
          trial_days_remaining: daysRemaining || undefined,
          is_appsumo_user: isAppSumoUser,
          team_size: billingInfo?.total_used,
          subscription_status: billingInfo?.status,
          source_location: showModal ? 'navbar_modal' : 'navbar_redirect',
          badge_state: getBadgeState() as any,
          button_style: getButtonStyleType() as any,
        };
        trackMixpanelEvent(MixpanelBillingEvents.UPGRADE_BUTTON_CLICKED, eventProps);

        if (showModal) {
          setShowPricingModal(true);
          // Track modal open event
          const modalProps: PricingModalEventProps = {
            user_type: getUserType(),
            current_plan: billingInfo?.plan_name,
            trial_days_remaining: daysRemaining || undefined,
            is_appsumo_user: isAppSumoUser,
            team_size: billingInfo?.total_used,
            subscription_status: billingInfo?.status,
            trigger_source: 'upgrade_button',
            initial_team_size: billingInfo?.total_used,
          };
          trackMixpanelEvent(MixpanelBillingEvents.PRICING_MODAL_OPENED, modalProps);
        } else if (redirectToBilling) {
          navigate('/worklenz/admin-center/billing');
        }
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow =
          themeMode === 'dark' ? '0 4px 8px rgba(0,0,0,0.3)' : '0 4px 8px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow =
          themeMode === 'dark' ? '0 2px 4px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.05)';
      }}
    >
      {t('upgradePlan')}
    </Button>
  );

  const getTooltipContent = () => {
    if (isAppSumoUser) {
      return (
        <div style={{ textAlign: 'center' }}>
          <RocketOutlined style={{ fontSize: '16px', marginBottom: '4px' }} />
          <div>AppSumo Lifetime Deal Member</div>
          <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
            Upgrade to Business or Enterprise plans
          </div>
        </div>
      );
    }

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

  // Determine if we should show the badge
  const shouldShowBadge = daysRemaining !== null;

  return (
    <>
      {(
        <Tooltip title={getTooltipContent()} placement="bottom">
          {button}
        </Tooltip>
      )}

      {/* Pricing Modal with lazy loading */}
      {showPricingModal && (
        <Suspense
          fallback={
            <Modal open={true} footer={null} closable={false}>
              <div style={{ textAlign: 'center', padding: '20px' }}>Loading pricing options...</div>
            </Modal>
          }
        >
          <PricingModal
            visible={showPricingModal}
            onClose={handleModalClose}
            onPlanSelect={handlePlanSelect}
            userPersonalization={userPersonalization}
            organizationId={currentSession?.team_id}
            defaultPricingModel={isAppSumoUser ? 'BASE_PLAN' : 'PER_USER'}
            defaultBillingCycle="YEARLY"
          />
        </Suspense>
      )}
    </>
  );
};

export default UpgradePlanButton;

// Export types for external usage
export type { UpgradePlanButtonProps };
