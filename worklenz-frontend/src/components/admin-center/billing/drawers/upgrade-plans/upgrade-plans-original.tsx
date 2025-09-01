import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Button,
  Card,
  Col,
  Flex,
  Row,
  Select,
  Tag,
  Tooltip,
  Typography,
  message,
  Space,
  CheckCircleFilled,
  Alert,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import {
  IPricingPlans,
  IUpgradeSubscriptionPlanResponse,
  IPricingOption,
} from '@/types/admin-center/admin-center.types';
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
  const [plans, setPlans] = useState<IPricingPlans>({});
  const [backendPlans, setBackendPlans] = useState<IPricingPlan[]>([]);
  const [selectedPlan, setSelectedCard] = useState(IPaddlePlans.ANNUAL);
  const [teamSize, setTeamSize] = useState<number>(1);
  const [switchingToFreePlan, setSwitchingToFreePlan] = useState(false);

  // Single billing frequency for all plans
  const [billingFrequency, setBillingFrequency] = useState<'monthly' | 'annual'>('annual');

  // Track which plan type is selected
  const [selectedPlanType, setSelectedPlanType] = useState<
    'free' | 'pro' | 'business' | 'enterprise'
  >('pro');

  // Helper function to determine effective pricing model based on team size
  const getEffectivePricingModel = (planType: 'pro' | 'business' | 'enterprise') => {
    if (planType === 'enterprise') return 'base_plan';
    return teamSize <= 5 &&
      ((planType === 'pro' && pricingData.pro_small) ||
        (planType === 'business' && pricingData.business_small))
      ? 'per_user'
      : 'base_plan';
  };

  // Pricing data populated from backend (no hardcoded defaults)
  const [pricingData, setPricingData] = useState({
    free: {
      monthly_price: '0',
      annual_price: '0',
      users_included: '',
      max_users: '',
      pricing_model: 'free',
      tier_id: '',
    },
    pro: {
      monthly_price: '',
      annual_price: '',
      annual_total: '',
      users_included: '',
      max_users: '',
      additional_user_price: '',
      monthly_plan_id: '',
      annual_plan_id: '',
      pricing_model: 'base_plan',
      tier_id: '',
    },
    pro_small: {
      monthly_price: '',
      annual_price: '',
      users_included: '',
      max_users: '',
      pricing_model: 'per_user',
      additional_user_price: '',
      monthly_plan_id: '',
      annual_plan_id: '',
      tier_id: '',
    },
    business: {
      monthly_price: '',
      annual_price: '',
      annual_total: '',
      users_included: '',
      max_users: '',
      additional_user_price: '',
      monthly_plan_id: '',
      annual_plan_id: '',
      pricing_model: 'base_plan',
      tier_id: '',
    },
    business_small: {
      monthly_price: '',
      annual_price: '',
      users_included: '',
      max_users: '',
      pricing_model: 'per_user',
      additional_user_price: '',
      monthly_plan_id: '',
      annual_plan_id: '',
      tier_id: '',
    },
    enterprise: {
      monthly_price: '',
      annual_price: '',
      annual_total: '',
      users_included: 'Unlimited',
      max_users: 'Unlimited',
      additional_user_price: '0',
      monthly_plan_id: '',
      annual_plan_id: '',
      pricing_model: 'base_plan',
      tier_id: '',
    },
  });

  const [switchingToPaddlePlan, setSwitchingToPaddlePlan] = useState(false);
  const currentSession = useAuthService().getCurrentSession();
  const paddlePlans = IPaddlePlans;

  const { billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const [paddleLoading, setPaddleLoading] = useState(false);
  const [paddleError, setPaddleError] = useState<string | null>(null);
  const [appSumoDiscountInfo, setAppSumoDiscountInfo] = useState<{
    remainingDays: number;
    remainingHours: number;
    remainingMinutes: number;
    eligibleForDiscount: boolean;
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  } | null>(null);

  const generateTeamSizeOptions = () => {
    const options: { value: number; label: string }[] = [];

    // Always show 1-5 for small teams
    for (let i = 1; i <= 5; i++) {
      options.push({ value: i, label: `${i} user${i > 1 ? 's' : ''}` });
    }

    // For AppSumo users, show up to 50 users with special highlighting
    const maxUsers = isAppSumoUser() ? 50 : 95;
    const showAppSumoLabel = isAppSumoUser() && selectedPlanType === 'business';

    // Show multiples of 5 up to the maximum
    for (let i = 10; i <= maxUsers; i += 5) {
      const label =
        showAppSumoLabel && i > 25 && i <= 50 ? `${i} users (AppSumo Special)` : `${i} users`;
      options.push({ value: i, label });
    }

    // For non-AppSumo users, continue to 95
    if (!isAppSumoUser()) {
      for (let i = 55; i <= 95; i += 5) {
        options.push({ value: i, label: `${i} users` });
      }
    }

    return options;
  };

  // Function to map new tier-based pricing data to our frontend structure
  const mapTierBasedPricingToFrontend = (tiers: any[]) => {
    const mapped: any = {
      free: {
        monthly_price: '0',
        annual_price: '0',
        users_included: '',
        max_users: '',
        pricing_model: 'free',
        tier_id: '',
      },
      pro: {
        monthly_price: '',
        annual_price: '',
        annual_total: '',
        users_included: '',
        max_users: '',
        additional_user_price: '',
        monthly_plan_id: '',
        annual_plan_id: '',
        pricing_model: 'base_plan',
        tier_id: '',
      },
      pro_small: {
        monthly_price: '',
        annual_price: '',
        users_included: '',
        max_users: '',
        additional_user_price: '',
        monthly_plan_id: '',
        annual_plan_id: '',
        pricing_model: 'per_user',
        tier_id: '',
      },
      business: {
        monthly_price: '',
        annual_price: '',
        annual_total: '',
        users_included: '',
        max_users: '',
        additional_user_price: '',
        monthly_plan_id: '',
        annual_plan_id: '',
        pricing_model: 'base_plan',
        tier_id: '',
      },
      business_small: {
        monthly_price: '',
        annual_price: '',
        users_included: '',
        max_users: '',
        additional_user_price: '',
        monthly_plan_id: '',
        annual_plan_id: '',
        pricing_model: 'per_user',
        tier_id: '',
      },
      enterprise: {
        monthly_price: '',
        annual_price: '',
        annual_total: '',
        users_included: 'Unlimited',
        max_users: 'Unlimited',
        additional_user_price: '0',
        monthly_plan_id: '',
        annual_plan_id: '',
        pricing_model: 'base_plan',
        tier_id: '',
      },
    };

    tiers.forEach(tier => {
      // Map based on tier name from the database
      if (tier.tier_name === 'PRO_SMALL') {
        // Pro small team (per-user pricing for 1-5 users)
        mapped.pro_small.monthly_price = tier.monthly_per_user_price?.toString() || '';
        mapped.pro_small.annual_price = tier.annual_per_user_price?.toString() || '';
        mapped.pro_small.users_included = tier.min_users?.toString() || '';
        mapped.pro_small.max_users = tier.max_users?.toString() || '';
        mapped.pro_small.additional_user_price = tier.monthly_per_user_price?.toString() || '';
        mapped.pro_small.pricing_model = 'per_user';
        mapped.pro_small.monthly_plan_id =
          tier.plans?.monthly_plan_id || tier.monthly_paddle_plan_id || tier.paddle_plan_id || '';
        mapped.pro_small.annual_plan_id =
          tier.plans?.annual_plan_id || tier.annual_paddle_plan_id || tier.paddle_plan_id || '';
        mapped.pro_small.tier_id = tier.id;
      } else if (tier.tier_name === 'PRO_LARGE') {
        // Pro large team (flat rate + overage for 6+ users)
        mapped.pro.monthly_price = tier.monthly_base_price?.toString() || '';
        mapped.pro.annual_price = tier.annual_base_price
          ? (Number(tier.annual_base_price) / 12).toFixed(2)
          : '';
        mapped.pro.annual_total = tier.annual_base_price?.toString() || '';
        mapped.pro.users_included = tier.included_users?.toString() || '';
        mapped.pro.max_users = tier.max_users?.toString() || '';
        mapped.pro.additional_user_price = tier.monthly_per_user_price?.toString() || '';
        mapped.pro.pricing_model = 'base_plan';
        mapped.pro.monthly_plan_id =
          tier.plans?.monthly_plan_id || tier.monthly_paddle_plan_id || tier.paddle_plan_id || '';
        mapped.pro.annual_plan_id =
          tier.plans?.annual_plan_id || tier.annual_paddle_plan_id || tier.paddle_plan_id || '';
        mapped.pro.tier_id = tier.id;
      } else if (tier.tier_name === 'BUSINESS_SMALL') {
        // Business small team (per-user pricing for 1-5 users)
        mapped.business_small.monthly_price = tier.monthly_per_user_price?.toString() || '';
        mapped.business_small.annual_price = tier.annual_per_user_price?.toString() || '';
        mapped.business_small.users_included = tier.min_users?.toString() || '';
        mapped.business_small.max_users = tier.max_users?.toString() || '';
        mapped.business_small.additional_user_price = tier.monthly_per_user_price?.toString() || '';
        mapped.business_small.pricing_model = 'per_user';
        mapped.business_small.monthly_plan_id =
          tier.plans?.monthly_plan_id || tier.monthly_paddle_plan_id || tier.paddle_plan_id || '';
        mapped.business_small.annual_plan_id =
          tier.plans?.annual_plan_id || tier.annual_paddle_plan_id || tier.paddle_plan_id || '';
        mapped.business_small.tier_id = tier.id;
      } else if (tier.tier_name === 'BUSINESS_LARGE') {
        // Business large team (flat rate + overage for 6+ users)
        mapped.business.monthly_price = tier.monthly_base_price?.toString() || '';
        mapped.business.annual_price = tier.annual_base_price
          ? (Number(tier.annual_base_price) / 12).toFixed(2)
          : '';
        mapped.business.annual_total = tier.annual_base_price?.toString() || '';
        mapped.business.users_included = tier.included_users?.toString() || '';
        mapped.business.max_users = tier.max_users?.toString() || '';
        mapped.business.additional_user_price = tier.monthly_per_user_price?.toString() || '';
        mapped.business.pricing_model = 'base_plan';
        mapped.business.monthly_plan_id =
          tier.plans?.monthly_plan_id || tier.monthly_paddle_plan_id || tier.paddle_plan_id || '';
        mapped.business.annual_plan_id =
          tier.plans?.annual_plan_id || tier.annual_paddle_plan_id || tier.paddle_plan_id || '';
        mapped.business.tier_id = tier.id;
      } else if (tier.tier_name === 'ENTERPRISE') {
        // Enterprise plan (flat rate, unlimited users)
        mapped.enterprise.monthly_price = tier.monthly_base_price?.toString() || '';
        mapped.enterprise.annual_price = tier.annual_base_price
          ? (Number(tier.annual_base_price) / 12).toFixed(2)
          : '';
        mapped.enterprise.annual_total = tier.annual_base_price?.toString() || '';
        mapped.enterprise.users_included = 'Unlimited';
        mapped.enterprise.max_users = 'Unlimited';
        mapped.enterprise.additional_user_price = '0';
        mapped.enterprise.pricing_model = 'base_plan';
        mapped.enterprise.monthly_plan_id =
          tier.plans?.monthly_plan_id || tier.monthly_paddle_plan_id || tier.paddle_plan_id || '';
        mapped.enterprise.annual_plan_id =
          tier.plans?.annual_plan_id || tier.annual_paddle_plan_id || tier.paddle_plan_id || '';
        mapped.enterprise.tier_id = tier.id;
      } else if (tier.tier_name === 'FREE') {
        // Free plan
        mapped.free.monthly_price = '0';
        mapped.free.annual_price = '0';
        mapped.free.users_included = tier.included_users?.toString() || '';
        mapped.free.max_users = tier.max_users?.toString() || '';
        mapped.free.additional_user_price = '0';
        mapped.free.pricing_model = 'free';
        mapped.free.tier_id = tier.id;
      }
    });

    return mapped;
  };

  // Check if user is AppSumo user based on plan name or subscription type
  const isAppSumoUser = () => {
    const planName = billingInfo?.plan_name?.toLowerCase() || '';
    const subscriptionType = currentSession?.subscription_type?.toLowerCase() || '';

    // Check for AppSumo indicators in plan name or subscription type
    return (
      planName.includes('appsumo') ||
      subscriptionType.includes('appsumo') ||
      planName.includes('lifetime') ||
      subscriptionType.includes('lifetime')
    );
  };

  // Check if user is a free user based on subscription type
  const isFreeUser = () => {
    return currentSession?.subscription_type === 'FREE';
  };

  // Fetch AppSumo discount information
  const fetchAppSumoDiscountInfo = async () => {
    if (!isAppSumoUser()) return;

    try {
      const response = await adminCenterApiService.getAppSumoCountdownWidget();

      if (response.done && response.body.isVisible) {
        const data = response.body;
        setAppSumoDiscountInfo({
          remainingDays: data.remainingDays,
          remainingHours: data.remainingHours,
          remainingMinutes: data.remainingMinutes,
          eligibleForDiscount: data.remainingDays > 0,
          urgencyLevel: data.urgencyLevel as 'low' | 'medium' | 'high' | 'critical',
          message: data.message,
        });
      } else {
        // Fallback for when API is not available - use mock data
        const mockAppSumoData = {
          remainingDays: 3,
          remainingHours: 14,
          remainingMinutes: 35,
          eligibleForDiscount: true,
          urgencyLevel: 'high' as const,
          message: '🚨 URGENT: Only 3 days left to claim your 50% AppSumo discount!',
        };
        setAppSumoDiscountInfo(mockAppSumoData);
      }
    } catch (error) {
      console.error('Failed to fetch AppSumo discount info:', error);
      // Use fallback mock data on error
      const mockAppSumoData = {
        remainingDays: 3,
        remainingHours: 14,
        remainingMinutes: 35,
        eligibleForDiscount: true,
        urgencyLevel: 'high' as const,
        message: '🚨 URGENT: Only 3 days left to claim your 50% AppSumo discount!',
      };
      setAppSumoDiscountInfo(mockAppSumoData);
    }
  };

  const fetchPricingPlans = async () => {
    try {
      // For now, use the existing getPlans() method for basic plan info
      const res = await adminCenterApiService.getPlans();
      if (res.done) {
        setPlans(res.body);
      }

      // Backend integration enabled - fetch real tier-based pricing data:
      const pricingRes = await billingApiService.getPricingPlans();
      if (pricingRes.done && pricingRes.body) {
        const tiers = pricingRes.body.tiers || [];

        // Filter tiers for AppSumo users - only show Business and Enterprise plans (based on Paddle setup)
        let filteredTiers = tiers;
        if (isAppSumoUser()) {
          filteredTiers = tiers.filter((tier: any) => {
            return tier.tier_name.includes('BUSINESS') || tier.tier_name.includes('ENTERPRISE');
          });

          // Apply AppSumo-specific modifications to the tiers
          filteredTiers = filteredTiers.map((tier: any) => {
            const modifiedTier = { ...tier };

            // For AppSumo users, Business plans allow up to 50 users (instead of normal 25)
            if (tier.tier_name.includes('BUSINESS')) {
              modifiedTier.max_users = Math.min(50, tier.max_users || 25);
              modifiedTier.appsumo_special_limit = 50;
            }

            // Apply 50% discount to pricing if within discount window
            if (appSumoDiscountInfo?.eligibleForDiscount) {
              if (tier.monthly_base_price) {
                modifiedTier.monthly_base_price = (
                  parseFloat(tier.monthly_base_price) * 0.5
                ).toFixed(2);
              }
              if (tier.annual_base_price) {
                modifiedTier.annual_base_price = (parseFloat(tier.annual_base_price) * 0.5).toFixed(
                  2
                );
              }
              if (tier.monthly_per_user_price) {
                modifiedTier.monthly_per_user_price = (
                  parseFloat(tier.monthly_per_user_price) * 0.5
                ).toFixed(2);
              }
              if (tier.annual_per_user_price) {
                modifiedTier.annual_per_user_price = (
                  parseFloat(tier.annual_per_user_price) * 0.5
                ).toFixed(2);
              }

              modifiedTier.appsumo_discount_applied = true;
            }

            return modifiedTier;
          });

          // Fetch AppSumo countdown info
          await fetchAppSumoDiscountInfo();
        }

        setBackendPlans(tiers as any);
        const mappedPricing = mapTierBasedPricingToFrontend(filteredTiers);

        setPricingData(mappedPricing);
      }
    } catch (error) {
      logger.error('Error fetching pricing plans', error);
      // Fallback to hardcoded data if backend fails
      const mockPricingResponse: IPricingPlans = {
        monthly_plan_id: 'fallback_monthly',
        monthly_plan_name: 'Pro Monthly',
        annual_plan_id: 'fallback_annual',
        annual_plan_name: 'Pro Annual',
        team_member_limit: '3',
        projects_limit: '3',
        free_tier_storage: '100',
        annual_price: '49',
        monthly_price: '69',
      };
      setPlans(mockPricingResponse);
    }
  };

  const switchToFreePlan = async () => {
    const teamId = currentSession?.team_id;
    if (!teamId) return;

    try {
      setSwitchingToFreePlan(true);
      const res = await adminCenterApiService.switchToFreePlan(teamId);
      if (res.done) {
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

  const handlePaddleCallback = (data: any) => {
    switch (data.event) {
      case 'Checkout.Loaded':
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        break;
      case 'Checkout.Complete':
        message.success('Subscription updated successfully!');
        setPaddleLoading(true);
        setTimeout(() => {
          dispatch(fetchBillingInfo());
          dispatch(toggleUpgradeModal());
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
        }, 10000);
        break;
      case 'Checkout.Close':
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        // User closed the checkout without completing
        // message.info('Checkout was closed without completing the subscription');
        break;
      case 'Checkout.Error':
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        setPaddleError(data.error?.message || 'An error occurred during checkout');
        message.error('Error during checkout: ' + (data.error?.message || 'Unknown error'));
        logger.error('Paddle checkout error', data.error);
        break;
      default:
        // Handle other events if needed
        break;
    }
  };

  const initializePaddle = (data: IUpgradeSubscriptionPlanResponse) => {
    setPaddleLoading(true);
    setPaddleError(null);

    // Check if Paddle is already loaded
    if (window.Paddle) {
      configurePaddle(data);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/paddle.js';
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

      // Check if user should use upgrade API (free, trial, or no active paddle subscription)
      const shouldUseUpgradeAPI =
        !billingInfo?.subscription_id || // No paddle subscription
        isFreeUser() || // Free user based on subscription type
        billingInfo?.status === SUBSCRIPTION_STATUS.TRIALING || // Trial user
        billingInfo?.status === SUBSCRIPTION_STATUS.PASTDUE || // Past due subscription
        billingInfo?.status === SUBSCRIPTION_STATUS.DELETED; // Deleted subscription

      if (shouldUseUpgradeAPI) {
        // Use upgrade API for users without active paddle subscription
        // Determine pricing model using helper function
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
        // For existing active/paused paddle subscriptions, use changePlan endpoint
        const res = await adminCenterApiService.changePlan(planId);
        if (res.done) {
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
        // Fallback case - should not normally happen
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
    if (teamSize >= 100) {
      message.info('Please contact sales for custom pricing on large teams');
      return;
    }

    try {
      setSwitchingToPaddlePlan(true);
      setPaddleError(null);
      let planId: string | null = null;

      // Use the global billing frequency and selected plan type
      const isAnnual = billingFrequency === 'annual';

      // Use provided planType or fallback to selectedPlanType
      const targetPlanType = planType || selectedPlanType;

      // Ensure a plan type is selected
      if (!targetPlanType || targetPlanType === 'free') {
        setSwitchingToPaddlePlan(false);
        setPaddleError('Please select a paid plan first');
        message.error('Please select a plan first');
        return;
      }

      // Get the correct plan ID based on selected plan type and team size
      if (targetPlanType === 'pro') {
        // Use per_user pricing for teams 1-5 if available, otherwise base_plan
        const planData =
          teamSize <= 5 && pricingData.pro_small ? pricingData.pro_small : pricingData.pro;
        // Use the appropriate Paddle plan ID based on billing frequency
        planId = isAnnual ? planData?.annual_plan_id : planData?.monthly_plan_id;

        // Fallback if planId is still null
        if (!planId) {
          console.warn('No Paddle plan ID found for pro plan', { planData, isAnnual });
        }
      } else if (targetPlanType === 'business') {
        // Use per_user pricing for teams 1-5 if available, otherwise base_plan
        const planData =
          teamSize <= 5 && pricingData.business_small
            ? pricingData.business_small
            : pricingData.business;
        // Use the appropriate Paddle plan ID based on billing frequency
        planId = isAnnual ? planData?.annual_plan_id : planData?.monthly_plan_id;

        // Fallback if planId is still null
        if (!planId) {
          console.warn('No Paddle plan ID found for business plan', { planData, isAnnual });
        }
      } else if (targetPlanType === 'enterprise') {
        // Use the appropriate Paddle plan ID based on billing frequency
        planId = isAnnual
          ? pricingData.enterprise?.annual_plan_id
          : pricingData.enterprise?.monthly_plan_id;

        // Fallback if planId is still null
        if (!planId) {
          console.warn('No Paddle plan ID found for enterprise plan', {
            planData: pricingData.enterprise,
            isAnnual,
          });
        }
      }

      // Additional safety check for planId
      if (!planId) {
        console.error('Plan ID not found. Plan selection details:', {
          targetPlanType,
          teamSize,
          isAnnual,
          pricingData: {
            pro: pricingData.pro,
            pro_small: pricingData.pro_small,
            business: pricingData.business,
            business_small: pricingData.business_small,
            enterprise: pricingData.enterprise,
          },
        });
      }

      // Set the selected plan for the legacy system
      if (isAnnual) {
        setSelectedCard(paddlePlans.ANNUAL);
      } else {
        setSelectedCard(paddlePlans.MONTHLY);
      }

      // Update the selected plan type
      if (planType) {
        setSelectedPlanType(planType);
      }

      if (planId) {
        upgradeToPaddlePlan(planId);
      } else {
        setSwitchingToPaddlePlan(false);
        const errorMsg = `Plan not available: ${targetPlanType} (${billingFrequency}) for ${teamSize} users. Please try a different configuration or contact support.`;
        setPaddleError(errorMsg);
        message.error('Selected plan is not available. Please try a different configuration.');

        // Log detailed error for debugging
        console.error('Plan selection failed:', {
          targetPlanType,
          billingFrequency,
          teamSize,
          isAnnual,
          availablePlans: Object.keys(pricingData),
          pricingDataStructure: {
            pro: !!pricingData.pro,
            pro_small: !!pricingData.pro_small,
            business: !!pricingData.business,
            business_small: !!pricingData.business_small,
            enterprise: !!pricingData.enterprise,
          },
        });
      }
    } catch (error) {
      setSwitchingToPaddlePlan(false);
      setPaddleError('Error processing request');
      message.error('Error processing request');
      logger.error('Error upgrading to paddle plan', error);
    }
  };

  const isSelected = (cardIndex: IPaddlePlans | string) =>
    selectedPlan === cardIndex ? { border: '2px solid #1890ff' } : {};

  const cardStyles = {
    title: {
      color: themeMode === 'dark' ? '#ffffffd9' : '#000000d9',
      fontWeight: 500,
      fontSize: '16px',
      display: 'flex',
      gap: '4px',
      justifyContent: 'center',
    },
    priceContainer: {
      display: 'grid',
      gridTemplateColumns: 'auto',
      rowGap: '10px',
      padding: '20px 20px 0',
    },
    featureList: {
      display: 'grid',
      gridTemplateRows: 'auto auto auto',
      gridTemplateColumns: '200px',
      rowGap: '7px',
      padding: '10px',
      justifyItems: 'start',
      alignItems: 'start',
    },
    checkIcon: { color: '#1890ff' },
  };

  const calculateAnnualTotal = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      let finalPrice = 0;

      // For teams 1-5, use per-user pricing from small team data
      if (teamSize <= 5) {
        if (planType === 'pro' && pricingData.pro_small?.pricing_model === 'per_user') {
          // Pro Small Team: annual_price is monthly rate when paid annually (e.g., 6.99)
          // So yearly total = monthly rate * 12 * users
          const perUserMonthlyIfAnnual = parseFloat(pricingData.pro_small.annual_price || '0');
          finalPrice = perUserMonthlyIfAnnual * 12 * teamSize; // e.g., 6.99 * 12 * 5 = 419.40
        } else if (
          planType === 'business' &&
          pricingData.business_small?.pricing_model === 'per_user'
        ) {
          // Business Small Team: annual_price is monthly rate when paid annually
          // So yearly total = monthly rate * 12 * users
          const perUserMonthlyIfAnnual = parseFloat(pricingData.business_small.annual_price || '0');
          finalPrice = perUserMonthlyIfAnnual * 12 * teamSize;
        } else if (planType === 'enterprise') {
          // Enterprise is always flat rate
          const annualTotal = parseFloat(pricingData.enterprise.annual_total || '0');
          if (annualTotal > 0) {
            finalPrice = annualTotal;
          } else {
            finalPrice = parseFloat(pricingData.enterprise.annual_price || '0') * 12;
          }
        } else {
          // Fallback to base plan if small team pricing not available
          const planData = planType === 'pro' ? pricingData.pro : pricingData.business;
          const baseAnnualTotal = parseFloat(planData.annual_total || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost =
            extraUsers * parseFloat(planData.additional_user_price || '5.99') * 12; // Annual cost for extra users

          finalPrice = baseAnnualTotal + extraUserCost;
        }
      } else {
        // For teams 6+, use base plan pricing (flat rate + overage)
        let planData;
        if (planType === 'pro') {
          planData = pricingData.pro;
        } else if (planType === 'business') {
          planData = pricingData.business;
        } else {
          planData = pricingData.enterprise;
        }

        if (planType === 'enterprise') {
          // Enterprise is flat rate regardless of users
          const annualTotal = parseFloat(planData.annual_total || '0');
          if (annualTotal > 0) {
            finalPrice = annualTotal;
          } else {
            finalPrice = parseFloat(planData.annual_price || '0') * 12;
          }
        } else {
          // Pro/Business: base price + extra user charges
          const baseAnnualTotal = parseFloat(planData.annual_total || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost =
            extraUsers * parseFloat(planData.additional_user_price || '5.99') * 12; // Annual cost for extra users

          finalPrice = baseAnnualTotal + extraUserCost;
        }
      }

      // Apply 50% discount for AppSumo users
      if (isAppSumoUser()) {
        finalPrice = finalPrice * 0.5;
      }

      return finalPrice.toFixed(2);
    },
    [teamSize, pricingData, isAppSumoUser]
  );

  const calculateMonthlyTotal = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      let finalPrice = 0;

      // For teams 1-5, use per-user pricing from small team data
      if (teamSize <= 5) {
        if (planType === 'pro' && pricingData.pro_small?.pricing_model === 'per_user') {
          // Use Pro Small Team per-user pricing (monthly rate)
          const perUserMonthlyPrice = parseFloat(pricingData.pro_small.monthly_price || '0');
          finalPrice = perUserMonthlyPrice * teamSize;
        } else if (
          planType === 'business' &&
          pricingData.business_small?.pricing_model === 'per_user'
        ) {
          // Use Business Small Team per-user pricing (monthly rate)
          const perUserMonthlyPrice = parseFloat(pricingData.business_small.monthly_price || '0');
          finalPrice = perUserMonthlyPrice * teamSize;
        } else if (planType === 'enterprise') {
          // Enterprise is always flat rate
          finalPrice = parseFloat(pricingData.enterprise.monthly_price || '0');
          if (!finalPrice && pricingData.enterprise.annual_price) {
            finalPrice = parseFloat(pricingData.enterprise.annual_price); // Convert annual to monthly display equivalent
          }
        } else {
          // Fallback to base plan if small team pricing not available
          const planData = planType === 'pro' ? pricingData.pro : pricingData.business;
          const basePrice = parseFloat(planData.monthly_price || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost = extraUsers * parseFloat(planData.additional_user_price || '5.99');

          finalPrice = basePrice + extraUserCost;
        }
      } else {
        // For teams 6+, use base plan pricing (flat rate + overage)
        let planData;
        if (planType === 'pro') {
          planData = pricingData.pro;
        } else if (planType === 'business') {
          planData = pricingData.business;
        } else {
          planData = pricingData.enterprise;
        }

        if (planType === 'enterprise') {
          // Enterprise is flat rate regardless of users
          finalPrice = parseFloat(planData.monthly_price || '0');
          if (!finalPrice && planData.annual_price) {
            finalPrice = parseFloat(planData.annual_price); // Use annual price as monthly display equivalent
          }
        } else {
          // Pro/Business: base price + extra user charges
          const basePrice = parseFloat(planData.monthly_price || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost = extraUsers * parseFloat(planData.additional_user_price || '5.99');

          finalPrice = basePrice + extraUserCost;
        }
      }

      // Apply 50% discount for AppSumo users
      if (isAppSumoUser()) {
        finalPrice = finalPrice * 0.5;
      }

      return finalPrice.toFixed(2);
    },
    [teamSize, pricingData, isAppSumoUser]
  );

  const getPriceLabel = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      const useSmallTeamPricing = teamSize <= 5;

      let planData;
      if (planType === 'pro') {
        planData =
          useSmallTeamPricing && pricingData.pro_small ? pricingData.pro_small : pricingData.pro;
      } else if (planType === 'business') {
        planData =
          useSmallTeamPricing && pricingData.business_small
            ? pricingData.business_small
            : pricingData.business;
      } else {
        planData = pricingData.enterprise;
      }

      if (useSmallTeamPricing && planData.pricing_model === 'per_user') {
        return t('pricing-modal:pricing.perUser') + t('pricing-modal:pricing.perMonth');
      }
      return t('pricing-modal:pricing.perMonth');
    },
    [teamSize, pricingData, t]
  );

  useEffect(() => {
    const initializeData = async () => {
      await fetchPricingPlans();

      // Fetch AppSumo discount info if user is AppSumo user
      if (isAppSumoUser()) {
        await fetchAppSumoDiscountInfo();
      }
    };

    initializeData();

    if (billingInfo?.total_used) {
      setTeamSize(billingInfo.total_used || 1);
    }
  }, [billingInfo]);

  const renderFeature = (text: string) => (
    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <CheckCircleFilled style={{ ...cardStyles.checkIcon, marginTop: '2px', flexShrink: 0 }} />
      <span style={{ lineHeight: '1.4' }}>{text}</span>
    </div>
  );

  useEffect(() => {
    // Cleanup Paddle script when component unmounts
    return () => {
      const paddleScript = document.querySelector('script[src*="paddle.js"]');
      if (paddleScript) {
        paddleScript.remove();
      }
    };
  }, []);

  return (
    <div className="upgrade-plans-responsive">
      <Flex justify="center" align="center">
        <Typography.Title level={2}>
          {billingInfo?.status === SUBSCRIPTION_STATUS.TRIALING
            ? t('selectPlan', 'Select Plan')
            : t('changeSubscriptionPlan', 'Change Subscription Plan')}
        </Typography.Title>
      </Flex>

      {/* AppSumo User Notification */}
      {isAppSumoUser() && (
        <Row justify="center" style={{ marginTop: 24, marginBottom: 16 }}>
          <Col xs={24} sm={22} md={20} lg={18} xl={16}>
            {appSumoDiscountInfo?.eligibleForDiscount ? (
              <Alert
                message={
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Typography.Title
                      level={4}
                      style={{
                        margin: 0,
                        color:
                          appSumoDiscountInfo.urgencyLevel === 'critical' ||
                          appSumoDiscountInfo.urgencyLevel === 'high'
                            ? '#d32f2f'
                            : '#f57c00',
                      }}
                    >
                      🎉 AppSumo Exclusive: 50% OFF Business & Enterprise Plans!
                    </Typography.Title>
                    <Space size="large" align="center" wrap>
                      <Typography.Text strong>
                        {appSumoDiscountInfo.remainingDays}d {appSumoDiscountInfo.remainingHours}h{' '}
                        {appSumoDiscountInfo.remainingMinutes}m remaining
                      </Typography.Text>
                      <Tag
                        color={
                          appSumoDiscountInfo.urgencyLevel === 'critical' ||
                          appSumoDiscountInfo.urgencyLevel === 'high'
                            ? 'red'
                            : 'orange'
                        }
                      >
                        {appSumoDiscountInfo.urgencyLevel === 'critical'
                          ? 'FINAL HOURS'
                          : appSumoDiscountInfo.urgencyLevel === 'high'
                            ? 'URGENT'
                            : 'LIMITED TIME'}
                      </Tag>
                    </Space>
                  </Space>
                }
                description={
                  <Space direction="vertical" size="small">
                    <Typography.Text>
                      🎯 Special pricing for AppSumo lifetime deal members
                    </Typography.Text>
                    <Typography.Text>
                      💪 Business plans support up to 50 users (normally 25)
                    </Typography.Text>
                    <Typography.Text
                      style={{
                        color:
                          appSumoDiscountInfo.urgencyLevel === 'critical' ||
                          appSumoDiscountInfo.urgencyLevel === 'high'
                            ? '#d32f2f'
                            : '#666',
                      }}
                    >
                      {appSumoDiscountInfo.message}
                    </Typography.Text>
                  </Space>
                }
                type={
                  appSumoDiscountInfo.urgencyLevel === 'critical' ||
                  appSumoDiscountInfo.urgencyLevel === 'high'
                    ? 'error'
                    : 'warning'
                }
                showIcon
                style={{
                  border:
                    appSumoDiscountInfo.urgencyLevel === 'critical' ||
                    appSumoDiscountInfo.urgencyLevel === 'high'
                      ? '2px solid #d32f2f'
                      : '2px solid #f57c00',
                }}
              />
            ) : (
              <Alert
                message="AppSumo Lifetime Deal Member"
                description={
                  <Space direction="vertical" size="small">
                    <Typography.Text>
                      Your 50% discount period has expired, but you can still upgrade to Business or
                      Enterprise plans at standard pricing.
                    </Typography.Text>
                    <Typography.Text>
                      💡 Watch for future campaigns and special offers!
                    </Typography.Text>
                  </Space>
                }
                type="info"
                showIcon
              />
            )}
          </Col>
        </Row>
      )}

      {/* Team Size Input and Billing Frequency Toggle in Same Row */}
      <Row
        justify="center"
        align="middle"
        style={{ marginTop: isAppSumoUser() ? 8 : 24, marginBottom: 16 }}
      >
        <Space size="large" align="center">
          {/* Team Size Dropdown */}
          <Space align="center" size="middle">
            <Typography.Text strong>Team Size:</Typography.Text>
            <Select
              value={teamSize}
              onChange={(value: number) => {
                setTeamSize(value);
              }}
              style={{ width: 140 }}
              size="large"
              options={generateTeamSizeOptions()}
              showSearch
              optionFilterProp="label"
              placeholder="Select team size"
            />
          </Space>

          {/* Billing Frequency Toggle */}
          <Space align="center" size="middle">
            <Typography.Text strong>Billing Cycle:</Typography.Text>
            <Button.Group size="large">
              <Button
                type={billingFrequency === 'monthly' ? 'primary' : 'default'}
                onClick={() => {
                  setBillingFrequency('monthly');
                  setSelectedCard(paddlePlans.MONTHLY);
                }}
              >
                {t('pricing-modal:billingCycle.monthly')}
              </Button>
              <Button
                type={billingFrequency === 'annual' ? 'primary' : 'default'}
                onClick={() => {
                  setBillingFrequency('annual');
                  setSelectedCard(paddlePlans.ANNUAL);
                }}
              >
                {t('pricing-modal:billingCycle.yearly')}
              </Button>
            </Button.Group>
          </Space>
        </Space>
      </Row>

      {/* Pricing Model Information - Show which model is being used */}
      {!isAppSumoUser() && (pricingData.pro_small || pricingData.business_small) && (
        <Row justify="center" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ textAlign: 'center' }}>
            {billingInfo?.total_used && (
              <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                {teamSize <= 5 && (pricingData.pro_small || pricingData.business_small)
                  ? `Automatically using per-user pricing for ${teamSize} user${teamSize > 1 ? 's' : ''}`
                  : `Automatically using base plan pricing for ${teamSize} user${teamSize > 1 ? 's' : ''}`}
              </Typography.Text>
            )}
          </Space>
        </Row>
      )}

      <Row className="w-full" gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Free Plan - Hide for AppSumo users */}
        {!isAppSumoUser() && (
          <Col xs={24} lg={6}>
            <Card
              style={{
                height: '100%',
                border: selectedPlanType === 'free' ? '2px solid #1890ff' : '1px solid #d9d9d9',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
              }}
              bodyStyle={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
              onClick={() => {
                setSelectedPlanType('free');
                setSelectedCard(paddlePlans.FREE);
              }}
              hoverable
            >
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Typography.Title level={4} style={{ marginBottom: 8 }}>
                  {t('pricing-modal:plans.free.name')}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {t('pricing-modal:plans.free.description')}
                </Typography.Text>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Typography.Title level={1} style={{ fontSize: '48px', margin: 0 }}>
                  $0
                </Typography.Title>
                <Typography.Text>{t('pricing-modal:plans.free.forever')}</Typography.Text>
              </div>

              <div style={{ flex: 1, marginBottom: 24 }}>
                {renderFeature(`${plans.projects_limit || '3'} ${t('projects', 'Projects')}`)}
                {renderFeature(`${plans.team_member_limit || '3'} ${t('users', 'Users')}`)}
                {renderFeature(t('taskListKanban', 'Task List & Kanban Board'))}
                {renderFeature(t('personalViews', 'Personal Task & Calendar Views'))}
                {renderFeature(t('fileUploads', 'File Uploads & Comments'))}
                {renderFeature(t('labelsFilters', 'Labels & Filters'))}
              </div>
            </Card>
          </Col>
        )}

        {/* Pro Plan - Hide for AppSumo users */}
        {!isAppSumoUser() && (
          <Col xs={24} lg={6}>
            <Card
              style={{
                height: '100%',
                border: selectedPlanType === 'pro' ? '2px solid #1890ff' : '1px solid #d9d9d9',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
              }}
              bodyStyle={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
              onClick={() => setSelectedPlanType('pro')}
              hoverable
            >
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Typography.Title level={4} style={{ marginBottom: 8 }}>
                  {t('pricing-modal:plans.pro.name')}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {t('pricing-modal:plans.pro.description')}
                </Typography.Text>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                {(() => {
                  const useSmallTeamPricing = teamSize <= 5;
                  const planData =
                    useSmallTeamPricing && pricingData.pro_small
                      ? pricingData.pro_small
                      : pricingData.pro;

                  if (useSmallTeamPricing && planData.pricing_model === 'per_user') {
                    // Show per-user price for small teams
                    const perUserMonthlyPrice = parseFloat(planData.monthly_price || '0');
                    // annual_price is the monthly rate when paid annually (e.g., 6.99/month)
                    const perUserMonthlyIfAnnual = parseFloat(planData.annual_price || '0');
                    const perUserYearlyTotal = perUserMonthlyIfAnnual * 12; // e.g., 6.99 * 12 = 83.88
                    const total =
                      billingFrequency === 'annual'
                        ? (perUserYearlyTotal * teamSize).toFixed(2)
                        : calculateMonthlyTotal('pro');

                    // For annual billing, show monthly price in big font with yearly total below
                    if (billingFrequency === 'annual') {
                      return (
                        <>
                          <Typography.Title level={1} style={{ fontSize: '36px', margin: 0 }}>
                            ${perUserMonthlyIfAnnual}
                          </Typography.Title>
                          <Typography.Text>/month per user (billed annually)</Typography.Text>
                          <div style={{ marginTop: 8 }}>
                            <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                              ${total}/year total for {teamSize} user{teamSize > 1 ? 's' : ''}
                            </Typography.Text>
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: '12px', display: 'block' }}
                            >
                              (${perUserYearlyTotal.toFixed(2)}/user/year × {teamSize} user
                              {teamSize > 1 ? 's' : ''})
                            </Typography.Text>
                          </div>
                        </>
                      );
                    }

                    // For monthly billing, show monthly total with yearly projection
                    const yearlyProjection = (perUserMonthlyPrice * 12 * teamSize).toFixed(2);
                    return (
                      <>
                        <Typography.Title level={1} style={{ fontSize: '36px', margin: 0 }}>
                          ${total}
                        </Typography.Title>
                        <Typography.Text>/month</Typography.Text>
                        <div style={{ marginTop: 8 }}>
                          <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                            ${perUserMonthlyPrice}/user × {teamSize} user{teamSize > 1 ? 's' : ''}
                          </Typography.Text>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Tooltip
                            title={`$${perUserMonthlyPrice} × 12 months × ${teamSize} seat${teamSize > 1 ? 's' : ''}`}
                            placement="bottom"
                          >
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: '12px', cursor: 'help' }}
                            >
                              ${yearlyProjection} if billed yearly
                            </Typography.Text>
                          </Tooltip>
                        </div>
                        {isAppSumoUser() && (
                          <span
                            style={{
                              color: '#52c41a',
                              fontWeight: 'bold',
                              display: 'block',
                              fontSize: '12px',
                              marginTop: 4,
                            }}
                          >
                            50% AppSumo Discount Applied
                          </span>
                        )}
                      </>
                    );
                  } else {
                    // Show total price for larger teams
                    return (
                      <>
                        <Typography.Title level={1} style={{ fontSize: '36px', margin: 0 }}>
                          $
                          {billingFrequency === 'annual'
                            ? calculateAnnualTotal('pro')
                            : calculateMonthlyTotal('pro')}
                        </Typography.Title>
                        <Typography.Text>
                          {getPriceLabel('pro')}{' '}
                          {billingFrequency === 'annual' ? '(billed annually)' : ''}
                          {isAppSumoUser() && (
                            <span
                              style={{
                                color: '#52c41a',
                                fontWeight: 'bold',
                                display: 'block',
                                fontSize: '12px',
                              }}
                            >
                              50% AppSumo Discount Applied
                            </span>
                          )}
                        </Typography.Text>
                      </>
                    );
                  }
                })()}
              </div>

              <div style={{ flex: 1, marginBottom: 24 }}>
                {renderFeature(t('unlimitedProjects', 'Unlimited Projects'))}
                {(() => {
                  const useSmallTeamPricing = teamSize <= 5;
                  const planData =
                    useSmallTeamPricing && pricingData.pro_small
                      ? pricingData.pro_small
                      : pricingData.pro;
                  if (useSmallTeamPricing && planData.pricing_model === 'per_user') {
                    return renderFeature(`Pay per user (1-5 users)`);
                  } else {
                    return renderFeature(`${planData.users_included} Users Included`);
                  }
                })()}
                {(() => {
                  const useSmallTeamPricing = teamSize <= 5;
                  const planData =
                    useSmallTeamPricing && pricingData.pro_small
                      ? pricingData.pro_small
                      : pricingData.pro;
                  return renderFeature(`Up to ${planData.max_users} Users Max`);
                })()}
                {renderFeature(t('timeTracking', 'Time Tracking & Analytics'))}
                {renderFeature(t('projectTemplates', 'Project Templates & Phases'))}
                {renderFeature(t('ganttReadOnly', 'Gantt Charts (Read-only)'))}
                {renderFeature(t('customFields', 'Custom Fields & Subtasks'))}
                {renderFeature(t('projectInsights', 'Project Insights & Reports'))}
              </div>
            </Card>
          </Col>
        )}

        {/* Business Plan */}
        <Col xs={24} lg={isAppSumoUser() ? 12 : 6}>
          <Card
            style={{
              height: '100%',
              border: selectedPlanType === 'business' ? '2px solid #1890ff' : '1px solid #d9d9d9',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
            }}
            bodyStyle={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
            onClick={() => setSelectedPlanType('business')}
            hoverable
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Typography.Title level={4} style={{ marginBottom: 8 }}>
                {t('pricing-modal:plans.business.name')}
              </Typography.Title>
              <Typography.Text type="secondary">
                {t('pricing-modal:plans.business.description')}
              </Typography.Text>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              {(() => {
                const useSmallTeamPricing = teamSize <= 5;
                const planData =
                  useSmallTeamPricing && pricingData.business_small
                    ? pricingData.business_small
                    : pricingData.business;

                if (useSmallTeamPricing && planData.pricing_model === 'per_user') {
                  // Show per-user price for small teams
                  const perUserMonthlyPrice = parseFloat(planData.monthly_price || '0');
                  // annual_price is the monthly rate when paid annually
                  const perUserMonthlyIfAnnual = parseFloat(planData.annual_price || '0');
                  const perUserYearlyTotal = perUserMonthlyIfAnnual * 12;
                  const total =
                    billingFrequency === 'annual'
                      ? (perUserYearlyTotal * teamSize).toFixed(2)
                      : calculateMonthlyTotal('business');

                  // For annual billing, show monthly price in big font with yearly total below
                  if (billingFrequency === 'annual') {
                    return (
                      <>
                        <Typography.Title level={1} style={{ fontSize: '36px', margin: 0 }}>
                          ${perUserMonthlyIfAnnual}
                        </Typography.Title>
                        <Typography.Text>/month per user (billed annually)</Typography.Text>
                        <div style={{ marginTop: 8 }}>
                          <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                            ${total}/year total for {teamSize} user{teamSize > 1 ? 's' : ''}
                          </Typography.Text>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: '12px', display: 'block' }}
                          >
                            (${perUserYearlyTotal.toFixed(2)}/user/year × {teamSize} user
                            {teamSize > 1 ? 's' : ''})
                          </Typography.Text>
                        </div>
                      </>
                    );
                  }

                  // For monthly billing, show monthly total with yearly projection
                  const yearlyProjection = (perUserMonthlyPrice * 12 * teamSize).toFixed(2);
                  return (
                    <>
                      <Typography.Title level={1} style={{ fontSize: '36px', margin: 0 }}>
                        ${total}
                      </Typography.Title>
                      <Typography.Text>/month</Typography.Text>
                      <div style={{ marginTop: 8 }}>
                        <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                          ${perUserMonthlyPrice}/user × {teamSize} user{teamSize > 1 ? 's' : ''}
                        </Typography.Text>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <Tooltip
                          title={`$${perUserMonthlyPrice} × 12 months × ${teamSize} seat${teamSize > 1 ? 's' : ''}`}
                          placement="bottom"
                        >
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: '12px', cursor: 'help' }}
                          >
                            ${yearlyProjection} if billed yearly
                          </Typography.Text>
                        </Tooltip>
                      </div>
                      {isAppSumoUser() && (
                        <span
                          style={{
                            color: '#52c41a',
                            fontWeight: 'bold',
                            display: 'block',
                            fontSize: '12px',
                            marginTop: 4,
                          }}
                        >
                          50% AppSumo Discount Applied
                        </span>
                      )}
                    </>
                  );
                } else {
                  // Show total price for larger teams
                  return (
                    <>
                      <Typography.Title level={1} style={{ fontSize: '36px', margin: 0 }}>
                        $
                        {billingFrequency === 'annual'
                          ? calculateAnnualTotal('business')
                          : calculateMonthlyTotal('business')}
                      </Typography.Title>
                      <Typography.Text>
                        {getPriceLabel('business')}{' '}
                        {billingFrequency === 'annual' ? '(billed annually)' : ''}
                        {isAppSumoUser() && (
                          <span
                            style={{
                              color: '#52c41a',
                              fontWeight: 'bold',
                              display: 'block',
                              fontSize: '12px',
                            }}
                          >
                            50% AppSumo Discount Applied
                          </span>
                        )}
                      </Typography.Text>
                    </>
                  );
                }
              })()}
            </div>

            <div style={{ flex: 1, marginBottom: 24 }}>
              <Typography.Text
                strong
                style={{ display: 'block', marginBottom: 12, textAlign: 'center' }}
              >
                {t('everythingInPro', 'Everything in Pro, plus:')}
              </Typography.Text>
              {(() => {
                const useSmallTeamPricing = teamSize <= 5;
                const planData =
                  useSmallTeamPricing && pricingData.business_small
                    ? pricingData.business_small
                    : pricingData.business;
                if (useSmallTeamPricing && planData.pricing_model === 'per_user') {
                  return renderFeature(`Pay per user (1-5 users)`);
                } else {
                  return renderFeature(`${planData.users_included} Users Included`);
                }
              })()}
              {(() => {
                const useSmallTeamPricing = teamSize <= 5;
                const planData =
                  useSmallTeamPricing && pricingData.business_small
                    ? pricingData.business_small
                    : pricingData.business;
                const maxUsers =
                  isAppSumoUser() && !useSmallTeamPricing ? '50' : planData.max_users;
                const userLimitText =
                  isAppSumoUser() && !useSmallTeamPricing
                    ? `Up to ${maxUsers} Users Max (AppSumo Special)`
                    : `Up to ${maxUsers} Users Max`;
                return renderFeature(userLimitText);
              })()}
              {renderFeature(t('fullGanttCharts', 'Full Gantt Charts'))}
              {renderFeature(t('projectHealth', 'Project Health Monitoring'))}
              {renderFeature(t('clientPortal', 'Client Portal'))}
              {renderFeature(t('financeTracking', 'Finance & Billable Tracking'))}
              {renderFeature(t('scheduler', 'Advanced Scheduler'))}
            </div>
          </Card>
        </Col>

        {/* Enterprise Plan */}
        <Col xs={24} lg={isAppSumoUser() ? 12 : 6}>
          <Card
            style={{
              height: '100%',
              border: selectedPlanType === 'enterprise' ? '2px solid #1890ff' : '1px solid #d9d9d9',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
            }}
            bodyStyle={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
            onClick={() => setSelectedPlanType('enterprise')}
            hoverable
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Typography.Title level={4} style={{ marginBottom: 8 }}>
                {t('pricing-modal:plans.enterprise.name')}
              </Typography.Title>
              <Typography.Text type="secondary">
                {t('pricing-modal:plans.enterprise.description')}
              </Typography.Text>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Typography.Title level={1} style={{ fontSize: '36px', margin: 0 }}>
                $
                {billingFrequency === 'annual'
                  ? calculateAnnualTotal('enterprise')
                  : calculateMonthlyTotal('enterprise')}
              </Typography.Title>
              <Typography.Text>
                {getPriceLabel('enterprise')}{' '}
                {billingFrequency === 'annual' ? '(billed annually)' : ''}
                {isAppSumoUser() && (
                  <span
                    style={{
                      color: '#52c41a',
                      fontWeight: 'bold',
                      display: 'block',
                      fontSize: '12px',
                    }}
                  >
                    50% AppSumo Discount Applied
                  </span>
                )}
              </Typography.Text>
              {billingFrequency === 'annual' && (
                <div style={{ marginTop: 4 }}>
                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                    $
                    {(() => {
                      const annualPrice =
                        pricingData.enterprise.annual_total ||
                        (parseFloat(pricingData.enterprise.annual_price || '0') * 12).toString();
                      // Enterprise plan is always base_plan pricing (fixed price regardless of team size)
                      const baseTotal = parseFloat(annualPrice);
                      return (baseTotal * (isAppSumoUser() ? 0.5 : 1)).toFixed(2);
                    })()}
                    /year
                    {isAppSumoUser() && (
                      <span style={{ color: '#52c41a', fontWeight: 'bold', marginLeft: 4 }}>
                        (50% AppSumo Discount)
                      </span>
                    )}
                  </Typography.Text>
                </div>
              )}
            </div>

            <div style={{ flex: 1, marginBottom: 24 }}>
              <Typography.Text
                strong
                style={{ display: 'block', marginBottom: 12, textAlign: 'center' }}
              >
                {t('everythingInBusiness', 'Everything in Business, plus:')}
              </Typography.Text>
              {renderFeature(`${pricingData.enterprise.users_included} Users`)}
              {renderFeature(t('noExtraUserCost', 'No Extra User Cost'))}
              {renderFeature(t('advancedSecurity', 'Advanced Security'))}
              {renderFeature(t('customIntegrations', 'Custom Integrations'))}
              {renderFeature(t('prioritySupport', 'Priority Support'))}
            </div>
          </Card>
        </Col>
      </Row>

      {paddleError && (
        <Row justify="center" style={{ marginTop: 16 }}>
          <Alert message={paddleError} type="error" showIcon />
        </Row>
      )}

      {/* Single Action Button */}
      <Row justify="center" style={{ marginTop: 24, marginBottom: 16 }}>
        <Col xs={24} sm={16} md={12} lg={8}>
          <Button
            type="primary"
            block
            size="large"
            onClick={() => {
              if (selectedPlanType === 'free') {
                switchToFreePlan();
              } else if (
                selectedPlanType === 'pro' ||
                selectedPlanType === 'business' ||
                selectedPlanType === 'enterprise'
              ) {
                continueWithPaddlePlan(selectedPlanType);
              } else {
                message.warning('Please select a plan first');
              }
            }}
            loading={switchingToPaddlePlan || paddleLoading || switchingToFreePlan}
            disabled={!selectedPlanType}
          >
            {(() => {
              if (!selectedPlanType) {
                return 'Select a Plan';
              }
              if (selectedPlanType === 'free') {
                return t('pricing-modal:buttons.getStartedFree', 'Get Started Free');
              }
              return t('pricing-modal:buttons.choosePlan', 'Continue with Selected Plan');
            })()}
          </Button>
          {selectedPlanType && (
            <Typography.Text
              type="secondary"
              style={{ display: 'block', textAlign: 'center', marginTop: 8 }}
            >
              {(() => {
                if (selectedPlanType === 'free') {
                  return 'Switch to Free Plan';
                } else if (selectedPlanType === 'pro') {
                  const useSmallTeamPricing = teamSize <= 5;
                  const planData =
                    useSmallTeamPricing && pricingData.pro_small
                      ? pricingData.pro_small
                      : pricingData.pro;
                  const total =
                    billingFrequency === 'annual'
                      ? calculateAnnualTotal('pro')
                      : calculateMonthlyTotal('pro');
                  return `Pro Plan - $${total} ${billingFrequency === 'annual' ? '/year' : '/month'} for ${teamSize} user${teamSize > 1 ? 's' : ''}`;
                } else if (selectedPlanType === 'business') {
                  const useSmallTeamPricing = teamSize <= 5;
                  const planData =
                    useSmallTeamPricing && pricingData.business_small
                      ? pricingData.business_small
                      : pricingData.business;
                  const total =
                    billingFrequency === 'annual'
                      ? calculateAnnualTotal('business')
                      : calculateMonthlyTotal('business');
                  return `Business Plan - $${total} ${billingFrequency === 'annual' ? '/year' : '/month'} for ${teamSize} user${teamSize > 1 ? 's' : ''}`;
                } else if (selectedPlanType === 'enterprise') {
                  const total =
                    billingFrequency === 'annual'
                      ? calculateAnnualTotal('enterprise')
                      : calculateMonthlyTotal('enterprise');
                  return `Enterprise Plan - $${total} ${billingFrequency === 'annual' ? '/year' : '/month'}`;
                }
                return '';
              })()}
              {isAppSumoUser() && selectedPlanType !== 'free' && (
                <span style={{ color: '#52c41a', fontWeight: 'bold', display: 'block' }}>
                  50% AppSumo Discount Applied
                </span>
              )}
            </Typography.Text>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default UpgradePlans;
