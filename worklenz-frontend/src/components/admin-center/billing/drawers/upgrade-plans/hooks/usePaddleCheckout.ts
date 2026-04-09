import { useState, useRef, useEffect } from 'react';
import { message } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { billingApiService } from '@/api/admin-center/billing.api.service';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { authApiService } from '@/api/auth/auth.api.service';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';
import { fetchBillingInfo, toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { IPaddlePlans, SUBSCRIPTION_STATUS } from '@/shared/constants';
import { PlanType, BillingFrequency, PricingData } from '../types';
import {
  TEAM_SIZE_THRESHOLD,
  MAX_TEAM_SIZE,
  PADDLE_CHECKOUT_DELAY,
  PADDLE_SCRIPT_URL,
} from '../constants';
import logger from '@/utils/errorLogger';
import {
  MixpanelBillingEvents,
  CheckoutEventProps,
  CheckoutResultEventProps,
  UserType,
  PlanType as MixpanelPlanType,
  BillingFrequency as MixpanelBillingFrequency,
  PricingModel,
} from '@/types/mixpanel-events.types';
import { evt_trial_converted } from '@/shared/worklenz-analytics-events';
import { IUpgradeSubscriptionPlanResponse } from '@/types/admin-center/admin-center.types';

declare const Paddle: any;

export interface UsePaddleCheckoutOptions {
  billingInfo: any;
  currentSession: any;
  selectedPlanType: PlanType;
  billingFrequency: BillingFrequency;
  teamSize: number;
  pricingData: PricingData;
  isAppSumoUser: boolean;
  isFreeUser: boolean;
  getEffectivePricingModel: (plan: 'pro' | 'business' | 'enterprise') => string;
  calculateAnnualTotal: (plan: 'pro' | 'business' | 'enterprise') => string;
  calculateMonthlyTotal: (plan: 'pro' | 'business' | 'enterprise') => string;
  getUserType: UserType;
  getCurrentPlanType: MixpanelPlanType | undefined;
  getPlanRank: (plan?: MixpanelPlanType) => number;
  isLicenseExpired: boolean;
  onSetSelectedPlanType: (planType: PlanType) => void;
  paddlePlans: typeof IPaddlePlans;
  trackMixpanelEvent: (event: any, props: any) => void;
}

export function usePaddleCheckout(options: UsePaddleCheckoutOptions) {
  const dispatch = useAppDispatch();
  const authService = useAuthService();

  const [switchingToPaddlePlan, setSwitchingToPaddlePlan] = useState(false);
  const [paddleLoading, setPaddleLoading] = useState(false);
  const [paddleError, setPaddleError] = useState<string | null>(null);
  const [loadingPlanType, setLoadingPlanType] = useState<PlanType | null>(null);

  // Ref so async Paddle callbacks always read fresh option values
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const handlePaddleCallback = (data: any) => {
    const {
      getUserType,
      billingInfo,
      isAppSumoUser,
      teamSize,
      getCurrentPlanType,
      selectedPlanType,
      billingFrequency,
      getEffectivePricingModel,
      currentSession,
      isLicenseExpired,
      getPlanRank,
      trackMixpanelEvent,
    } = optionsRef.current;

    switch (data.event) {
      case 'Checkout.Loaded':
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        break;

      case 'Checkout.Complete': {
        const checkoutSuccessProps: CheckoutResultEventProps = {
          user_type: getUserType,
          current_plan: billingInfo?.plan_name,
          current_plan_type: getCurrentPlanType,
          is_appsumo_user: isAppSumoUser,
          team_size: teamSize,
          subscription_status: billingInfo?.status,
          plan_id: data.checkout?.recurring_prices?.[0]?.id || '',
          plan_type: selectedPlanType as MixpanelPlanType,
          billing_frequency: billingFrequency as MixpanelBillingFrequency,
          checkout_amount: data.checkout?.recurring_totals?.total || 0,
          pricing_model: getEffectivePricingModel(
            selectedPlanType as 'pro' | 'business' | 'enterprise'
          ) as PricingModel,
          discount_applied: isAppSumoUser,
          discount_percentage: isAppSumoUser ? 50 : undefined,
          success: true,
        };
        trackMixpanelEvent(MixpanelBillingEvents.CHECKOUT_COMPLETED, checkoutSuccessProps);

        if (currentSession?.subscription_type === 'TRIAL') {
          trackMixpanelEvent(evt_trial_converted, {
            previous_plan: 'trial',
            new_plan: selectedPlanType,
            billing_frequency: billingFrequency,
            team_size: teamSize,
            total_amount: checkoutSuccessProps.checkout_amount,
            trial_expired: isLicenseExpired,
          });
        }

        {
          const fromPlan = getCurrentPlanType;
          const toPlan = selectedPlanType as MixpanelPlanType;
          if (fromPlan) {
            const direction = getPlanRank(toPlan) - getPlanRank(fromPlan);
            const baseProps = {
              user_type: getUserType,
              current_plan: billingInfo?.plan_name,
              current_plan_type: fromPlan,
              is_appsumo_user: isAppSumoUser,
              team_size: teamSize,
              subscription_status: billingInfo?.status,
              from_plan: fromPlan,
              to_plan: toPlan,
            } as any;
            if (direction > 0) trackMixpanelEvent('plan_upgraded' as any, baseProps);
            else if (direction < 0) trackMixpanelEvent('downgraded_plan' as any, baseProps);
          }
        }

        message.success('Subscription updated successfully!');
        setPaddleLoading(true);

        authApiService
          .verify()
          .then(authorizeResponse => {
            if (authorizeResponse.authenticated) {
              setSession(authorizeResponse.user);
              dispatch(setUser(authorizeResponse.user));
              authService.setCurrentSession(authorizeResponse.user);
            }
          })
          .catch(error => logger.error('Error refreshing session after checkout', error));

        setTimeout(() => {
          dispatch(fetchBillingInfo());
          dispatch(toggleUpgradeModal());
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
          setLoadingPlanType(null);
        }, PADDLE_CHECKOUT_DELAY);
        break;
      }

      case 'Checkout.Close':
        trackMixpanelEvent(MixpanelBillingEvents.CHECKOUT_ABANDONED, {
          user_type: getUserType,
          current_plan: billingInfo?.plan_name,
          plan_type: selectedPlanType as MixpanelPlanType,
          billing_frequency: billingFrequency as MixpanelBillingFrequency,
          team_size: teamSize,
          is_appsumo_user: isAppSumoUser,
        });
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        setLoadingPlanType(null);
        break;

      case 'Checkout.Error': {
        const checkoutFailProps: CheckoutResultEventProps = {
          user_type: getUserType,
          current_plan: billingInfo?.plan_name,
          current_plan_type: getCurrentPlanType,
          is_appsumo_user: isAppSumoUser,
          team_size: teamSize,
          subscription_status: billingInfo?.status,
          plan_id: '',
          plan_type: selectedPlanType as MixpanelPlanType,
          billing_frequency: billingFrequency as MixpanelBillingFrequency,
          checkout_amount: 0,
          pricing_model: getEffectivePricingModel(
            selectedPlanType as 'pro' | 'business' | 'enterprise'
          ) as PricingModel,
          discount_applied: isAppSumoUser,
          discount_percentage: isAppSumoUser ? 50 : undefined,
          success: false,
          error_message: data.error?.message || 'Unknown error',
          error_code: data.error?.code,
        };
        trackMixpanelEvent(MixpanelBillingEvents.CHECKOUT_FAILED, checkoutFailProps);
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        setLoadingPlanType(null);
        setPaddleError(data.error?.message || 'An error occurred during checkout');
        message.error('Error during checkout: ' + (data.error?.message || 'Unknown error'));
        logger.error('Paddle checkout error', data.error);
        break;
      }
    }
  };

  const configurePaddle = (data: IUpgradeSubscriptionPlanResponse) => {
    try {
      if (data.sandbox) Paddle.Environment.set('sandbox');
      Paddle.Setup({
        vendor: parseInt(data.vendor_id),
        eventCallback: (eventData: any) => {
          void handlePaddleCallback(eventData);
        },
      });
      Paddle.Checkout.open(data.params);
    } catch (error) {
      setPaddleLoading(false);
      setPaddleError('Failed to initialize checkout');
      message.error('Failed to initialize checkout');
      logger.error('Error initializing Paddle', error);
    }
  };

  const initializePaddle = (data: IUpgradeSubscriptionPlanResponse) => {
    setPaddleLoading(true);
    setPaddleError(null);

    if (window.Paddle) {
      configurePaddle(data);
      return;
    }

    const script = document.createElement('script');
    script.src = PADDLE_SCRIPT_URL;
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      configurePaddle(data);
    };
    script.onerror = () => {
      const {
        getUserType,
        billingInfo,
        getCurrentPlanType,
        isAppSumoUser,
        teamSize,
        trackMixpanelEvent,
      } = optionsRef.current;
      setPaddleLoading(false);
      setPaddleError('Failed to load Paddle checkout');
      message.error('Failed to load payment processor');
      logger.error('Failed to load Paddle script');
      trackMixpanelEvent(MixpanelBillingEvents.PADDLE_LOAD_ERROR, {
        user_type: getUserType,
        current_plan: billingInfo?.plan_name,
        current_plan_type: getCurrentPlanType,
        is_appsumo_user: isAppSumoUser,
        team_size: teamSize,
        subscription_status: billingInfo?.status,
      });
    };
    document.getElementsByTagName('head')[0].appendChild(script);
  };

  const upgradeToPaddlePlan = async (planId: string) => {
    const {
      selectedPlanType,
      billingFrequency,
      teamSize,
      billingInfo,
      isAppSumoUser,
      isFreeUser,
      currentSession,
      getUserType,
      getCurrentPlanType,
      getEffectivePricingModel,
      calculateAnnualTotal,
      calculateMonthlyTotal,
      getPlanRank,
      trackMixpanelEvent,
    } = optionsRef.current;

    try {
      setSwitchingToPaddlePlan(true);
      setPaddleLoading(true);
      setPaddleError(null);
      setLoadingPlanType(selectedPlanType);

      const effectivePricingModel = getEffectivePricingModel(
        selectedPlanType as 'pro' | 'business' | 'enterprise'
      );

      const checkoutProps: CheckoutEventProps = {
        user_type: getUserType,
        current_plan: billingInfo?.plan_name,
        current_plan_type: getCurrentPlanType,
        is_appsumo_user: isAppSumoUser,
        team_size: teamSize,
        subscription_status: billingInfo?.status,
        plan_id: planId,
        plan_type: selectedPlanType as MixpanelPlanType,
        billing_frequency: billingFrequency as MixpanelBillingFrequency,
        checkout_amount:
          billingFrequency === 'annual'
            ? parseFloat(
                calculateAnnualTotal(selectedPlanType as 'pro' | 'business' | 'enterprise')
              )
            : parseFloat(
                calculateMonthlyTotal(selectedPlanType as 'pro' | 'business' | 'enterprise')
              ),
        pricing_model: effectivePricingModel as PricingModel,
        discount_applied: isAppSumoUser,
        discount_percentage: isAppSumoUser ? 50 : undefined,
      };

      if (isAppSumoUser)
        trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_UPGRADE_INITIATED, checkoutProps);
      trackMixpanelEvent(MixpanelBillingEvents.CHECKOUT_INITIATED, checkoutProps);

      const shouldUseUpgradeAPI =
        !billingInfo?.subscription_id ||
        isFreeUser ||
        currentSession?.subscription_type === 'BUSINESS_TRIAL' ||
        billingInfo?.status === SUBSCRIPTION_STATUS.TRIALING ||
        billingInfo?.status === SUBSCRIPTION_STATUS.PASTDUE ||
        billingInfo?.status === SUBSCRIPTION_STATUS.DELETED;

      if (shouldUseUpgradeAPI) {
        const apiPricingModel = effectivePricingModel === 'base_plan' ? 'regular' : 'per_user';
        const res = await billingApiService.upgradeToPaidPlan(
          planId,
          apiPricingModel as 'per_user' | 'regular',
          teamSize
        );
        if (res.done) {
          initializePaddle(res.body);
        } else {
          console.error('Upgrade API failed:', res);
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
          setLoadingPlanType(null);
          setPaddleError(`Failed to prepare checkout: ${res.message || 'Unknown error'}`);
          message.error(`Failed to prepare checkout: ${res.message || 'Unknown error'}`);
        }
      } else if (
        billingInfo?.status === SUBSCRIPTION_STATUS.ACTIVE ||
        billingInfo?.status === SUBSCRIPTION_STATUS.PAUSED
      ) {
        const res = await adminCenterApiService.changePlan(planId);
        if (res.done) {
          const fromPlan = getCurrentPlanType;
          const toPlan = selectedPlanType as MixpanelPlanType;
          if (fromPlan) {
            const direction = getPlanRank(toPlan) - getPlanRank(fromPlan);
            const baseProps = {
              user_type: getUserType,
              current_plan: billingInfo?.plan_name,
              current_plan_type: fromPlan,
              is_appsumo_user: isAppSumoUser,
              team_size: teamSize,
              subscription_status: billingInfo?.status,
              from_plan: fromPlan,
              to_plan: toPlan,
            } as any;
            if (direction > 0) trackMixpanelEvent('plan_upgraded' as any, baseProps);
            else if (direction < 0) trackMixpanelEvent('downgraded_plan' as any, baseProps);
          }
          message.success('Subscription plan changed successfully!');
          dispatch(fetchBillingInfo());
          dispatch(toggleUpgradeModal());
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
          setLoadingPlanType(null);
        } else {
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
          setLoadingPlanType(null);
          setPaddleError('Failed to change plan');
          message.error('Failed to change subscription plan');
        }
      } else {
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        setLoadingPlanType(null);
        setPaddleError('Unable to process plan selection');
        message.error('Unable to process plan selection. Please contact support.');
      }
    } catch (error) {
      setSwitchingToPaddlePlan(false);
      setPaddleLoading(false);
      setLoadingPlanType(null);
      setPaddleError('Error upgrading to paid plan');
      message.error('Failed to upgrade to paid plan');
      logger.error('Error upgrading to paddle plan', error);
    }
  };

  const continueWithPaddlePlan = async (planType?: 'pro' | 'business' | 'enterprise') => {
    const { teamSize, billingFrequency, pricingData, onSetSelectedPlanType, selectedPlanType } =
      optionsRef.current;

    if (teamSize >= MAX_TEAM_SIZE) {
      message.info('Please contact sales for custom pricing on large teams');
      return;
    }

    try {
      const targetPlanType = planType || selectedPlanType;
      setLoadingPlanType(targetPlanType);
      setSwitchingToPaddlePlan(true);
      setPaddleError(null);

      const isAnnual = billingFrequency === 'annual';

      if (!targetPlanType || targetPlanType === 'free') {
        setSwitchingToPaddlePlan(false);
        setPaddleError('Please select a paid plan first');
        message.error('Please select a plan first');
        return;
      }

      const getPlanIdForType = (type: typeof targetPlanType) => {
        if (type === 'pro') {
          const useSmallPlan =
            teamSize <= TEAM_SIZE_THRESHOLD &&
            pricingData.pro_small &&
            (isAnnual
              ? pricingData.pro_small.annual_plan_id
              : pricingData.pro_small.monthly_plan_id);
          const planData = useSmallPlan ? pricingData.pro_small : pricingData.pro;
          return isAnnual ? planData?.annual_plan_id : planData?.monthly_plan_id;
        } else if (type === 'business') {
          const useSmallPlan =
            teamSize <= TEAM_SIZE_THRESHOLD &&
            pricingData.business_small &&
            (isAnnual
              ? pricingData.business_small.annual_plan_id
              : pricingData.business_small.monthly_plan_id);
          const planData = useSmallPlan ? pricingData.business_small : pricingData.business;
          return isAnnual ? planData?.annual_plan_id : planData?.monthly_plan_id;
        } else if (type === 'enterprise') {
          return isAnnual
            ? pricingData.enterprise?.annual_plan_id
            : pricingData.enterprise?.monthly_plan_id;
        }
        return null;
      };

      const planId = getPlanIdForType(targetPlanType) ?? null;
      if (!planId) {
        console.error('Plan ID not found', { targetPlanType, teamSize, isAnnual, pricingData });
      }

      if (planType) {
        onSetSelectedPlanType(planType);
      }

      if (planId) {
        await upgradeToPaddlePlan(planId);
      } else {
        setSwitchingToPaddlePlan(false);
        setLoadingPlanType(null);
        const errorMsg = `Plan not available: ${targetPlanType} (${billingFrequency}) for ${teamSize} users. Please try a different configuration or contact support.`;
        setPaddleError(errorMsg);
        message.error('Selected plan is not available. Please try a different configuration.');
      }
    } catch (error) {
      setSwitchingToPaddlePlan(false);
      setLoadingPlanType(null);
      setPaddleError('Error processing request');
      message.error('Error processing request');
      logger.error('Error upgrading to paddle plan', error);
    }
  };

  return {
    switchingToPaddlePlan,
    paddleLoading,
    paddleError,
    loadingPlanType,
    continueWithPaddlePlan,
  };
}
