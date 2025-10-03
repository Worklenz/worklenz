import { useEffect, useState, useMemo } from 'react';
import {
  Col,
  Flex,
  Row,
  Typography,
  message,
  Space,
  Alert,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IPricingPlans, IUpgradeSubscriptionPlanResponse } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IPaddlePlans, SUBSCRIPTION_STATUS } from '@/shared/constants';
import { useAuthService } from '@/hooks/useAuth';
import { fetchBillingInfo, toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { billingApiService, IPricingPlan } from '@/api/admin-center/billing.api.service';
import { authApiService } from '@/api/auth/auth.api.service';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  MixpanelBillingEvents,
  PlanSelectionEventProps,
  TeamSizeChangeEventProps,
  BillingFrequencyChangeEventProps,
  CheckoutEventProps,
  CheckoutResultEventProps,
  AppSumoEventProps,
  UserType,
  PlanType as MixpanelPlanType,
  BillingFrequency as MixpanelBillingFrequency,
  PricingModel
} from '@/types/mixpanel-events.types';
import { PlanTrialApiService } from '@/api/admin-center/plan-trial.api.service';
import { isOnBusinessTrial } from '@/utils/subscription-utils';

// Import our new components and utilities
import {
  PlanFeature,
  PlanPriceDisplay,
  PlanCardSkeleton,
  PlanCard,
  AppSumoAlert,
  PlanSelectionControls
} from './components';
import { usePricingCalculations, useTeamSizeOptions } from './hooks';
import { PricingData, AppSumoDiscountInfo, PlanType, BillingFrequency } from './types';
import { getInitialPricingData, mapTierBasedPricingToFrontend } from './utils';
import { 
  TEAM_SIZE_THRESHOLD, 
  MAX_TEAM_SIZE, 
  PADDLE_CHECKOUT_DELAY, 
  PADDLE_SCRIPT_URL 
} from './constants';

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

declare const Paddle: any;

