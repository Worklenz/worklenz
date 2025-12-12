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
  Skeleton,
} from '@/shared/antd-imports';
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
import { fetchBillingInfo, toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { billingApiService, IPricingPlan } from '@/api/admin-center/billing.api.service';
import { authApiService } from '@/api/auth/auth.api.service';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';

import './upgrade-plans.css';

// Types
interface PricingTier {
  monthly_price: string;
  annual_price: string;
  annual_total?: string;
  users_included: string;
  max_users: string;
  additional_user_price?: string;
  monthly_plan_id?: string;
  annual_plan_id?: string;
  pricing_model: string;
  tier_id?: string;
}

interface PricingData {
  free: PricingTier;
  pro: PricingTier;
  pro_small: PricingTier;
  business: PricingTier;
  business_small: PricingTier;
  enterprise: PricingTier;
}

interface AppSumoDiscountInfo {
  remainingDays: number;
  remainingHours: number;
  remainingMinutes: number;
  eligibleForDiscount: boolean;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

type PlanType = 'free' | 'pro' | 'business' | 'enterprise';
type BillingFrequency = 'monthly' | 'annual';

// Constants
const TEAM_SIZE_THRESHOLD = 5;
const MAX_TEAM_SIZE = 100;
const MAX_REGULAR_USERS = 95;
const MAX_APPSUMO_USERS = 50;
const APPSUMO_BUSINESS_LIMIT = 25;
const PADDLE_CHECKOUT_DELAY = 10000;
const DEFAULT_ADDITIONAL_USER_PRICE = '0';

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

// Helper Components
const PlanCardSkeleton: React.FC = () => (
  <Card style={{ height: '100%', padding: '8px' }}>
    <Skeleton active paragraph={{ rows: 8 }} />
  </Card>
);

const PlanFeature: React.FC<{ text: string; iconColor?: string }> = ({ 
  text, 
  iconColor = '#1890ff' 
}) => (
  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
    <CheckCircleFilled style={{ color: iconColor, marginTop: '2px', flexShrink: 0 }} />
    <span style={{ lineHeight: '1.4' }}>{text}</span>
  </div>
);

const PlanPriceDisplay: React.FC<{
  price: string;
  label: string;
  subtitle?: React.ReactNode;
  isAppSumoUser?: boolean;
}> = ({ price, label, subtitle, isAppSumoUser }) => (
  <div style={{ textAlign: 'center', marginBottom: 24 }}>
    <Typography.Title level={1} style={{ fontSize: '36px', margin: 0 }}>
      ${price}
    </Typography.Title>
    <Typography.Text>{label}</Typography.Text>
    {subtitle}
    {isAppSumoUser && (
      <span
        style={{
          color: '#52c41a',
          fontWeight: 'bold',
          display: 'block',
          fontSize: '12px',
          marginTop: 4,
        }}
      >
        70% AppSumo Discount Applied
      </span>
    )}
  </div>
);

// Utility functions
const calculatePrice = (
  basePrice: number,
  teamSize: number,
  includedUsers: number,
  additionalUserPrice: number,
  isAnnual: boolean = false
): number => {
  const extraUsers = Math.max(0, teamSize - includedUsers);
  const multiplier = isAnnual ? 12 : 1;
  return basePrice + (extraUsers * additionalUserPrice * multiplier);
};

const getInitialPricingData = (): PricingData => ({
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

// Main Component
const UpgradePlans = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);
  
  // Redux state
  const { billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const currentSession = useAuthService().getCurrentSession();
  
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
  
  // AppSumo states
  const [appSumoDiscountInfo, setAppSumoDiscountInfo] = useState<AppSumoDiscountInfo | null>(null);
  
  // Legacy state (for compatibility)
  const [selectedPlan, setSelectedCard] = useState(IPaddlePlans.ANNUAL);
  const paddlePlans = IPaddlePlans;

  // Computed values
  const isAppSumoUser = useMemo(() => {
    const planName = billingInfo?.plan_name?.toLowerCase() || '';
    const subscriptionType = currentSession?.subscription_type?.toLowerCase() || '';
    
    return (
      planName.includes('appsumo') ||
      subscriptionType.includes('appsumo') ||
      planName.includes('lifetime') ||
      subscriptionType.includes('lifetime')
    );
  }, [billingInfo, currentSession]);

  const isFreeUser = useMemo(() => {
    return currentSession?.subscription_type === 'FREE';
  }, [currentSession]);

  const cardStyles = useMemo(() => ({
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
  }), [themeMode]);

  // Team size options generator
  const generateTeamSizeOptions = useCallback(() => {
    const options: { value: number; label: string }[] = [];

    // Always show 1-5 for small teams
    for (let i = 1; i <= 5; i++) {
      options.push({ value: i, label: `${i} user${i > 1 ? 's' : ''}` });
    }

    // For AppSumo users, show up to 50 users with special highlighting
    const maxUsers = isAppSumoUser ? MAX_APPSUMO_USERS : MAX_REGULAR_USERS;
    const showAppSumoLabel = isAppSumoUser && selectedPlanType === 'business';

    // Show multiples of 5 up to the maximum
    for (let i = 10; i <= maxUsers; i += 5) {
      const label =
        showAppSumoLabel && i > APPSUMO_BUSINESS_LIMIT && i <= MAX_APPSUMO_USERS 
          ? `${i} users (AppSumo Special)` 
          : `${i} users`;
      options.push({ value: i, label });
    }

    // For non-AppSumo users, continue to 95
    if (!isAppSumoUser) {
      for (let i = 55; i <= MAX_REGULAR_USERS; i += 5) {
        options.push({ value: i, label: `${i} users` });
      }
    }

    return options;
  }, [isAppSumoUser, selectedPlanType]);

  // Pricing model helper
  const getEffectivePricingModel = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      if (planType === 'enterprise') return 'base_plan';
      return teamSize <= TEAM_SIZE_THRESHOLD &&
        ((planType === 'pro' && pricingData.pro_small) ||
          (planType === 'business' && pricingData.business_small))
        ? 'per_user'
        : 'base_plan';
    },
    [teamSize, pricingData]
  );

  // Price calculation functions
  const calculateMonthlyTotal = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      let finalPrice = 0;

      if (teamSize <= TEAM_SIZE_THRESHOLD) {
        if (planType === 'pro' && pricingData.pro_small?.pricing_model === 'per_user') {
          const perUserMonthlyPrice = parseFloat(pricingData.pro_small.monthly_price || '0');
          finalPrice = perUserMonthlyPrice * teamSize;
        } else if (
          planType === 'business' &&
          pricingData.business_small?.pricing_model === 'per_user'
        ) {
          const perUserMonthlyPrice = parseFloat(pricingData.business_small.monthly_price || '0');
          finalPrice = perUserMonthlyPrice * teamSize;
        } else if (planType === 'enterprise') {
          finalPrice = parseFloat(pricingData.enterprise.monthly_price || '0');
          if (!finalPrice && pricingData.enterprise.annual_price) {
            finalPrice = parseFloat(pricingData.enterprise.annual_price);
          }
        } else {
          const planData = planType === 'pro' ? pricingData.pro : pricingData.business;
          const basePrice = parseFloat(planData.monthly_price || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost = extraUsers * parseFloat(planData.additional_user_price || '0');
          finalPrice = basePrice + extraUserCost;
        }
      } else {
        let planData;
        if (planType === 'pro') {
          planData = pricingData.pro;
        } else if (planType === 'business') {
          planData = pricingData.business;
        } else {
          planData = pricingData.enterprise;
        }

        if (planType === 'enterprise') {
          finalPrice = parseFloat(planData.monthly_price || '0');
          if (!finalPrice && planData.annual_price) {
            finalPrice = parseFloat(planData.annual_price);
          }
        } else {
          const basePrice = parseFloat(planData.monthly_price || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost = extraUsers * parseFloat(planData.additional_user_price || '0');
          finalPrice = basePrice + extraUserCost;
        }
      }

      if (isAppSumoUser) {
        finalPrice = finalPrice * 0.5;
      }

      return finalPrice.toFixed(2);
    },
    [teamSize, pricingData, isAppSumoUser]
  );

  const calculateAnnualTotal = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      let finalPrice = 0;

      if (teamSize <= TEAM_SIZE_THRESHOLD) {
        if (planType === 'pro' && pricingData.pro_small?.pricing_model === 'per_user') {
          const perUserMonthlyIfAnnual = parseFloat(pricingData.pro_small.annual_price || '0');
          finalPrice = perUserMonthlyIfAnnual * 12 * teamSize;
        } else if (
          planType === 'business' &&
          pricingData.business_small?.pricing_model === 'per_user'
        ) {
          const perUserMonthlyIfAnnual = parseFloat(pricingData.business_small.annual_price || '0');
          finalPrice = perUserMonthlyIfAnnual * 12 * teamSize;
        } else if (planType === 'enterprise') {
          const annualTotal = parseFloat(pricingData.enterprise.annual_total || '0');
          if (annualTotal > 0) {
            finalPrice = annualTotal;
          } else {
            finalPrice = parseFloat(pricingData.enterprise.annual_price || '0') * 12;
          }
        } else {
          const planData = planType === 'pro' ? pricingData.pro : pricingData.business;
          const baseAnnualTotal = parseFloat(planData.annual_total || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost =
            extraUsers * parseFloat(planData.additional_user_price || '0') * 12;
          finalPrice = baseAnnualTotal + extraUserCost;
        }
      } else {
        let planData;
        if (planType === 'pro') {
          planData = pricingData.pro;
        } else if (planType === 'business') {
          planData = pricingData.business;
        } else {
          planData = pricingData.enterprise;
        }

        if (planType === 'enterprise') {
          const annualTotal = parseFloat(planData.annual_total || '0');
          if (annualTotal > 0) {
            finalPrice = annualTotal;
          } else {
            finalPrice = parseFloat(planData.annual_price || '0') * 12;
          }
        } else {
          const baseAnnualTotal = parseFloat(planData.annual_total || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost =
            extraUsers * parseFloat(planData.additional_user_price || '0') * 12;
          finalPrice = baseAnnualTotal + extraUserCost;
        }
      }

      if (isAppSumoUser) {
        finalPrice = finalPrice * 0.5;
      }

      return finalPrice.toFixed(2);
    },
    [teamSize, pricingData, isAppSumoUser]
  );

  const getPriceLabel = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      const useSmallTeamPricing = teamSize <= TEAM_SIZE_THRESHOLD;

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

  // Tier mapping function
  const mapTierBasedPricingToFrontend = (tiers: any[]): PricingData => {
    const mapped = getInitialPricingData();

    tiers.forEach(tier => {
      const tierName = tier.tier_name;
      const getPlanId = (tier: any, isAnnual: boolean) => 
        isAnnual 
          ? (tier.plans?.annual_plan_id || tier.annual_paddle_plan_id || tier.paddle_plan_id || '')
          : (tier.plans?.monthly_plan_id || tier.monthly_paddle_plan_id || tier.paddle_plan_id || '');

      switch (tierName) {
        case 'PRO_SMALL':
          mapped.pro_small = {
            monthly_price: tier.monthly_per_user_price?.toString() || '',
            annual_price: tier.annual_per_user_price?.toString() || '',
            users_included: tier.min_users?.toString() || '',
            max_users: tier.max_users?.toString() || '',
            additional_user_price: tier.monthly_per_user_price?.toString() || '',
            pricing_model: 'per_user',
            monthly_plan_id: getPlanId(tier, false),
            annual_plan_id: getPlanId(tier, true),
            tier_id: tier.id,
          };
          break;
          
        case 'PRO_LARGE':
          mapped.pro = {
            monthly_price: tier.monthly_base_price?.toString() || '',
            annual_price: tier.annual_base_price
              ? (Number(tier.annual_base_price) / 12).toFixed(2)
              : '',
            annual_total: tier.annual_base_price?.toString() || '',
            users_included: tier.included_users?.toString() || '',
            max_users: tier.max_users?.toString() || '',
            additional_user_price: tier.monthly_per_user_price?.toString() || '',
            pricing_model: 'base_plan',
            monthly_plan_id: getPlanId(tier, false),
            annual_plan_id: getPlanId(tier, true),
            tier_id: tier.id,
          };
          break;
          
        case 'BUSINESS_SMALL':
          mapped.business_small = {
            monthly_price: tier.monthly_per_user_price?.toString() || '',
            annual_price: tier.annual_per_user_price?.toString() || '',
            users_included: tier.min_users?.toString() || '',
            max_users: tier.max_users?.toString() || '',
            additional_user_price: tier.monthly_per_user_price?.toString() || '',
            pricing_model: 'per_user',
            monthly_plan_id: getPlanId(tier, false),
            annual_plan_id: getPlanId(tier, true),
            tier_id: tier.id,
          };
          break;
          
        case 'BUSINESS_LARGE':
          mapped.business = {
            monthly_price: tier.monthly_base_price?.toString() || '',
            annual_price: tier.annual_base_price
              ? (Number(tier.annual_base_price) / 12).toFixed(2)
              : '',
            annual_total: tier.annual_base_price?.toString() || '',
            users_included: tier.included_users?.toString() || '',
            max_users: tier.max_users?.toString() || '',
            additional_user_price: tier.monthly_per_user_price?.toString() || '',
            pricing_model: 'base_plan',
            monthly_plan_id: getPlanId(tier, false),
            annual_plan_id: getPlanId(tier, true),
            tier_id: tier.id,
          };
          break;
          
        case 'ENTERPRISE':
          mapped.enterprise = {
            monthly_price: tier.monthly_base_price?.toString() || '',
            annual_price: tier.annual_base_price
              ? (Number(tier.annual_base_price) / 12).toFixed(2)
              : '',
            annual_total: tier.annual_base_price?.toString() || '',
            users_included: 'Unlimited',
            max_users: 'Unlimited',
            additional_user_price: '0',
            pricing_model: 'base_plan',
            monthly_plan_id: getPlanId(tier, false),
            annual_plan_id: getPlanId(tier, true),
            tier_id: tier.id,
          };
          break;
          
        case 'FREE':
          mapped.free = {
            monthly_price: '0',
            annual_price: '0',
            users_included: tier.included_users?.toString() || '',
            max_users: tier.max_users?.toString() || '',
            additional_user_price: '0',
            pricing_model: 'free',
            tier_id: tier.id,
          };
          break;
      }
    });

    return mapped;
  };

  // API functions
  const fetchAppSumoDiscountInfo = async () => {
    if (!isAppSumoUser) return;

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
      }
    } catch (error) {
      console.error('Failed to fetch AppSumo discount info:', error);
    }
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

        // Filter tiers for AppSumo users
        let filteredTiers = tiers;
        if (isAppSumoUser) {
          filteredTiers = tiers.filter((tier: any) => {
            return tier.tier_name.includes('BUSINESS') || tier.tier_name.includes('ENTERPRISE');
          });

          // Apply AppSumo-specific modifications
          filteredTiers = filteredTiers.map((tier: any) => {
            const modifiedTier = { ...tier };

            if (tier.tier_name.includes('BUSINESS')) {
              modifiedTier.max_users = Math.min(50, tier.max_users || 25);
              modifiedTier.appsumo_special_limit = 50;
            }

            // Apply 50% discount if eligible
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

          await fetchAppSumoDiscountInfo();
        }

        setBackendPlans(tiers as any);
        const mappedPricing = mapTierBasedPricingToFrontend(filteredTiers);
        setPricingData(mappedPricing);
      }
    } catch (error) {
      logger.error('Error fetching pricing plans', error);
      // No fallback data - keep plans empty if API fails
      message.error('Failed to load pricing plans. Please refresh the page.');
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
        message.success('Subscription updated successfully!');
        setPaddleLoading(true);
        setTimeout(() => {
          dispatch(fetchBillingInfo());
          dispatch(toggleUpgradeModal());
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
        }, PADDLE_CHECKOUT_DELAY);
        break;
      case 'Checkout.Close':
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        break;
      case 'Checkout.Error':
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
          const planData =
            teamSize <= TEAM_SIZE_THRESHOLD && pricingData.pro_small 
              ? pricingData.pro_small 
              : pricingData.pro;
          return isAnnual ? planData?.annual_plan_id : planData?.monthly_plan_id;
        } else if (type === 'business') {
          const planData =
            teamSize <= TEAM_SIZE_THRESHOLD && pricingData.business_small
              ? pricingData.business_small
              : pricingData.business;
          return isAnnual ? planData?.annual_plan_id : planData?.monthly_plan_id;
        } else if (type === 'enterprise') {
          return isAnnual
            ? pricingData.enterprise?.annual_plan_id
            : pricingData.enterprise?.monthly_plan_id;
        }
        return null;
      };

      planId = getPlanIdForType(targetPlanType);

      if (!planId) {
        console.error('Plan ID not found', {
          targetPlanType,
          teamSize,
          isAnnual,
          pricingData,
        });
      }

      // Set the selected plan for the legacy system
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

  // Effects
  useEffect(() => {
    const initializeData = async () => {
      await fetchPricingPlans();

      if (isAppSumoUser) {
        await fetchAppSumoDiscountInfo();
      }
    };

    initializeData();

    if (billingInfo?.total_used) {
      setTeamSize(billingInfo.total_used || 1);
    }
  }, [billingInfo]);

  useEffect(() => {
    return () => {
      const paddleScript = document.querySelector('script[src*="paddle.js"]');
      if (paddleScript) {
        paddleScript.remove();
      }
    };
  }, []);

  // Render functions
  const renderPlanCard = (
    planType: PlanType,
    title: string,
    description: string,
    features: React.ReactNode[],
    priceDisplay: React.ReactNode
  ) => (
    <Card
      style={{
        height: '100%',
        border: selectedPlanType === planType ? '2px solid #1890ff' : '1px solid #d9d9d9',
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
        setSelectedPlanType(planType);
        if (planType === 'free') {
          setSelectedCard(paddlePlans.FREE);
        }
      }}
      hoverable
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Typography.Title level={4} style={{ marginBottom: 8 }}>
          {title}
        </Typography.Title>
        <Typography.Text type="secondary">{description}</Typography.Text>
      </div>

      {priceDisplay}

      <div style={{ flex: 1, marginBottom: 24 }}>{features}</div>
    </Card>
  );

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

      {/* AppSumo User Notification */}
      {isAppSumoUser && appSumoDiscountInfo && (
        <Row justify="center" style={{ marginTop: 24, marginBottom: 16 }}>
          <Col xs={24} sm={22} md={20} lg={18} xl={16}>
            {appSumoDiscountInfo.eligibleForDiscount ? (
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

      {/* Team Size Input and Billing Frequency Toggle */}
      <Row
        justify="center"
        align="middle"
        style={{ marginTop: isAppSumoUser ? 8 : 24, marginBottom: 16 }}
      >
        <Space size="large" align="center">
          <Space align="center" size="middle">
            <Typography.Text strong>Team Size:</Typography.Text>
            <Select
              value={teamSize}
              onChange={(value: number) => setTeamSize(value)}
              style={{ width: 140 }}
              size="large"
              options={generateTeamSizeOptions()}
              showSearch
              optionFilterProp="label"
              placeholder="Select team size"
              loading={isLoadingPlans}
              disabled={isLoadingPlans}
            />
          </Space>

          <Space align="center" size="middle">
            <Typography.Text strong>Billing Cycle:</Typography.Text>
            <Button.Group size="large">
              <Button
                type={billingFrequency === 'monthly' ? 'primary' : 'default'}
                onClick={() => {
                  setBillingFrequency('monthly');
                  setSelectedCard(paddlePlans.MONTHLY);
                }}
                disabled={isLoadingPlans}
              >
                {t('pricing-modal:billingCycle.monthly')}
              </Button>
              <Button
                type={billingFrequency === 'annual' ? 'primary' : 'default'}
                onClick={() => {
                  setBillingFrequency('annual');
                  setSelectedCard(paddlePlans.ANNUAL);
                }}
                disabled={isLoadingPlans}
              >
                {t('pricing-modal:billingCycle.yearly')}
              </Button>
            </Button.Group>
          </Space>
        </Space>
      </Row>

      {/* Pricing Model Information */}
      {!isAppSumoUser && !isLoadingPlans && (pricingData.pro_small || pricingData.business_small) && (
        <Row justify="center" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ textAlign: 'center' }}>
            {billingInfo?.total_used && (
              <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                {teamSize <= TEAM_SIZE_THRESHOLD && (pricingData.pro_small || pricingData.business_small)
                  ? `Automatically using per-user pricing for ${teamSize} user${teamSize > 1 ? 's' : ''}`
                  : `Automatically using base plan pricing for ${teamSize} user${teamSize > 1 ? 's' : ''}`}
              </Typography.Text>
            )}
          </Space>
        </Row>
      )}

      {/* Pricing Cards */}
      <Row className="w-full" gutter={[16, 16]} style={{ marginTop: 16 }}>
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
                {renderPlanCard(
                  'free',
                  t('pricing-modal:plans.free.name'),
                  t('pricing-modal:plans.free.description'),
                  [
                    ...(plans.projects_limit ? [<PlanFeature key="1" text={`${plans.projects_limit} ${t('projects', 'Projects')}`} />] : []),
                    ...(plans.team_member_limit ? [<PlanFeature key="2" text={`${plans.team_member_limit} ${t('users', 'Users')}`} />] : []),
                    <PlanFeature key="3" text={t('taskListKanban', 'Task List & Kanban Board')} />,
                    <PlanFeature key="4" text={t('personalViews', 'Personal Task & Calendar Views')} />,
                    <PlanFeature key="5" text={t('fileUploads', 'File Uploads & Comments')} />,
                    <PlanFeature key="6" text={t('labelsFilters', 'Labels & Filters')} />,
                  ],
                  <PlanPriceDisplay
                    price="0"
                    label={t('pricing-modal:plans.free.forever')}
                  />
                )}
              </Col>
            )}

            {/* Pro Plan - Hide for AppSumo users */}
            {!isAppSumoUser && (
              <Col xs={24} lg={6}>
                {renderPlanCard(
                  'pro',
                  t('pricing-modal:plans.pro.name'),
                  t('pricing-modal:plans.pro.description'),
                  [
                    <PlanFeature key="1" text={t('unlimitedProjects', 'Unlimited Projects')} />,
                    <PlanFeature key="2" text={`${teamSize <= TEAM_SIZE_THRESHOLD && pricingData.pro_small?.pricing_model === 'per_user' 
                      ? 'Pay per user (1-5 users)' 
                      : `${pricingData.pro.users_included} Users Included`}`} />,
                    <PlanFeature key="3" text={`Up to ${teamSize <= TEAM_SIZE_THRESHOLD && pricingData.pro_small 
                      ? pricingData.pro_small.max_users 
                      : pricingData.pro.max_users} Users Max`} />,
                    <PlanFeature key="4" text={t('timeTracking', 'Time Tracking & Analytics')} />,
                    <PlanFeature key="5" text={t('projectTemplates', 'Project Templates & Phases')} />,
                    <PlanFeature key="6" text={t('ganttReadOnly', 'Gantt Charts (Read-only)')} />,
                    <PlanFeature key="7" text={t('customFields', 'Custom Fields & Subtasks')} />,
                    <PlanFeature key="8" text={t('projectInsights', 'Project Insights & Reports')} />,
                  ],
                  <PlanPriceDisplay
                    price={billingFrequency === 'annual' 
                      ? calculateAnnualTotal('pro') 
                      : calculateMonthlyTotal('pro')}
                    label={`${getPriceLabel('pro')} ${billingFrequency === 'annual' ? '(billed annually)' : ''}`}
                    isAppSumoUser={isAppSumoUser}
                  />
                )}
              </Col>
            )}

            {/* Business Plan */}
            <Col xs={24} lg={isAppSumoUser ? 12 : 6}>
              {renderPlanCard(
                'business',
                t('pricing-modal:plans.business.name'),
                t('pricing-modal:plans.business.description'),
                [
                  <Typography.Text key="header" strong style={{ display: 'block', marginBottom: 12, textAlign: 'center' }}>
                    {t('everythingInPro', 'Everything in Pro, plus:')}
                  </Typography.Text>,
                  <PlanFeature key="1" text={`${teamSize <= TEAM_SIZE_THRESHOLD && pricingData.business_small?.pricing_model === 'per_user'
                    ? 'Pay per user (1-5 users)'
                    : `${pricingData.business.users_included} Users Included`}`} />,
                  <PlanFeature key="2" text={`Up to ${isAppSumoUser && teamSize > TEAM_SIZE_THRESHOLD 
                    ? '50' 
                    : teamSize <= TEAM_SIZE_THRESHOLD && pricingData.business_small 
                      ? pricingData.business_small.max_users 
                      : pricingData.business.max_users} Users Max${isAppSumoUser && teamSize > TEAM_SIZE_THRESHOLD ? ' (AppSumo Special)' : ''}`} />,
                  <PlanFeature key="3" text={t('fullGanttCharts', 'Full Gantt Charts')} />,
                  <PlanFeature key="4" text={t('projectHealth', 'Project Health Monitoring')} />,
                  <PlanFeature key="5" text={t('clientPortal', 'Client Portal')} />,
                  <PlanFeature key="6" text={t('financeTracking', 'Finance & Billable Tracking')} />,
                  <PlanFeature key="7" text={t('scheduler', 'Advanced Scheduler')} />,
                ],
                <PlanPriceDisplay
                  price={billingFrequency === 'annual' 
                    ? calculateAnnualTotal('business') 
                    : calculateMonthlyTotal('business')}
                  label={`${getPriceLabel('business')} ${billingFrequency === 'annual' ? '(billed annually)' : ''}`}
                  isAppSumoUser={isAppSumoUser}
                />
              )}
            </Col>

            {/* Enterprise Plan */}
            <Col xs={24} lg={isAppSumoUser ? 12 : 6}>
              {renderPlanCard(
                'enterprise',
                t('pricing-modal:plans.enterprise.name'),
                t('pricing-modal:plans.enterprise.description'),
                [
                  <Typography.Text key="header" strong style={{ display: 'block', marginBottom: 12, textAlign: 'center' }}>
                    {t('everythingInBusiness', 'Everything in Business, plus:')}
                  </Typography.Text>,
                  <PlanFeature key="1" text={`${pricingData.enterprise.users_included} Users`} />,
                  <PlanFeature key="2" text={t('noExtraUserCost', 'No Extra User Cost')} />,
                  <PlanFeature key="3" text={t('advancedSecurity', 'Advanced Security')} />,
                  <PlanFeature key="4" text={t('customIntegrations', 'Custom Integrations')} />,
                  <PlanFeature key="5" text={t('prioritySupport', 'Priority Support')} />,
                ],
                <PlanPriceDisplay
                  price={billingFrequency === 'annual' 
                    ? calculateAnnualTotal('enterprise') 
                    : calculateMonthlyTotal('enterprise')}
                  label={`${getPriceLabel('enterprise')} ${billingFrequency === 'annual' ? '(billed annually)' : ''}`}
                  isAppSumoUser={isAppSumoUser}
                />
              )}
            </Col>
          </>
        )}
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
            loading={switchingToPaddlePlan || paddleLoading || switchingToFreePlan || isLoadingPlans}
            disabled={!selectedPlanType || isLoadingPlans}
          >
            {(() => {
              if (isLoadingPlans) {
                return 'Loading Plans...';
              }
              if (!selectedPlanType) {
                return 'Select a Plan';
              }
              if (selectedPlanType === 'free') {
                return t('pricing-modal:buttons.getStartedFree', 'Get Started Free');
              }
              return t('pricing-modal:buttons.choosePlan', 'Continue with Selected Plan');
            })()}
          </Button>
          {selectedPlanType && !isLoadingPlans && (
            <Typography.Text
              type="secondary"
              style={{ display: 'block', textAlign: 'center', marginTop: 8 }}
            >
              {(() => {
                if (selectedPlanType === 'free') {
                  return 'Switch to Free Plan';
                }
                const total =
                  billingFrequency === 'annual'
                    ? calculateAnnualTotal(selectedPlanType as 'pro' | 'business' | 'enterprise')
                    : calculateMonthlyTotal(selectedPlanType as 'pro' | 'business' | 'enterprise');
                const planName = selectedPlanType.charAt(0).toUpperCase() + selectedPlanType.slice(1);
                const period = billingFrequency === 'annual' ? '/year' : '/month';
                const userText = selectedPlanType === 'enterprise' 
                  ? '' 
                  : ` for ${teamSize} user${teamSize > 1 ? 's' : ''}`;
                
                return `${planName} Plan - $${total}${period}${userText}`;
              })()}
              {isAppSumoUser && selectedPlanType !== 'free' && (
                <span style={{ color: '#52c41a', fontWeight: 'bold', display: 'block' }}>
                  70% AppSumo Discount Applied
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