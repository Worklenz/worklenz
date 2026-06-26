import { useEffect, useState, useMemo } from 'react';
import { Col, Flex, Row, Typography, message, Space, Alert } from '@/shared/antd-imports';
import { FileOutlined, PictureOutlined, TableOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import {
  IPricingPlans,
  IUpgradeSubscriptionPlanResponse,
} from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IPaddlePlans, SUBSCRIPTION_STATUS } from '@/shared/constants';
import { useAuthService } from '@/hooks/useAuth';
import {
  fetchBillingInfo,
  fetchStorageInfo,
  toggleUpgradeModal,
} from '@/features/admin-center/admin-center.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { billingApiService, IPricingPlan } from '@/api/admin-center/billing.api.service';
import { authApiService } from '@/api/auth/auth.api.service';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useAppSumoTracking } from '@/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import {
  MixpanelBillingEvents,
  PlanSelectionEventProps,
  TeamSizeChangeEventProps,
  BillingFrequencyChangeEventProps,
  AppSumoEventProps,
  UserType,
  PlanType as MixpanelPlanType,
  BillingFrequency as MixpanelBillingFrequency,
  PricingModel,
} from '@/types/mixpanel-events.types';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { isOnBusinessTrial } from '@/utils/subscription-utils';

import { PlanPriceDisplay, PlanCardSkeleton, PlanCard, PlanSelectionControls } from './components';
import {
  usePricingCalculations,
  useTeamSizeOptions,
  usePaddleCheckout,
  useBusinessTrial,
  usePlanFeatures,
} from './hooks';
import { PricingData, AppSumoDiscountInfo, PlanType, BillingFrequency } from './types';
import { getInitialPricingData, mapTierBasedPricingToFrontend } from './utils';
import { TEAM_SIZE_THRESHOLD, MAX_TEAM_SIZE } from './constants';

import './upgrade-plans.css';

// Extend Window interface to include Paddle
declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: string) => void };
      Setup: (config: { vendor: number; eventCallback: (data: any) => void }) => void;
      Checkout: { open: (params: any) => void };
    };
  }
}

