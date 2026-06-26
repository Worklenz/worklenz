import { Alert, Button, Space, Spin, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  CloseOutlined,
  GiftOutlined,
  ClockCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useAuthService } from '@/hooks/useAuth';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { PlanTrialApiService } from '@/api/admin-center/plan-trial.api.service';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  MixpanelBillingEvents,
  BusinessTrialEventProps,
  BusinessTrialStartEventProps,
  BusinessTrialStatusEventProps,
} from '@/types/mixpanel-events.types';
import { authApiService } from '@/api/auth/auth.api.service';
import { setSession } from '@/utils/session-helper';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setUser } from '@/features/user/userSlice';
import logger from '@/utils/errorLogger';

const DISMISS_KEY = 'business-trial-alert-dismissed';

export const BusinessPlanTrialAlert = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const { isOnBusinessTrial: isOnTrial, planTrialDaysRemaining: trialDaysRemaining } =
    useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);

  const currentSession = authService.getCurrentSession();
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();

  // Helper function to create base trial properties
  const getBaseTrialProperties = (): BusinessTrialEventProps => ({
    user_type: isOnTrial
      ? 'trial'
      : currentSession?.subscription_type === ISUBSCRIPTION_TYPE.PADDLE
        ? 'paid'
        : 'free',
    current_plan: currentSession?.plan_name,
    trial_days_remaining: trialDaysRemaining,
    team_size: currentSession?.team_member_count,
    subscription_status: currentSession?.subscription_type,
    trial_type: 'business_plan' as const,
    trial_duration_days: 7,
    source_component: 'BusinessPlanTrialAlert',
    display_location: 'header_banner',
  });

  useEffect(() => {
    // Only show for owners/admins
    if (!isOwnerOrAdmin) {
      setVisible(false);
      return;
    }

    // Never show Business trial banner to AppSumo LTD users (they unlock Business by redeeming 5 codes)
    if (currentSession?.subscription_type === ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL) {
      setVisible(false);
      setEligibilityChecked(true);
      return;
    }

    // Check if user has dismissed today
    const dismissedDate = localStorage.getItem(DISMISS_KEY);
    const today = new Date().toDateString();
    if (dismissedDate === today) {
      setVisible(false);
      return;
    }

    // Don't show for self-hosted or Annual Business license users
    const subscriptionType = currentSession?.subscription_type;
    if (
      subscriptionType === ISUBSCRIPTION_TYPE.SELF_HOSTED ||
      subscriptionType === ISUBSCRIPTION_TYPE.ANNUAL_BUSINESS
    ) {
      setVisible(false);
      return;
    }

    // Check if already on Business/Enterprise plan (both regular Paddle and AppSumo/Lifetime deals)
    const planName = currentSession?.plan_name?.toLowerCase() || '';
    const hasBusinessOrEnterprise =
      planName.includes('business') || planName.includes('enterprise');

    if (
      subscriptionType === ISUBSCRIPTION_TYPE.PADDLE ||
      subscriptionType === ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL
    ) {
      if (hasBusinessOrEnterprise) {
        setVisible(false);
        return;
      }
    }

    // If on Business trial, show the countdown
    if (isOnTrial) {
      setVisible(true);
      setEligibilityChecked(true);

      // Track trial status being viewed
      trackMixpanelEvent(MixpanelBillingEvents.BUSINESS_TRIAL_STATUS_CHECKED, {
        ...getBaseTrialProperties(),
        trial_active: true,
        days_elapsed: 7 - trialDaysRemaining,
        check_source: 'trial_status_banner',
      });

      return;
    }

    // Check eligibility for new trial
    checkTrialEligibility();
  }, [
    isOwnerOrAdmin,
    isOnTrial,
    currentSession?.subscription_type,
    currentSession?.plan_name,
    currentSession?.plan_trial_plan_id,
  ]);

  const checkTrialEligibility = async () => {
    setLoading(true);
    try {
      const response = await PlanTrialApiService.checkBusinessTrialEligibility();
      if (response.done && response.body) {
        const canStart = response.body.can_start_trial || false;
        setCanStartTrial(canStart);
        setVisible(canStart);

        // Track eligibility check result
        trackMixpanelEvent(MixpanelBillingEvents.BUSINESS_TRIAL_ELIGIBLE, {
          ...getBaseTrialProperties(),
          trial_active: false,
          check_source: 'component_mount',
        });

        if (canStart) {
          // Track that offer is being viewed
          trackMixpanelEvent(
            MixpanelBillingEvents.BUSINESS_TRIAL_OFFER_VIEWED,
            getBaseTrialProperties()
          );
        }
      }
    } catch (error) {
      console.error('Failed to check trial eligibility:', error);
      setVisible(false);
    } finally {
      setLoading(false);
      setEligibilityChecked(true);
    }
  };

  const handleStartTrial = async () => {
    setStarting(true);

    // Track trial start attempt
    const startEventProps: BusinessTrialStartEventProps = {
      ...getBaseTrialProperties(),
      start_method: 'banner_click',
      original_plan: currentSession?.plan_name as any,
    };

    try {
      const response = await PlanTrialApiService.startBusinessTrial();
      if (response.done) {
        // Track successful trial start
        trackMixpanelEvent(MixpanelBillingEvents.BUSINESS_TRIAL_STARTED, startEventProps);

        message.success(
          t('business-trial-started', {
            defaultValue: 'Business trial started successfully! Updating...',
          })
        );

        // Refetch user session data to get updated subscription info
        try {
          const authorizeResponse = await authApiService.verify();
          if (authorizeResponse.authenticated) {
            setSession(authorizeResponse.user);
            dispatch(setUser(authorizeResponse.user));
            authService.setCurrentSession(authorizeResponse.user);

            // Hide the alert after session update
            setVisible(false);

            // Optionally reload after a short delay to ensure all components are updated
            setTimeout(() => window.location.reload(), 1000);
          }
        } catch (verifyError) {
          logger.error('Error refreshing session after trial start', verifyError);
          // Fallback to full page reload if session refresh fails
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        message.error(
          response.message ||
            t('business-trial-start-failed', { defaultValue: 'Failed to start trial' })
        );
      }
    } catch (error: any) {
      message.error(
        error.response?.data?.message ||
          t('business-trial-start-failed', { defaultValue: 'Failed to start trial' })
      );
    } finally {
      setStarting(false);
    }
  };

  const handleUpgrade = () => {
    // Track upgrade button click (existing event)
    trackMixpanelEvent(MixpanelBillingEvents.BUSINESS_TRIAL_UPGRADE_INITIATED, {
      ...getBaseTrialProperties(),
      trial_active: isOnTrial,
      days_elapsed: isOnTrial ? 7 - trialDaysRemaining : undefined,
      check_source: 'upgrade_button_click',
    });

    // Track business trial upgrade nav bar click (new event)
    trackMixpanelEvent('business_trial_upgrade_nav_bar', {
      user_type: isOnTrial
        ? 'trial'
        : currentSession?.subscription_type === ISUBSCRIPTION_TYPE.PADDLE
          ? 'paid'
          : 'free',
      current_plan: currentSession?.plan_name,
      trial_days_remaining: trialDaysRemaining,
      trial_active: isOnTrial,
      days_elapsed: isOnTrial ? 7 - trialDaysRemaining : undefined,
      source: 'business_trial_banner',
    });

    // Open the upgrade plans modal directly
    promptUpgrade();
  };

  const handleDismiss = () => {
    // Track dismissal
    trackMixpanelEvent(MixpanelBillingEvents.BUSINESS_TRIAL_DISMISSED, {
      ...getBaseTrialProperties(),
      trial_active: isOnTrial,
      check_source: 'dismiss_button_click',
    });

    setVisible(false);
    // Remember dismissal for today only
    localStorage.setItem(DISMISS_KEY, new Date().toDateString());
  };

  // Don't show if not visible or still checking
  if (!visible || (!eligibilityChecked && !isOnTrial)) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          padding: '12px 48px',
          background:
            'linear-gradient(90deg, rgba(102,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%)',
          borderBottom: '1px solid rgba(102,126,234,0.2)',
          textAlign: 'center',
        }}
      >
        <Space>
          <Spin size="small" />
          <span>
            {t('business-trial-checking', { defaultValue: 'Checking trial availability...' })}
          </span>
        </Space>
      </div>
    );
  }

  // Active trial state - show countdown
  if (isOnTrial) {
    const getMessage = () => {
      if (trialDaysRemaining === 0) {
        return t('business-trial-expires-today', {
          defaultValue: 'Your Business trial expires today!',
        });
      } else if (trialDaysRemaining === 1) {
        return t('business-trial-days-remaining', {
          days: 1,
          defaultValue: '1 day remaining in your Business trial',
        });
      } else {
        return t('business-trial-days-remaining_plural', {
          days: trialDaysRemaining,
          defaultValue: `${trialDaysRemaining} days remaining in your Business trial`,
        });
      }
    };

    return (
      <div
        style={{
          width: '100%',
          padding: '8px 48px',
          background:
            'linear-gradient(90deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%)',
          borderBottom: '1px solid rgba(102,126,234,0.3)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Alert
          message={
            <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <ClockCircleOutlined style={{ color: '#722ed1' }} />
                <span style={{ fontWeight: 500 }}>
                  {t('business-trial-active', { defaultValue: 'Business Trial Active' })}
                </span>
                <span style={{ opacity: 0.9 }}>- {getMessage()}</span>
              </Space>
              <Space>
                <Button
                  type="primary"
                  size="small"
                  onClick={handleUpgrade}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                  }}
                >
                  {t('business-trial-upgrade', { defaultValue: 'Upgrade Now' })}
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleDismiss}
                  style={{ color: '#595959' }}
                  title={t('business-trial-dismiss', { defaultValue: 'Dismiss' })}
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
            padding: '4px 0',
          }}
        />
      </div>
    );
  }

  // Eligible for trial - show offer with start button
  if (canStartTrial) {
    return (
      <div
        style={{
          width: '100%',
          padding: '8px 48px',
          background: 'linear-gradient(90deg, rgba(255,165,0,0.08) 0%, rgba(255,193,7,0.08) 100%)',
          borderBottom: '1px solid rgba(255,165,0,0.3)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Alert
          message={
            <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <GiftOutlined style={{ color: '#ff8c00', fontSize: 18 }} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>
                  {t('business-trial-offer', { defaultValue: 'Try Business Plan Free for 7 Days' })}
                </span>
                <span style={{ opacity: 0.85 }}>
                  -{' '}
                  {t('business-trial-unlock', {
                    defaultValue: 'Unlock Client Portal, Project Finance & More',
                  })}
                </span>
                <span style={{ opacity: 0.7, fontSize: 13 }}>
                  {t('business-trial-no-card', { defaultValue: 'No credit card required' })}
                </span>
              </Space>
              <Space>
                <Button
                  type="primary"
                  size="small"
                  loading={starting}
                  onClick={handleStartTrial}
                  icon={<RocketOutlined />}
                  style={{
                    background: 'linear-gradient(135deg, #ff8c00 0%, #ffc107 100%)',
                    border: 'none',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(255,140,0,0.3)',
                  }}
                >
                  {starting
                    ? t('business-trial-starting', { defaultValue: 'Starting...' })
                    : t('business-trial-start', { defaultValue: 'Start Free Trial' })}
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleDismiss}
                  style={{ color: '#595959' }}
                  title={t('business-trial-dismiss', { defaultValue: 'Dismiss' })}
                />
              </Space>
            </Space>
          }
          type="success"
          showIcon={false}
          closable={false}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '4px 0',
          }}
        />
      </div>
    );
  }

  return null;
};

export default BusinessPlanTrialAlert;