const UpgradePlans = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);
  const { trackMixpanelEvent } = useMixpanelTracking();
  
  // Redux state
  const { billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  
  // Component state
  const [plans, setPlans] = useState<IPricingPlans>({});
  const [backendPlans, setBackendPlans] = useState<IPricingPlan[]>([]);
  const [pricingData, setPricingData] = useState<PricingData>(getInitialPricingData());
  const [selectedPlanType, setSelectedPlanType] = useState<PlanType>('pro');
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>('annual');
  const [teamSize, setTeamSize] = useState<number>(1);
  
  // Loading states
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [switchingToFreePlan, setSwitchingToFreePlan] = useState(false);
  const [switchingToPaddlePlan, setSwitchingToPaddlePlan] = useState(false);
  const [paddleLoading, setPaddleLoading] = useState(false);
  
  // Error states
  const [paddleError, setPaddleError] = useState<string | null>(null);

  // Business trial states
  const [canStartBusinessTrial, setCanStartBusinessTrial] = useState(false);
  const [businessTrialLoading, setBusinessTrialLoading] = useState(false);
  const [trialEligibilityChecked, setTrialEligibilityChecked] = useState(false);

  // AppSumo states
  const [appSumoDiscountInfo, setAppSumoDiscountInfo] = useState<AppSumoDiscountInfo | null>(null);
  
  // Legacy state (for compatibility)
  const [selectedPlan, setSelectedCard] = useState(IPaddlePlans.ANNUAL);
  const paddlePlans = IPaddlePlans;

  // Computed values
  const isAppSumoUser = useMemo(() => {
    const planName = billingInfo?.plan_name?.toLowerCase() || '';
    const subscriptionType = currentSession?.subscription_type?.toLowerCase() || '';
    
    // First check if user is on trial - trial users should never be considered AppSumo users
    if (currentSession?.subscription_type === 'TRIAL') {
      return false;
    }
    
    return (
      planName.includes('appsumo') ||
      subscriptionType.includes('appsumo') ||
      planName.includes('life_time_deal') ||
      subscriptionType.includes('life_time_deal')
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
    calculateOriginalAnnualTotal
  } = usePricingCalculations(teamSize, pricingData, isAppSumoUser);

  // Show a constant "Up to 30% off" label regardless of team size/plan selection
  const annualSavingsPercent = useMemo(() => {
    return 30;
  }, []);
  
  const minSelectableTeamSize = Math.max(1, billingInfo?.total_used ?? 1);
  const { generateTeamSizeOptions } = useTeamSizeOptions(
    isAppSumoUser,
    selectedPlanType,
    minSelectableTeamSize
  );

  // Helpers to derive plan limits and auto-select appropriate plan for a team size
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
    // business
    const useSmall = size <= TEAM_SIZE_THRESHOLD && pricingData.business_small;
    const max = getMaxUsersFromTier(useSmall ? pricingData.business_small : pricingData.business);
    return max ?? Number.POSITIVE_INFINITY;
  };

  // Calculate total cost for a plan based on team size
  const calculateTotalCostForPlan = (planType: 'pro' | 'business' | 'enterprise', teamSize: number, isAnnual: boolean): number => {
    if (planType === 'enterprise') {
      // Enterprise has unlimited users, so just return the base price
      return isAnnual 
        ? parseFloat(calculateAnnualTotal('enterprise'))
        : parseFloat(calculateMonthlyTotal('enterprise'));
    }

    // Temporarily override teamSize to calculate cost for the specific team size
    const originalTeamSize = teamSize;
    
    // Create a temporary pricing calculation with the specific team size
    const calculateCostForSpecificTeamSize = (plan: 'pro' | 'business' | 'enterprise') => {
      let finalPrice = 0;
      
      // Get the appropriate plan data
      let planData;
      if (plan === 'pro') {
        planData = pricingData.pro;
      } else if (plan === 'business') {
        planData = pricingData.business;
      } else {
        planData = pricingData.enterprise;
      }


      // Handle AppSumo promo plans first (check pricing_model regardless of isAppSumoUser flag)
      // This ensures correct pricing even if isAppSumoUser flag has issues
      if (planData?.pricing_model?.startsWith('promo_')) {
        finalPrice = parseFloat(planData.monthly_base_price || '0');
        if (!finalPrice && planData.annual_base_price) {
          finalPrice = parseFloat(planData.annual_base_price) / 12;
        }
        return isAnnual ? finalPrice * 12 : finalPrice;
      }

      // Regular pricing logic for non-AppSumo users
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
            ? parseFloat(planData.annual_per_user_price || planData.additional_user_price || '0') * 12
            : parseFloat(planData.monthly_per_user_price || planData.additional_user_price || '0');
          const extraUserCost = extraUsers * perUserPrice;
          finalPrice = basePrice + extraUserCost;
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
            ? parseFloat(planData.annual_per_user_price || planData.additional_user_price || '0') * 12
            : parseFloat(planData.monthly_per_user_price || planData.additional_user_price || '0');
          const extraUserCost = extraUsers * perUserPrice;
          finalPrice = basePrice + extraUserCost;
        }
      }

      return finalPrice;
    };

    return calculateCostForSpecificTeamSize(planType);
  };

  const getPlanForSize = (size: number): PlanType => {
    // Calculate actual costs for Pro and Business plans
    const isAnnual = billingFrequency === 'annual';
    const proCost = calculateTotalCostForPlan('pro', size, isAnnual);
    const businessCost = calculateTotalCostForPlan('business', size, isAnnual);
    
    // Recommend the cheaper option between Pro and Business
    if (proCost < businessCost) {
      const proMax = getMaxUsersForPlan('pro', size);
      if (size <= proMax) return 'pro';
    } else {
      const businessMax = getMaxUsersForPlan('business', size);
      if (size <= businessMax) return 'business';
    }
    
    // Fallback to Enterprise if neither Pro nor Business can handle the team size
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

  // Event handlers
  const handleTeamSizeChange = (size: number) => {
    const oldSize = teamSize;
    setTeamSize(size);

    // Auto-select plan based on cost-effectiveness
    const autoPlan = getPlanForSize(size);
    if (autoPlan !== selectedPlanType && autoPlan !== 'free') {
      setSelectedPlanType(autoPlan);
    }
    
    // Track team size change
    const eventProps: TeamSizeChangeEventProps = {
      user_type: getUserType,
      current_plan: billingInfo?.plan_name,
      current_plan_type: getCurrentPlanType,
      is_appsumo_user: isAppSumoUser,
      team_size: billingInfo?.total_used,
      subscription_status: billingInfo?.status,
      old_team_size: oldSize,
      new_team_size: size,
      selected_plan: autoPlan as MixpanelPlanType, // Use the auto-selected plan
      pricing_model: getEffectivePricingModel(autoPlan as 'pro' | 'business' | 'enterprise') as PricingModel,
    };
    trackMixpanelEvent(MixpanelBillingEvents.TEAM_SIZE_CHANGED, eventProps);
  };

  const handleBillingFrequencyChange = (frequency: BillingFrequency) => {
    const oldFrequency = billingFrequency;
    setBillingFrequency(frequency);
    setSelectedCard(frequency === 'annual' ? paddlePlans.ANNUAL : paddlePlans.MONTHLY);
    
    // Auto-select the best plan for the new billing frequency
    const autoPlan = getPlanForSize(teamSize);
    if (autoPlan !== selectedPlanType && autoPlan !== 'free') {
      setSelectedPlanType(autoPlan);
    }
    
    // Track billing frequency change
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
      selected_plan: autoPlan as MixpanelPlanType, // Use the auto-selected plan
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
    
    // Track plan selection
    const effectivePricingModel = planType !== 'free' && planType !== 'enterprise' 
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
      calculated_monthly_price: planType !== 'free' ? parseFloat(calculateMonthlyTotal(planType as 'pro' | 'business' | 'enterprise')) : 0,
      calculated_annual_price: planType !== 'free' ? parseFloat(calculateAnnualTotal(planType as 'pro' | 'business' | 'enterprise')) : 0,
      discount_applied: isAppSumoUser,
      discount_percentage: isAppSumoUser ? 50 : undefined,
      is_small_team: teamSize <= TEAM_SIZE_THRESHOLD,
    };
    trackMixpanelEvent(MixpanelBillingEvents.PLAN_SELECTED, eventProps);

    // Optional: compare plans interaction
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
    
    // Set static AppSumo promo info without countdown
    setAppSumoDiscountInfo({
      remainingDays: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      eligibleForDiscount: true,
      urgencyLevel: 'medium',
      message: '🎉 Special 50% OFF pricing for AppSumo lifetime deal members',
    });
    
    // Track AppSumo discount viewed
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
      
      // Fetch basic plan info
      const res = await adminCenterApiService.getPlans();
      if (res.done) {
        setPlans(res.body);
      }

      // Fetch tier-based pricing data
      const pricingRes = await billingApiService.getPricingPlans();
      if (pricingRes.done && pricingRes.body) {
        const tiers = pricingRes.body.tiers || [];

        // Filter tiers for AppSumo users - show only Business and Enterprise plans
        let filteredTiers = tiers;
        if (isAppSumoUser) {
          // AppSumo/Lifetime users should ALWAYS see the AppSumo promo plans
          // (not time-limited - they have lifetime access to these special prices)
          filteredTiers = tiers.filter((tier: any) => {
            const tierName = tier.tier_name;
            
            // Include ONLY the specific AppSumo tier plans
            return tierName === 'APPSUMO_BUSINESS' || tierName === 'APPSUMO_ENTERPRISE';
          });

          setDefaultAppSumoInfo();
        }
        // For non-AppSumo users, hide AppSumo promo tiers entirely
        else {
          filteredTiers = tiers.filter((tier: any) => {
            const tierName = tier.tier_name as string;
            return !(tierName && tierName.startsWith('APPSUMO_'));
          });
        }

        setBackendPlans(filteredTiers as any);
        const mappedPricing = mapTierBasedPricingToFrontend(filteredTiers);
        setPricingData(mappedPricing);
      } else {
        // Track pricing fetch error
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
      message.error('Failed to load pricing plans. Please refresh the page.');
      // Track pricing fetch error
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
        // Track downgrade to free and free plan switch completed
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

  // Paddle integration functions
  const handlePaddleCallback = (data: any) => {
    switch (data.event) {
      case 'Checkout.Loaded':
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        break;
      case 'Checkout.Complete':
        // Track successful checkout
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
          pricing_model: getEffectivePricingModel(selectedPlanType as 'pro' | 'business' | 'enterprise') as PricingModel,
          discount_applied: isAppSumoUser,
          discount_percentage: isAppSumoUser ? 50 : undefined,
          success: true,
        };
        trackMixpanelEvent(MixpanelBillingEvents.CHECKOUT_COMPLETED, checkoutSuccessProps);
        // Also track plan upgraded/downgraded (compare current vs selected)
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
            if (direction > 0) {
              // Upgraded
              trackMixpanelEvent('plan_upgraded' as any, baseProps);
            } else if (direction < 0) {
              // Downgraded
              trackMixpanelEvent('downgraded_plan' as any, baseProps);
            }
          }
        }
        
        message.success('Subscription updated successfully!');
        setPaddleLoading(true);
        
        // Refetch user session data to get updated subscription info
        authApiService.verify()
          .then(authorizeResponse => {
            if (authorizeResponse.authenticated) {
              setSession(authorizeResponse.user);
              dispatch(setUser(authorizeResponse.user));
              authService.setCurrentSession(authorizeResponse.user);
            }
          })
          .catch(error => {
            logger.error('Error refreshing session after checkout', error);
          });
        
        setTimeout(() => {
          dispatch(fetchBillingInfo());
          dispatch(toggleUpgradeModal());
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
        }, PADDLE_CHECKOUT_DELAY);
        break;
      case 'Checkout.Close':
        // Track checkout abandonment
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
        break;
      case 'Checkout.Error':
        // Track checkout failure
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
          pricing_model: getEffectivePricingModel(selectedPlanType as 'pro' | 'business' | 'enterprise') as PricingModel,
          discount_applied: isAppSumoUser,
          discount_percentage: isAppSumoUser ? 50 : undefined,
          success: false,
          error_message: data.error?.message || 'Unknown error',
          error_code: data.error?.code,
        };
        trackMixpanelEvent(MixpanelBillingEvents.CHECKOUT_FAILED, checkoutFailProps);
        
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        setPaddleError(data.error?.message || 'An error occurred during checkout');
        message.error('Error during checkout: ' + (data.error?.message || 'Unknown error'));
        logger.error('Paddle checkout error', data.error);
        break;
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
      setPaddleLoading(false);
      setPaddleError('Failed to load Paddle checkout');
      message.error('Failed to load payment processor');
      logger.error('Failed to load Paddle script');

      // Track Paddle load error
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

  const upgradeToPaddlePlan = async (planId: string) => {
    try {
      setSwitchingToPaddlePlan(true);
      setPaddleLoading(true);
      setPaddleError(null);
      const effectivePricingModel = getEffectivePricingModel(
        selectedPlanType as 'pro' | 'business' | 'enterprise'
      );
      
      // Track checkout initiation
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
        checkout_amount: billingFrequency === 'annual' 
          ? parseFloat(calculateAnnualTotal(selectedPlanType as 'pro' | 'business' | 'enterprise'))
          : parseFloat(calculateMonthlyTotal(selectedPlanType as 'pro' | 'business' | 'enterprise')),
        pricing_model: effectivePricingModel as PricingModel,
        discount_applied: isAppSumoUser,
        discount_percentage: isAppSumoUser ? 50 : undefined,
      };
      
      // Track AppSumo upgrade if applicable
      if (isAppSumoUser) {
        trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_UPGRADE_INITIATED, checkoutProps);
      }
      
      trackMixpanelEvent(MixpanelBillingEvents.CHECKOUT_INITIATED, checkoutProps);

      const shouldUseUpgradeAPI =
        !billingInfo?.subscription_id ||
        isFreeUser ||
        billingInfo?.status === SUBSCRIPTION_STATUS.TRIALING ||
        billingInfo?.status === SUBSCRIPTION_STATUS.PASTDUE ||
        billingInfo?.status === SUBSCRIPTION_STATUS.DELETED;

      if (shouldUseUpgradeAPI) {
        const apiPricingModel = effectivePricingModel === 'base_plan' ? 'regular' : 'per_user';

        const res = await billingApiService.upgradeToPaidPlan(
          planId,
          apiPricingModel as 'per_user' | 'regular',
          effectivePricingModel === 'per_user' ? teamSize : undefined
        );

        if (res.done) {
          initializePaddle(res.body);
        } else {
          console.error('Upgrade API failed:', res);
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
          setPaddleError(`Failed to prepare checkout: ${res.message || 'Unknown error'}`);
          message.error(`Failed to prepare checkout: ${res.message || 'Unknown error'}`);
        }
      } else if (
        billingInfo?.status === SUBSCRIPTION_STATUS.ACTIVE ||
        billingInfo?.status === SUBSCRIPTION_STATUS.PAUSED
      ) {
        const res = await adminCenterApiService.changePlan(planId);
        if (res.done) {
          // Track plan upgrade/downgrade for direct plan change path
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
            if (direction > 0) {
              trackMixpanelEvent('plan_upgraded' as any, baseProps);
            } else if (direction < 0) {
              trackMixpanelEvent('downgraded_plan' as any, baseProps);
            }
          }
          message.success('Subscription plan changed successfully!');
          dispatch(fetchBillingInfo());
          dispatch(toggleUpgradeModal());
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
        } else {
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
          setPaddleError('Failed to change plan');
          message.error('Failed to change subscription plan');
        }
      } else {
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        setPaddleError('Unable to process plan selection');
        message.error('Unable to process plan selection. Please contact support.');
      }
    } catch (error) {
      setSwitchingToPaddlePlan(false);
      setPaddleLoading(false);
      setPaddleError('Error upgrading to paid plan');
      message.error('Failed to upgrade to paid plan');
      logger.error('Error upgrading to paddle plan', error);
    }
  };

  const continueWithPaddlePlan = async (planType?: 'pro' | 'business' | 'enterprise') => {
    if (teamSize >= MAX_TEAM_SIZE) {
      message.info('Please contact sales for custom pricing on large teams');
      return;
    }

    try {
      setSwitchingToPaddlePlan(true);
      setPaddleError(null);
      let planId: string | null = null;

      const isAnnual = billingFrequency === 'annual';
      const targetPlanType = planType || selectedPlanType;

      if (!targetPlanType || targetPlanType === 'free') {
        setSwitchingToPaddlePlan(false);
        setPaddleError('Please select a paid plan first');
        message.error('Please select a plan first');
        return;
      }

      // Get the correct plan ID based on selected plan type and team size
      const getPlanIdForType = (type: typeof targetPlanType) => {
        if (type === 'pro') {
          // Check if small plan exists and has valid plan IDs
          const useSmallPlan = teamSize <= TEAM_SIZE_THRESHOLD && 
                               pricingData.pro_small &&
                               (isAnnual ? pricingData.pro_small.annual_plan_id : pricingData.pro_small.monthly_plan_id);
          
          const planData = useSmallPlan ? pricingData.pro_small : pricingData.pro;
          return isAnnual ? planData?.annual_plan_id : planData?.monthly_plan_id;
        } else if (type === 'business') {
          // Check if small plan exists and has valid plan IDs
          const useSmallPlan = teamSize <= TEAM_SIZE_THRESHOLD && 
                               pricingData.business_small &&
                               (isAnnual ? pricingData.business_small.annual_plan_id : pricingData.business_small.monthly_plan_id);
          
          const planData = useSmallPlan ? pricingData.business_small : pricingData.business;
          return isAnnual ? planData?.annual_plan_id : planData?.monthly_plan_id;
        } else if (type === 'enterprise') {
          return isAnnual
            ? pricingData.enterprise?.annual_plan_id
            : pricingData.enterprise?.monthly_plan_id;
        }
        return null;
      };

      planId = getPlanIdForType(targetPlanType) ?? null;

      if (!planId) {
        console.error('Plan ID not found', {
          targetPlanType,
          teamSize,
          isAnnual,
          pricingData,
        });
      }

      setSelectedCard(isAnnual ? paddlePlans.ANNUAL : paddlePlans.MONTHLY);

      if (planType) {
        setSelectedPlanType(planType);
      }

      if (planId) {
        await upgradeToPaddlePlan(planId);
      } else {
        setSwitchingToPaddlePlan(false);
        const errorMsg = `Plan not available: ${targetPlanType} (${billingFrequency}) for ${teamSize} users. Please try a different configuration or contact support.`;
        setPaddleError(errorMsg);
        message.error('Selected plan is not available. Please try a different configuration.');
      }
    } catch (error) {
      setSwitchingToPaddlePlan(false);
      setPaddleError('Error processing request');
      message.error('Error processing request');
      logger.error('Error upgrading to paddle plan', error);
    }
  };

  // Start Business Plan Trial
  const startBusinessTrial = async () => {
    setBusinessTrialLoading(true);
    try {
      const response = await PlanTrialApiService.startBusinessTrial();
      if (response.done) {
        message.success(
          t('business-trial-started', { defaultValue: 'Business trial started successfully! Refreshing...' })
        );
        // Refresh session and close modal
        setTimeout(() => {
          window.location.reload();
        }, 1500);
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
      setBusinessTrialLoading(false);
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

    // Set team size based on user type
    if (isAppSumoUser) {
      // For AppSumo users, always default to 50 users
      setTeamSize(50);
    } else if (billingInfo?.total_used !== undefined) {
      // For regular users, use their actual team size
      // Ensure team size is never negative (can happen with AppSumo users due to free_count calculations)
      // Also handle cases where actual team size might be larger than standard options
      const actualTeamSize = Math.max(1, billingInfo.total_used);
      setTeamSize(actualTeamSize);
    }
  }, [billingInfo, isAppSumoUser]);

  // Check Business trial eligibility
  useEffect(() => {
    const checkTrialEligibility = async () => {
      if (!currentSession || isOnBusinessTrial(currentSession)) {
        setTrialEligibilityChecked(true);
        return;
      }

      try {
        const response = await PlanTrialApiService.checkBusinessTrialEligibility();
        if (response.done && response.body) {
          setCanStartBusinessTrial(response.body.can_start_trial || false);
        }
      } catch (error) {
        console.error('Failed to check Business trial eligibility:', error);
        setCanStartBusinessTrial(false);
      } finally {
        setTrialEligibilityChecked(true);
      }
    };

    checkTrialEligibility();
  }, [currentSession]);

  useEffect(() => {
    return () => {
      const paddleScript = document.querySelector('script[src*="paddle.js"]');
      if (paddleScript) {
        paddleScript.remove();
      }
    };
  }, []);

  // Plan feature generators
  const generateFreePlanFeatures = () => [
    ...(plans.projects_limit ? [<PlanFeature key="1" text={`${plans.projects_limit} ${t('projects', 'Projects')}`} />] : []),
    ...(plans.team_member_limit ? [<PlanFeature key="2" text={`${plans.team_member_limit} ${t('users', 'Users')}`} />] : []),
    <PlanFeature key="3" text={t('taskListKanban', 'Task List & Kanban Board')} />,
    <PlanFeature key="4" text={t('personalViews', 'Personal Task & Calendar Views')} />,
    <PlanFeature key="5" text={t('fileUploads', 'File Uploads & Comments')} />,
    <PlanFeature key="6" text={t('labelsFilters', 'Labels & Filters')} />,
  ];

  const generateProPlanFeatures = () => [
    <PlanFeature key="1" text={t('unlimitedProjects', 'Unlimited Projects')} />,
    <PlanFeature key="2" text={`${teamSize <= TEAM_SIZE_THRESHOLD && pricingData.pro_small?.pricing_model === 'per_user' 
      ? t('pricing-modal:plans.pro.payPerUser', 'Pay per user (1-5 users)') 
      : t('pricing-modal:plans.pro.usersIncluded', '{{count}} Users Included', { count: Number(pricingData.pro.users_included ?? pricingData.pro.included_users ?? 0) })}`} />,
    <PlanFeature key="3" text={t('pricing-modal:plans.pro.maxUsers', 'Up to {{count}} Users Max', { 
      count: (() => {
        const maxStr = teamSize <= TEAM_SIZE_THRESHOLD && pricingData.pro_small 
          ? pricingData.pro_small.max_users 
          : pricingData.pro.max_users;
        return maxStr ? Number(maxStr) : undefined;
      })()
    })} />,
    ...(getEffectivePricingModel('pro') === 'base_plan'
      ? [
          <PlanFeature
            key="extra-pro"
            text={t(
              'pricing-modal:plans.additionalUsersCharged',
              'Additional users beyond included: ${{price}}/user/month',
              {
                price:
                  pricingData.pro?.monthly_per_user_price ||
                  pricingData.pro?.additional_user_price ||
                  '5.99',
              }
            )}
          />,
        ]
      : []),
    <PlanFeature key="4" text={t('timeTracking', 'Time Tracking & Analytics')} />,
    <PlanFeature key="5" text={t('projectTemplates', 'Project Templates & Phases')} />,
    <PlanFeature key="6" text={t('ganttReadOnly', 'Gantt Charts (Read-only)')} />,
    <PlanFeature key="7" text={t('customFields', 'Custom Fields & Subtasks')} />,
    <PlanFeature key="8" text={t('projectInsights', 'Project Insights & Reports')} />,
  ];

  const generateBusinessPlanFeatures = () => [
    <Typography.Text key="header" strong style={{ display: 'block', marginBottom: 12, textAlign: 'center' }}>
      {t('everythingInPro', 'Everything in Pro, plus:')}
    </Typography.Text>,
    <PlanFeature key="1" text={`${teamSize <= TEAM_SIZE_THRESHOLD && pricingData.business_small?.pricing_model === 'per_user'
      ? t('pricing-modal:plans.business.payPerUser', 'Pay per user (1-5 users)')
      : t('pricing-modal:plans.business.usersIncluded', '{{count}} Users Included', { count: Number(pricingData.business.users_included ?? pricingData.business.included_users ?? 0) })}`} />,
    <PlanFeature key="2" text={`${isAppSumoUser 
      ? t('pricing-modal:plans.business.maxUsersAppSumo', 'Up to 100 Users Included (AppSumo Special)')
      : t('pricing-modal:plans.business.maxUsers', 'Up to {{count}} Users Max', { 
          count: (() => {
            const maxStr = teamSize <= TEAM_SIZE_THRESHOLD && pricingData.business_small 
              ? pricingData.business_small.max_users 
              : pricingData.business.max_users;
            return maxStr ? Number(maxStr) : undefined;
          })()
        })}`} />,
    ...(getEffectivePricingModel('business') === 'base_plan'
      ? [
          <PlanFeature
            key="extra-business"
            text={t(
              'pricing-modal:plans.additionalUsersCharged',
              'Additional users beyond included: ${{price}}/user/month',
              {
                price:
                  pricingData.business?.monthly_per_user_price ||
                  pricingData.business?.additional_user_price ||
                  '5.99',
              }
            )}
          />,
        ]
      : []),
    <PlanFeature key="3" text={t('fullGanttCharts', 'Full Gantt Charts')} />,
    <PlanFeature key="4" text={t('projectHealth', 'Project Health Monitoring')} />,
    <PlanFeature key="5" text={t('clientPortal', 'Client Portal')} />,
    <PlanFeature key="6" text={t('financeTracking', 'Finance & Billable Tracking')} />,
    <PlanFeature key="7" text={t('scheduler', 'Advanced Scheduler')} />,
  ];

  const generateEnterprisePlanFeatures = () => [
    <Typography.Text key="header" strong style={{ display: 'block', marginBottom: 12, textAlign: 'center' }}>
      {t('everythingInBusiness', 'Everything in Business, plus:')}
    </Typography.Text>,
    <PlanFeature key="1" text={`${pricingData.enterprise.users_included} Users`} />,
    <PlanFeature key="2" text={t('noExtraUserCost', 'No Extra User Cost')} />,
    <PlanFeature key="3" text={t('advancedSecurity', 'Advanced Security')} />,
    <PlanFeature key="4" text={t('customIntegrations', 'Custom Integrations')} />,
    <PlanFeature key="5" text={t('prioritySupport', 'Priority Support')} />,
  ];

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
      {!isAppSumoUser && !isLoadingPlans && (pricingData.pro_small || pricingData.business_small) && (
        <Row justify="center" style={{ marginBottom: 8 }}>
          <Space direction="vertical" size="small" style={{ textAlign: 'center' }}>
            {billingInfo?.total_used && (
              <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                {teamSize <= TEAM_SIZE_THRESHOLD && (pricingData.pro_small || pricingData.business_small)
                  ? t('pricing-modal:pricingModel.autoPerUser', 'Automatically using per-user pricing for {{count}} user{{s}}', {
                      count: teamSize,
                      s: teamSize > 1 ? 's' : ''
                    })
                  : t('pricing-modal:pricingModel.autoBase', 'Automatically using base plan pricing for {{count}} user{{s}}', {
                      count: teamSize,
                      s: teamSize > 1 ? 's' : ''
                    })}
              </Typography.Text>
            )}
            {(() => {
              // Show extra user charge when on base plan and exceeding included users
              if (isAppSumoUser) return null;
              if (selectedPlanType === 'enterprise' || !selectedPlanType) return null;
              const effectiveModel = getEffectivePricingModel(selectedPlanType as 'pro' | 'business' | 'enterprise');
              if (effectiveModel !== 'base_plan') return null;
              const planData = selectedPlanType === 'pro' ? pricingData.pro : pricingData.business;
              const included = Number(planData?.included_users || planData?.users_included);
              if (!included || Number.isNaN(included)) return null;
              if (teamSize <= included) return null;
              const perUserMonthly = planData?.monthly_per_user_price || planData?.additional_user_price || '5.99';
              return (
                <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                  {t('pricing-modal:pricingModel.additionalUserCharge', 'Includes {{included}} users. Each additional user is ${{price}}/month.', {
                    included,
                    price: perUserMonthly,
                  })}
                </Typography.Text>
              );
            })()}
          </Space>
        </Row>
      )}

      {/* Pricing Cards */}
      <Row className="w-full" gutter={[12, 12]} style={{ marginTop: 8 }}>
        {/* Show loading skeletons when loading */}
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
                  primaryActionLabel={t('pricing-modal:buttons.choosePlan', 'Continue with Selected Plan')}
                  onPrimaryAction={() => {
                    handlePlanSelect('pro');
                    void continueWithPaddlePlan('pro');
                  }}
                  primaryActionDisabled={isLoadingPlans}
                  primaryActionLoading={switchingToPaddlePlan || paddleLoading}
                  footerNote={(() => {
                    if (billingFrequency === 'annual') {
                      const annualTotal = calculateAnnualTotal('pro');
                      const userText = t('pricing-modal:billing.forUsers', ' for {{count}} user{{s}}', { count: teamSize, s: teamSize > 1 ? 's' : '' });
                      return `$${annualTotal}/year${userText}`;
                    } else {
                      const monthlyTotal = calculateMonthlyTotal('pro');
                      const userText = t('pricing-modal:billing.forUsers', ' for {{count}} user{{s}}', { count: teamSize, s: teamSize > 1 ? 's' : '' });
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
            <Col xs={24} md={isAppSumoUser ? 12 : 6} lg={isAppSumoUser ? 12 : 6}>
              <PlanCard
                planType="business"
                title={isAppSumoUser ? t('pricing-modal:plans.business.namePromo', 'Business (AppSumo Special)') : t('pricing-modal:plans.business.name')}
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
                  trialEligibilityChecked && canStartBusinessTrial && !isOnBusinessTrial(currentSession)
                    ? t('business-trial-start', { defaultValue: 'Start Free Trial' })
                    : t('pricing-modal:buttons.choosePlan', 'Continue with Selected Plan')
                }
                onPrimaryAction={() => {
                  if (trialEligibilityChecked && canStartBusinessTrial && !isOnBusinessTrial(currentSession)) {
                    void startBusinessTrial();
                  } else {
                    handlePlanSelect('business');
                    void continueWithPaddlePlan('business');
                  }
                }}
                primaryActionDisabled={isLoadingPlans}
                primaryActionLoading={
                  trialEligibilityChecked && canStartBusinessTrial && !isOnBusinessTrial(currentSession)
                    ? businessTrialLoading
                    : switchingToPaddlePlan || paddleLoading
                }
                footerNote={(() => {
                  if (billingFrequency === 'annual') {
                    const annualTotal = calculateAnnualTotal('business');
                    const userText = t('pricing-modal:billing.forUsers', ' for {{count}} user{{s}}', { count: teamSize, s: teamSize > 1 ? 's' : '' });
                    return `$${annualTotal}/year${userText}`;
                  } else {
                    const monthlyTotal = calculateMonthlyTotal('business');
                    const userText = t('pricing-modal:billing.forUsers', ' for {{count}} user{{s}}', { count: teamSize, s: teamSize > 1 ? 's' : '' });
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

            {/* Enterprise Plan */}
            <Col xs={24} md={isAppSumoUser ? 12 : 6} lg={isAppSumoUser ? 12 : 6}>
              <PlanCard
                planType="enterprise"
                title={isAppSumoUser ? t('pricing-modal:plans.enterprise.namePromo', 'Enterprise (AppSumo Special)') : t('pricing-modal:plans.enterprise.name')}
                description={t('pricing-modal:plans.enterprise.description')}
                features={generateEnterprisePlanFeatures()}
                priceDisplay={
                  <PlanPriceDisplay
                    monthlyPrice={calculateMonthlyTotal('enterprise')}
                    annualPrice={calculateAnnualTotal('enterprise')}
                    perUserMonthlyPrice={null}
                    perUserAnnualPrice={null}
                    isSmallTeam={false}
                    billingFrequency={billingFrequency}
                    label={getPriceLabel('enterprise')}
                    isAppSumoUser={isAppSumoUser}
                    originalMonthlyPrice={calculateOriginalMonthlyTotal('enterprise')}
                    originalAnnualPrice={calculateOriginalAnnualTotal('enterprise')}
                  />
                }
                selectedPlanType={selectedPlanType}
                onPlanSelect={handlePlanSelect}
                primaryActionLabel={t('pricing-modal:buttons.choosePlan', 'Continue with Selected Plan')}
                onPrimaryAction={() => {
                  handlePlanSelect('enterprise');
                  void continueWithPaddlePlan('enterprise');
                }}
                primaryActionDisabled={isLoadingPlans}
                primaryActionLoading={switchingToPaddlePlan || paddleLoading}
                footerNote={(() => {
                  if (billingFrequency === 'annual') {
                    const annualTotal = calculateAnnualTotal('enterprise');
                    return `$${annualTotal}/year`;
                  } else {
                    const monthlyTotal = calculateMonthlyTotal('enterprise');
                    return `$${monthlyTotal}/month`;
                  }
                })()}
                isAppSumoUser={isAppSumoUser}
                themeMode={themeMode}
                teamSize={teamSize}
                billingFrequency={billingFrequency}
                calculateTotalCostForPlan={calculateTotalCostForPlan}
              />
            </Col>
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