const UpgradePlans = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal', 'admin-center/overview']);
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { trackAppSumoEvent } = useAppSumoTracking();
  const { isLicenseExpired } = useAuthStatus();

  // Redux state
  const { billingInfo, upgradeModalVariant } = useAppSelector(state => state.adminCenterReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();

  // Component state
  const [plans, setPlans] = useState<IPricingPlans>({});
  const [backendPlans, setBackendPlans] = useState<IPricingPlan[]>([]);
  const [pricingData, setPricingData] = useState<PricingData>(getInitialPricingData());
  const [selectedPlanType, setSelectedPlanType] = useState<PlanType>('pro');
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>('monthly');
  const [teamSize, setTeamSize] = useState<number>(1);

  // Loading states
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [switchingToFreePlan, setSwitchingToFreePlan] = useState(false);

  // AppSumo states
  const [appSumoDiscountInfo, setAppSumoDiscountInfo] = useState<AppSumoDiscountInfo | null>(null);

  // Legacy state (for compatibility)
  const [selectedPlan, setSelectedCard] = useState(IPaddlePlans.ANNUAL);
  const paddlePlans = IPaddlePlans;

  // Computed values
  const isAppSumoUser = useMemo(() => {
    const planName = billingInfo?.plan_name?.toLowerCase() || '';
    const subscriptionType = currentSession?.subscription_type?.toLowerCase() || '';
    const subscriptionStatus = currentSession?.subscription_status?.toLowerCase() || '';
    const billingSubscriptionType = billingInfo?.subscription_type?.toLowerCase() || '';

    return (
      planName.includes('appsumo') ||
      planName.includes('life_time_deal') ||
      subscriptionType.includes('appsumo') ||
      subscriptionType.includes('life_time_deal') ||
      subscriptionStatus.includes('life_time_deal') ||
      billingSubscriptionType.includes('appsumo') ||
      billingSubscriptionType.includes('life_time_deal')
    );
  }, [billingInfo, currentSession]);

  const isFreeUser = useMemo(() => {
    return currentSession?.subscription_type === 'FREE';
  }, [currentSession]);

  // Custom hooks
  const {
    calculateMonthlyTotal,
    calculateAnnualTotal,
    getPriceLabel,
    getEffectivePricingModel,
    getPerUserMonthlyPrice,
    getPerUserAnnualPrice,
    calculateOriginalMonthlyTotal,
    calculateOriginalAnnualTotal,
  } = usePricingCalculations(teamSize, pricingData, isAppSumoUser);

  // Show "Up to 30% off" label only for annual billing frequency
  const annualSavingsPercent = useMemo(() => {
    return billingFrequency === 'annual' ? 30 : undefined;
  }, [billingFrequency]);

  const minSelectableTeamSize = Math.max(1, billingInfo?.total_used ?? 1);
  const { generateTeamSizeOptions } = useTeamSizeOptions(
    isAppSumoUser,
    selectedPlanType,
    minSelectableTeamSize
  );

  // Helper: plan ranking for upgrade/downgrade comparison
  const getPlanRank = (plan?: MixpanelPlanType): number => {
    switch (plan) {
      case 'free':
        return 0;
      case 'pro':
        return 1;
      case 'business':
        return 2;
      case 'enterprise':
        return 3;
      default:
        return -1;
    }
  };

  // Helper: derive plan limits
  const getMaxUsersFromTier = (tier?: any): number | null => {
    if (!tier) return null;
    const raw = (tier.max_users_limit ?? tier.max_users) as string | undefined;
    const n = raw !== undefined ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  };

  const getMaxUsersForPlan = (plan: 'pro' | 'business' | 'enterprise', size: number): number => {
    if (plan === 'enterprise') return Number.POSITIVE_INFINITY;
    if (plan === 'pro') {
      const useSmall = size <= TEAM_SIZE_THRESHOLD && pricingData.pro_small;
      const max = getMaxUsersFromTier(useSmall ? pricingData.pro_small : pricingData.pro);
      return max ?? Number.POSITIVE_INFINITY;
    }
    const useSmall = size <= TEAM_SIZE_THRESHOLD && pricingData.business_small;
    const max = getMaxUsersFromTier(useSmall ? pricingData.business_small : pricingData.business);
    return max ?? Number.POSITIVE_INFINITY;
  };

  const calculateTotalCostForPlan = (
    planType: 'pro' | 'business' | 'enterprise',
    teamSize: number,
    isAnnual: boolean
  ): number => {
    if (planType === 'enterprise') {
      return isAnnual
        ? parseFloat(calculateAnnualTotal('enterprise'))
        : parseFloat(calculateMonthlyTotal('enterprise'));
    }

    const calculateCostForSpecificTeamSize = (plan: 'pro' | 'business' | 'enterprise') => {
      let finalPrice = 0;
      let planData =
        plan === 'pro'
          ? pricingData.pro
          : plan === 'business'
            ? pricingData.business
            : pricingData.enterprise;

      if (planData?.pricing_model?.startsWith('promo_')) {
        finalPrice = parseFloat(planData.monthly_base_price || '0');
        if (!finalPrice && planData.annual_base_price) {
          finalPrice = parseFloat(planData.annual_base_price) / 12;
        }
        return isAnnual ? finalPrice * 12 : finalPrice;
      }

      if (teamSize <= TEAM_SIZE_THRESHOLD) {
        if (plan === 'pro' && pricingData.pro_small?.pricing_model === 'per_user') {
          const perUserPrice = isAnnual
            ? parseFloat(pricingData.pro_small.annual_per_user_price || '0')
            : parseFloat(pricingData.pro_small.monthly_per_user_price || '0');
          finalPrice = perUserPrice * teamSize;
        } else if (
          plan === 'business' &&
          pricingData.business_small?.pricing_model === 'per_user'
        ) {
          const perUserPrice = isAnnual
            ? parseFloat(pricingData.business_small.annual_per_user_price || '0')
            : parseFloat(pricingData.business_small.monthly_per_user_price || '0');
          finalPrice = perUserPrice * teamSize;
        } else if (plan === 'enterprise') {
          finalPrice = isAnnual
            ? parseFloat(pricingData.enterprise.annual_base_price || '0')
            : parseFloat(pricingData.enterprise.monthly_base_price || '0');
        } else {
          const basePrice = isAnnual
            ? parseFloat(planData.annual_base_price || '0')
            : parseFloat(planData.monthly_base_price || '0');
          const includedUsers = parseInt(planData.included_users) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const perUserPrice = isAnnual
            ? parseFloat(planData.annual_per_user_price || planData.additional_user_price || '0') *
            12
            : parseFloat(planData.monthly_per_user_price || planData.additional_user_price || '0');
          finalPrice = basePrice + extraUsers * perUserPrice;
        }
      } else {
        if (plan === 'enterprise') {
          finalPrice = isAnnual
            ? parseFloat(planData.annual_base_price || '0')
            : parseFloat(planData.monthly_base_price || '0');
        } else {
          const basePrice = isAnnual
            ? parseFloat(planData.annual_base_price || '0')
            : parseFloat(planData.monthly_base_price || '0');
          const includedUsers = parseInt(planData.included_users) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const perUserPrice = isAnnual
            ? parseFloat(planData.annual_per_user_price || planData.additional_user_price || '0') *
            12
            : parseFloat(planData.monthly_per_user_price || planData.additional_user_price || '0');
          finalPrice = basePrice + extraUsers * perUserPrice;
        }
      }

      return finalPrice;
    };

    return calculateCostForSpecificTeamSize(planType);
  };

  const getPlanForSize = (size: number): PlanType => {
    const isAnnual = billingFrequency === 'annual';
    const proCost = calculateTotalCostForPlan('pro', size, isAnnual);
    const businessCost = calculateTotalCostForPlan('business', size, isAnnual);

    if (proCost < businessCost) {
      const proMax = getMaxUsersForPlan('pro', size);
      if (size <= proMax) return 'pro';
    } else {
      const businessMax = getMaxUsersForPlan('business', size);
      if (size <= businessMax) return 'business';
    }

    return 'enterprise';
  };

  // Helper function to get user type for tracking
  const getUserType = useMemo((): UserType => {
    if (isAppSumoUser) return 'appsumo';
    if (currentSession?.subscription_type === 'TRIAL') return 'trial';
    if (isFreeUser) return 'free';
    return 'paid';
  }, [isAppSumoUser, currentSession, isFreeUser]);

  // Helper function to get current plan type
  const getCurrentPlanType = useMemo((): MixpanelPlanType | undefined => {
    const planName = billingInfo?.plan_name?.toLowerCase() || '';
    if (planName.includes('enterprise')) return 'enterprise';
    if (planName.includes('business')) return 'business';
    if (planName.includes('pro')) return 'pro';
    if (isFreeUser) return 'free';
    return undefined;
  }, [billingInfo, isFreeUser]);

  // Business trial hook
  const {
    canStartBusinessTrial,
    businessTrialLoading,
    trialEligibilityChecked,
    startBusinessTrial,
  } = useBusinessTrial(currentSession);

  // Paddle checkout hook
  const {
    switchingToPaddlePlan,
    paddleLoading,
    paddleError,
    loadingPlanType,
    continueWithPaddlePlan,
  } = usePaddleCheckout({
    billingInfo,
    currentSession,
    selectedPlanType,
    billingFrequency,
    teamSize,
    pricingData,
    isAppSumoUser,
    isFreeUser,
    getEffectivePricingModel,
    calculateAnnualTotal,
    calculateMonthlyTotal,
    getUserType,
    getCurrentPlanType,
    getPlanRank,
    isLicenseExpired,
    onSetSelectedPlanType: setSelectedPlanType,
    paddlePlans,
    trackMixpanelEvent,
  });

  // Plan features hook
  const {
    generateFreePlanFeatures,
    generateProPlanFeatures,
    generateBusinessPlanFeatures,
    generateEnterprisePlanFeatures,
  } = usePlanFeatures(plans, pricingData, teamSize, isAppSumoUser, getEffectivePricingModel);

  // Event handlers
  const handleTeamSizeChange = (size: number) => {
    const oldSize = teamSize;
    setTeamSize(size);

    const autoPlan = getPlanForSize(size);
    if (autoPlan !== selectedPlanType && autoPlan !== 'free') {
      setSelectedPlanType(autoPlan);
    }

    const eventProps: TeamSizeChangeEventProps = {
      user_type: getUserType,
      current_plan: billingInfo?.plan_name,
      current_plan_type: getCurrentPlanType,
      is_appsumo_user: isAppSumoUser,
      team_size: billingInfo?.total_used,
      subscription_status: billingInfo?.status,
      old_team_size: oldSize,
      new_team_size: size,
      selected_plan: autoPlan as MixpanelPlanType,
      pricing_model: getEffectivePricingModel(
        autoPlan as 'pro' | 'business' | 'enterprise'
      ) as PricingModel,
    };
    trackMixpanelEvent(MixpanelBillingEvents.TEAM_SIZE_CHANGED, eventProps);
  };

  const handleBillingFrequencyChange = (frequency: BillingFrequency) => {
    const oldFrequency = billingFrequency;
    setBillingFrequency(frequency);
    setSelectedCard(frequency === 'annual' ? paddlePlans.ANNUAL : paddlePlans.MONTHLY);

    const autoPlan = getPlanForSize(teamSize);
    if (autoPlan !== selectedPlanType && autoPlan !== 'free') {
      setSelectedPlanType(autoPlan);
    }

    const annualTotal = calculateAnnualTotal(autoPlan as 'pro' | 'business' | 'enterprise');
    const monthlyTotal = calculateMonthlyTotal(autoPlan as 'pro' | 'business' | 'enterprise');
    const annualSavings = parseFloat(monthlyTotal) * 12 - parseFloat(annualTotal);

    const eventProps: BillingFrequencyChangeEventProps = {
      user_type: getUserType,
      current_plan: billingInfo?.plan_name,
      current_plan_type: getCurrentPlanType,
      is_appsumo_user: isAppSumoUser,
      team_size: teamSize,
      subscription_status: billingInfo?.status,
      old_frequency: oldFrequency as MixpanelBillingFrequency,
      new_frequency: frequency as MixpanelBillingFrequency,
      selected_plan: autoPlan as MixpanelPlanType,
      annual_savings: annualSavings > 0 ? annualSavings : undefined,
    };
    trackMixpanelEvent(MixpanelBillingEvents.BILLING_FREQUENCY_CHANGED, eventProps);
  };

  const handlePlanSelect = (planType: PlanType) => {
    const previousPlan = selectedPlanType;
    setSelectedPlanType(planType);
    if (planType === 'free') {
      setSelectedCard(paddlePlans.FREE);
    }

    const effectivePricingModel =
      planType !== 'free' && planType !== 'enterprise'
        ? getEffectivePricingModel(planType as 'pro' | 'business')
        : 'base_plan';

    const eventProps: PlanSelectionEventProps = {
      user_type: getUserType,
      current_plan: billingInfo?.plan_name,
      current_plan_type: getCurrentPlanType,
      is_appsumo_user: isAppSumoUser,
      team_size: billingInfo?.total_used,
      subscription_status: billingInfo?.status,
      selected_plan: planType as MixpanelPlanType,
      previous_plan: previousPlan as MixpanelPlanType,
      billing_frequency: billingFrequency as MixpanelBillingFrequency,
      selected_team_size: teamSize,
      pricing_model: effectivePricingModel as PricingModel,
      calculated_monthly_price:
        planType !== 'free'
          ? parseFloat(calculateMonthlyTotal(planType as 'pro' | 'business' | 'enterprise'))
          : 0,
      calculated_annual_price:
        planType !== 'free'
          ? parseFloat(calculateAnnualTotal(planType as 'pro' | 'business' | 'enterprise'))
          : 0,
      discount_applied: isAppSumoUser,
      discount_percentage: isAppSumoUser ? 50 : undefined,
      is_small_team: teamSize <= TEAM_SIZE_THRESHOLD,
    };
    trackMixpanelEvent(MixpanelBillingEvents.PLAN_SELECTED, eventProps);
    if (isAppSumoUser) {
      trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_PLAN_SELECTED, { selected_plan: planType });
    }

    trackMixpanelEvent(MixpanelBillingEvents.PLAN_COMPARED, {
      user_type: getUserType,
      current_plan: billingInfo?.plan_name,
      current_plan_type: getCurrentPlanType,
      is_appsumo_user: isAppSumoUser,
      team_size: billingInfo?.total_used,
      subscription_status: billingInfo?.status,
    });
  };

  // API functions
  const setDefaultAppSumoInfo = () => {
    if (!isAppSumoUser) return;

    setAppSumoDiscountInfo({
      remainingDays: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      eligibleForDiscount: true,
      urgencyLevel: 'medium',
      message: '🎉 Special 50% OFF pricing for AppSumo lifetime deal members',
    });

    const currentDate = new Date();
    const promoEndDate = new Date('2025-09-10');
    const isPromoActive = currentDate < promoEndDate;

    const eventProps: AppSumoEventProps = {
      user_type: 'appsumo',
      current_plan: billingInfo?.plan_name,
      current_plan_type: getCurrentPlanType,
      is_appsumo_user: true,
      team_size: billingInfo?.total_used,
      subscription_status: billingInfo?.status,
      promo_active: isPromoActive,
      discount_percentage: 50,
    };
    trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_DISCOUNT_VIEWED, eventProps);
  };

  const fetchPricingPlans = async () => {
    try {
      setIsLoadingPlans(true);

      const res = await adminCenterApiService.getPlans();
      if (res.done) {
        setPlans(res.body);
      }

      const pricingRes = await billingApiService.getPricingPlans();
      if (pricingRes.done && pricingRes.body) {
        const tiers = pricingRes.body.tiers || [];

        let filteredTiers = tiers;
        if (isAppSumoUser) {
          filteredTiers = tiers.filter((tier: any) => tier.tier_name === 'APPSUMO_BUSINESS');
          setDefaultAppSumoInfo();
        } else {
          filteredTiers = tiers.filter((tier: any) => {
            const tierName = tier.tier_name as string;
            return !(tierName && tierName.startsWith('APPSUMO_'));
          });
        }

        setBackendPlans(filteredTiers as any);
        const mappedPricing = mapTierBasedPricingToFrontend(filteredTiers);
        setPricingData(mappedPricing);
      } else {
        trackMixpanelEvent(MixpanelBillingEvents.PRICING_FETCH_ERROR, {
          user_type: getUserType,
          current_plan: billingInfo?.plan_name,
          current_plan_type: getCurrentPlanType,
          is_appsumo_user: isAppSumoUser,
          team_size: teamSize,
          subscription_status: billingInfo?.status,
        });
      }
    } catch (error) {
      logger.error('Error fetching pricing plans', error);
      message.error(
        t('pricing-modal:errors.loadingPlansRetry', {
          defaultValue: 'Failed to load pricing plans. Please refresh the page.',
        })
      );
      trackMixpanelEvent(MixpanelBillingEvents.PRICING_FETCH_ERROR, {
        user_type: getUserType,
        current_plan: billingInfo?.plan_name,
        current_plan_type: getCurrentPlanType,
        is_appsumo_user: isAppSumoUser,
        team_size: teamSize,
        subscription_status: billingInfo?.status,
      });
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const switchToFreePlan = async () => {
    const teamId = currentSession?.team_id;
    if (!teamId) return;

    try {
      setSwitchingToFreePlan(true);
      const res = await adminCenterApiService.switchToFreePlan(teamId);
      if (res.done) {
        const fromPlan = getCurrentPlanType;
        const toPlan: MixpanelPlanType = 'free';
        if (fromPlan && fromPlan !== 'free') {
          const baseProps = {
            user_type: getUserType,
            current_plan: billingInfo?.plan_name,
            current_plan_type: fromPlan,
            is_appsumo_user: isAppSumoUser,
            team_size: billingInfo?.total_used,
            subscription_status: billingInfo?.status,
            from_plan: fromPlan,
            to_plan: toPlan,
          } as any;
          trackMixpanelEvent('downgraded_plan' as any, baseProps);
          trackMixpanelEvent(MixpanelBillingEvents.FREE_PLAN_SWITCH_COMPLETED, baseProps);
        }
        dispatch(fetchBillingInfo());
        dispatch(fetchStorageInfo());
        dispatch(toggleUpgradeModal());
        const authorizeResponse = await authApiService.verify();
        if (authorizeResponse.authenticated) {
          setSession(authorizeResponse.user);
          dispatch(setUser(authorizeResponse.user));
          window.location.href = '/worklenz/admin-center/billing';
        }
      }
    } catch (error) {
      logger.error('Error switching to free plan', error);
    } finally {
      setSwitchingToFreePlan(false);
    }
  };

  // Effects
  useEffect(() => {
    const initializeData = async () => {
      await fetchPricingPlans();
      if (isAppSumoUser) {
        setDefaultAppSumoInfo();
      }
    };
    initializeData();

    if (isAppSumoUser) {
      setTeamSize(50);
    } else if (billingInfo?.total_used !== undefined) {
      const actualTeamSize = Math.max(1, billingInfo.total_used);
      setTeamSize(actualTeamSize);
    }
  }, [billingInfo, isAppSumoUser]);

  useEffect(() => {
    if (!isAppSumoUser) return;
    trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_MODAL_VIEWED);
    return () => {
      trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_MODAL_DISMISSED);
    };
  }, [isAppSumoUser]);

  useEffect(() => {
    return () => {
      const paddleScript = document.querySelector('script[src*="paddle.js"]');
      if (paddleScript) {
        paddleScript.remove();
      }
    };
  }, []);

  // Main render
  return (
    <div className="upgrade-plans-responsive">
      <Flex justify="center" align="center">
        <Typography.Title level={2}>
          {billingInfo?.status === SUBSCRIPTION_STATUS.TRIALING
            ? t('selectPlan', 'Select Plan')
            : t('changeSubscriptionPlan', 'Change Subscription Plan')}
        </Typography.Title>
      </Flex>

      {/* Team Size Input and Billing Frequency Toggle */}
      <PlanSelectionControls
        teamSize={teamSize}
        billingFrequency={billingFrequency}
        isLoadingPlans={isLoadingPlans}
        isAppSumoUser={isAppSumoUser}
        selectedPlanType={selectedPlanType}
        onTeamSizeChange={handleTeamSizeChange}
        onBillingFrequencyChange={handleBillingFrequencyChange}
        generateTeamSizeOptions={generateTeamSizeOptions}
        minTeamSize={Math.max(1, billingInfo?.total_used ?? 1)}
        maxTeamSize={isAppSumoUser ? 50 : 95}
        annualSavingsPercent={annualSavingsPercent}
      />

      {/* Pricing Model Information */}
      {!isAppSumoUser &&
        !isLoadingPlans &&
        (pricingData.pro_small || pricingData.business_small) && (
          <Row justify="center" style={{ marginBottom: 8 }}>
            <Space direction="vertical" size="small" style={{ textAlign: 'center' }}>
              {billingInfo?.total_used && (
                <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                  {teamSize <= TEAM_SIZE_THRESHOLD &&
                    (pricingData.pro_small || pricingData.business_small)
                    ? t(
                      'pricing-modal:pricingModel.autoPerUser',
                      'Automatically using per-user pricing for {{count}} user{{s}}',
                      {
                        count: teamSize,
                        s: teamSize > 1 ? 's' : '',
                      }
                    )
                    : t(
                      'pricing-modal:pricingModel.autoBase',
                      'Automatically using base plan pricing for {{count}} user{{s}}',
                      {
                        count: teamSize,
                        s: teamSize > 1 ? 's' : '',
                      }
                    )}
                </Typography.Text>
              )}
              {(() => {
                if (isAppSumoUser) return null;
                if (selectedPlanType === 'enterprise' || !selectedPlanType) return null;
                const effectiveModel = getEffectivePricingModel(
                  selectedPlanType as 'pro' | 'business' | 'enterprise'
                );
                if (effectiveModel !== 'base_plan') return null;
                const planData =
                  selectedPlanType === 'pro' ? pricingData.pro : pricingData.business;
                const included = Number(planData?.included_users || planData?.users_included);
                if (!included || Number.isNaN(included)) return null;
                if (teamSize <= included) return null;
                const perUserMonthly =
                  planData?.monthly_per_user_price || planData?.additional_user_price || '5.99';
                return (
                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                    {t(
                      'pricing-modal:pricingModel.additionalUserCharge',
                      'Includes {{included}} users. Each additional user is ${{price}}/month.',
                      {
                        included,
                        price: perUserMonthly,
                      }
                    )}
                  </Typography.Text>
                );
              })()}
            </Space>
          </Row>
        )}

      {/* Pricing Cards */}
      <Row className="w-full" gutter={[12, 12]} style={{ marginTop: 8 }}>
        {isLoadingPlans ? (
          <>
            {!isAppSumoUser && (
              <>
                <Col xs={24} lg={6}>
                  <PlanCardSkeleton />
                </Col>
                <Col xs={24} lg={6}>
                  <PlanCardSkeleton />
                </Col>
              </>
            )}
            <Col xs={24} lg={isAppSumoUser ? 12 : 6}>
              <PlanCardSkeleton />
            </Col>
            <Col xs={24} lg={isAppSumoUser ? 12 : 6}>
              <PlanCardSkeleton />
            </Col>
          </>
        ) : (
          <>
            {/* Free Plan - Hide for AppSumo users */}
            {!isAppSumoUser && (
              <Col xs={24} lg={6}>
                <PlanCard
                  planType="free"
                  title={t('pricing-modal:plans.free.name')}
                  description={t('pricing-modal:plans.free.description')}
                  features={generateFreePlanFeatures()}
                  priceDisplay={
                    <PlanPriceDisplay
                      monthlyPrice="0"
                      annualPrice="0"
                      perUserMonthlyPrice={null}
                      perUserAnnualPrice={null}
                      isSmallTeam={false}
                      billingFrequency={billingFrequency}
                      label={t('pricing-modal:plans.free.forever')}
                      isAppSumoUser={isAppSumoUser}
                    />
                  }
                  selectedPlanType={selectedPlanType}
                  onPlanSelect={handlePlanSelect}
                  primaryActionLabel={t('pricing-modal:buttons.getStartedFree', 'Get Started Free')}
                  onPrimaryAction={() => switchToFreePlan()}
                  primaryActionDisabled={isLoadingPlans}
                  primaryActionLoading={switchingToFreePlan}
                  footerNote={t('pricing-modal:buttons.switchToFree', 'Switch to Free Plan')}
                  isAppSumoUser={isAppSumoUser}
                  themeMode={themeMode}
                  teamSize={teamSize}
                  billingFrequency={billingFrequency}
                  calculateTotalCostForPlan={calculateTotalCostForPlan}
                />
              </Col>
            )}

            {/* Pro Plan - Hide for AppSumo users */}
            {!isAppSumoUser && (
              <Col xs={24} lg={6}>
                <PlanCard
                  planType="pro"
                  title={t('pricing-modal:plans.pro.name')}
                  description={t('pricing-modal:plans.pro.description')}
                  features={generateProPlanFeatures()}
                  priceDisplay={
                    <PlanPriceDisplay
                      monthlyPrice={calculateMonthlyTotal('pro')}
                      annualPrice={calculateAnnualTotal('pro')}
                      perUserMonthlyPrice={getPerUserMonthlyPrice('pro')}
                      perUserAnnualPrice={getPerUserAnnualPrice('pro')}
                      isSmallTeam={teamSize <= 5}
                      billingFrequency={billingFrequency}
                      label={getPriceLabel('pro')}
                      isAppSumoUser={isAppSumoUser}
                    />
                  }
                  selectedPlanType={selectedPlanType}
                  onPlanSelect={handlePlanSelect}
                  primaryActionLabel={t(
                    'pricing-modal:buttons.choosePlan',
                    'Continue with Selected Plan'
                  )}
                  onPrimaryAction={() => {
                    handlePlanSelect('pro');
                    void continueWithPaddlePlan('pro');
                  }}
                  primaryActionDisabled={isLoadingPlans}
                  primaryActionLoading={loadingPlanType === 'pro'}
                  footerNote={(() => {
                    if (billingFrequency === 'annual') {
                      const annualTotal = calculateAnnualTotal('pro');
                      const userText = t(
                        'pricing-modal:billing.forUsers',
                        ' for {{count}} user{{s}}',
                        { count: teamSize, s: teamSize > 1 ? 's' : '' }
                      );
                      return `$${annualTotal}/year${userText}`;
                    } else {
                      const monthlyTotal = calculateMonthlyTotal('pro');
                      const userText = t(
                        'pricing-modal:billing.forUsers',
                        ' for {{count}} user{{s}}',
                        { count: teamSize, s: teamSize > 1 ? 's' : '' }
                      );
                      return `$${monthlyTotal}/month${userText}`;
                    }
                  })()}
                  isAppSumoUser={isAppSumoUser}
                  themeMode={themeMode}
                  teamSize={teamSize}
                  billingFrequency={billingFrequency}
                  calculateTotalCostForPlan={calculateTotalCostForPlan}
                />
              </Col>
            )}

            {/* Business Plan */}
            <Col xs={24} lg={isAppSumoUser ? 24 : 6}>
              <PlanCard
                planType="business"
                title={
                  isAppSumoUser
                    ? t('pricing-modal:plans.business.namePromo', 'Business (AppSumo Special)')
                    : t('pricing-modal:plans.business.name')
                }
                description={t('pricing-modal:plans.business.description')}
                features={generateBusinessPlanFeatures()}
                priceDisplay={
                  <PlanPriceDisplay
                    monthlyPrice={calculateMonthlyTotal('business')}
                    annualPrice={calculateAnnualTotal('business')}
                    perUserMonthlyPrice={getPerUserMonthlyPrice('business')}
                    perUserAnnualPrice={getPerUserAnnualPrice('business')}
                    isSmallTeam={teamSize <= 5}
                    billingFrequency={billingFrequency}
                    label={getPriceLabel('business')}
                    isAppSumoUser={isAppSumoUser}
                    originalMonthlyPrice={calculateOriginalMonthlyTotal('business')}
                    originalAnnualPrice={calculateOriginalAnnualTotal('business')}
                  />
                }
                selectedPlanType={selectedPlanType}
                onPlanSelect={handlePlanSelect}
                primaryActionLabel={
                  trialEligibilityChecked &&
                    canStartBusinessTrial &&
                    !isOnBusinessTrial(currentSession)
                    ? t('business-trial-start', { defaultValue: 'Start Free Trial' })
                    : t('pricing-modal:buttons.choosePlan', 'Continue with Selected Plan')
                }
                onPrimaryAction={() => {
                  if (
                    trialEligibilityChecked &&
                    canStartBusinessTrial &&
                    !isOnBusinessTrial(currentSession)
                  ) {
                    void startBusinessTrial();
                  } else {
                    handlePlanSelect('business');
                    void continueWithPaddlePlan('business');
                  }
                }}
                primaryActionDisabled={isLoadingPlans}
                primaryActionLoading={
                  trialEligibilityChecked &&
                    canStartBusinessTrial &&
                    !isOnBusinessTrial(currentSession)
                    ? businessTrialLoading
                    : loadingPlanType === 'business'
                }
                footerNote={(() => {
                  if (billingFrequency === 'annual') {
                    const annualTotal = calculateAnnualTotal('business');
                    const userText = t(
                      'pricing-modal:billing.forUsers',
                      ' for {{count}} user{{s}}',
                      { count: teamSize, s: teamSize > 1 ? 's' : '' }
                    );
                    return `$${annualTotal}/year${userText}`;
                  } else {
                    const monthlyTotal = calculateMonthlyTotal('business');
                    const userText = t(
                      'pricing-modal:billing.forUsers',
                      ' for {{count}} user{{s}}',
                      { count: teamSize, s: teamSize > 1 ? 's' : '' }
                    );
                    return `$${monthlyTotal}/month${userText}`;
                  }
                })()}
                isAppSumoUser={isAppSumoUser}
                themeMode={themeMode}
                teamSize={teamSize}
                billingFrequency={billingFrequency}
                calculateTotalCostForPlan={calculateTotalCostForPlan}
              />
            </Col>

            {/* Enterprise Plan - Hidden for AppSumo users */}
            {!isAppSumoUser && (
              <Col xs={24} md={6} lg={6}>
                <PlanCard
                  planType="enterprise"
                  title={t('pricing-modal:plans.enterprise.name')}
                  description={t('pricing-modal:plans.enterprise.description')}
                  features={generateEnterprisePlanFeatures()}
                  priceDisplay={null}
                  selectedPlanType={selectedPlanType}
                  onPlanSelect={handlePlanSelect}
                  primaryActionLabel={t(
                    'pricing-modal:buttons.contactSales',
                    'Contact Sales'
                  )}
                  onPrimaryAction={() => {
                    handlePlanSelect('enterprise');
                    if (isAppSumoUser) {
                      trackAppSumoEvent(AppSumoUpsellEvents.TALK_TO_SALES_CLICKED);
                    }
                    window.open(
                      'mailto:info@worklenz.com?subject=Enterprise%20Plan%20Inquiry',
                      '_blank'
                    );
                  }}
                  primaryActionDisabled={isLoadingPlans}
                  primaryActionLoading={loadingPlanType === 'enterprise'}
                  footerNote={null}
                  isAppSumoUser={false}
                  themeMode={themeMode}
                  teamSize={teamSize}
                  billingFrequency={billingFrequency}
                  calculateTotalCostForPlan={calculateTotalCostForPlan}
                />
              </Col>
            )}
            {upgradeModalVariant === 'customFields' && (
              <Flex vertical gap={16} style={{ marginBottom: 24 }}>
                <Flex align="center" gap={12}>
                  <TableOutlined style={{ fontSize: 28 }} />
                  <Typography.Title level={3} style={{ margin: 0 }}>
                    {t('pricing-modal:customFields.upgradeModalHeadline', {
                      defaultValue: 'Capture every detail with unlimited custom fields',
                    })}
                  </Typography.Title>
                </Flex>
                <Typography.Text type="secondary">
                  {t('pricing-modal:customFields.upgradeModalSubCopy', {
                    defaultValue:
                      'Your plan includes up to 10 custom fields. Upgrade to Business to create unlimited fields and track exactly what matters to your team.',
                  })}
                </Typography.Text>
                <Flex vertical gap={6}>
                  <Typography.Text>
                    {'• '}
                    {t('pricing-modal:customFields.benefit1', {
                      defaultValue: 'Unlimited custom fields per project',
                    })}
                  </Typography.Text>
                  <Typography.Text>
                    {'• '}
                    {t('pricing-modal:customFields.benefit2', {
                      defaultValue: 'Field types: text, number, dropdown, date, and more',
                    })}
                  </Typography.Text>
                  <Typography.Text>
                    {'• '}
                    {t('pricing-modal:customFields.benefit3', {
                      defaultValue: 'Fields sync across all task views',
                    })}
                  </Typography.Text>
                </Flex>
              </Flex>
            )}

            {upgradeModalVariant === 'customOrganizationLogo' && (
              <Flex vertical gap={16} style={{ marginBottom: 24 }}>
                <Flex align="center" gap={12}>
                  <PictureOutlined style={{ fontSize: 28 }} />
                  <Typography.Title level={3} style={{ margin: 0 }}>
                    {t('admin-center/overview:customLogoUpgradeModalHeadline', {
                      defaultValue: 'Make Worklenz yours',
                    })}
                  </Typography.Title>
                </Flex>
                <Typography.Text type="secondary">
                  {t('admin-center/overview:customLogoUpgradeModalSubCopy', {
                    defaultValue:
                      'Upgrade to Business to upload your organization logo. Your logo will replace the Worklenz logo everywhere in the app and in all system emails sent to your team and clients.',
                  })}
                </Typography.Text>
                <Flex vertical gap={6}>
                  <Typography.Text>
                    •{' '}
                    {t('admin-center/overview:customLogoUpgradeModalBenefitApp', {
                      defaultValue: 'Custom logo across the full app',
                    })}
                  </Typography.Text>
                  <Typography.Text>
                    •{' '}
                    {t('admin-center/overview:customLogoUpgradeModalBenefitEmails', {
                      defaultValue: 'Branded emails to team and clients',
                    })}
                  </Typography.Text>
                  <Typography.Text>
                    •{' '}
                    {t('admin-center/overview:customLogoUpgradeModalBenefitProfessional', {
                      defaultValue: 'Professional look for your organization',
                    })}
                  </Typography.Text>
                </Flex>
              </Flex>
            )}

            {upgradeModalVariant === 'fileSizeLimit' && (
              <Flex vertical gap={16} style={{ marginBottom: 24 }}>
                <Flex align="center" gap={12}>
                  <FileOutlined style={{ fontSize: 28 }} />
                  <Typography.Title level={3} style={{ margin: 0 }}>
                    {t('admin-center/overview:fileSizeUpgradeModalHeadline', {
                      defaultValue: 'Upload files of any size',
                    })}
                  </Typography.Title>
                </Flex>
                <Typography.Text type="secondary">
                  {t('admin-center/overview:fileSizeUpgradeModalSubCopy', {
                    defaultValue:
                      'Your current plan supports files up to 25MB. Upgrade to Business to upload files up to 250MB and keep large assets close to your project work.',
                  })}
                </Typography.Text>
                <Flex vertical gap={6}>
                  <Typography.Text>
                    •{' '}
                    {t('admin-center/overview:fileSizeUpgradeModalBenefitFileSize', {
                      defaultValue: 'File uploads up to 250MB',
                    })}
                  </Typography.Text>
                  <Typography.Text>
                    •{' '}
                    {t('admin-center/overview:fileSizeUpgradeModalBenefitStorage', {
                      defaultValue: 'Expanded total storage',
                    })}
                  </Typography.Text>
                  <Typography.Text>
                    •{' '}
                    {t('admin-center/overview:fileSizeUpgradeModalBenefitFileTypes', {
                      defaultValue: 'All file types supported',
                    })}
                  </Typography.Text>
                </Flex>
              </Flex>
            )}
          </>
        )}
      </Row>

      {paddleError && (
        <Row justify="center" style={{ marginTop: 12 }}>
          <Alert message={paddleError} type="error" showIcon />
        </Row>
      )}
    </div>
  );
};

export default UpgradePlans;
