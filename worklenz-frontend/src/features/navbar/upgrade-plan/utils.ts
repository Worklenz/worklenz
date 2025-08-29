import { ILocalSession } from '@/types/auth/local-session.types';
import { IBillingAccountInfo } from '@/types/admin-center/admin-center.types';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import {
  UserCategory,
  SubscriptionStatus,
  PlanTier,
  UserSubscriptionInfo,
  PricingModel,
} from './types';

/**
 * Detects if a user is an AppSumo lifetime deal member
 */
export const isAppSumoUser = (
  session?: ILocalSession | null,
  billingInfo?: IBillingAccountInfo | null
): boolean => {
  const planName = billingInfo?.plan_name?.toLowerCase() || '';
  const subscriptionType = session?.subscription_type?.toLowerCase() || '';

  return (
    planName.includes('appsumo') ||
    subscriptionType.includes('appsumo') ||
    planName.includes('lifetime') ||
    subscriptionType.includes('lifetime')
  );
};

/**
 * Calculates days remaining for a subscription
 */
export const calculateDaysRemaining = (
  validTillDate?: string | null,
  trialExpireDate?: string | null
): number | null => {
  const expireDateStr = validTillDate || trialExpireDate;

  if (!expireDateStr) return null;

  const today = new Date();
  const expiryDate = new Date(expireDateStr);
  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 ? diffDays : null;
};

/**
 * Determines the user category based on subscription info
 */
export const getUserCategory = (
  session?: ILocalSession | null,
  billingInfo?: IBillingAccountInfo | null
): UserCategory => {
  if (isAppSumoUser(session, billingInfo)) {
    return UserCategory.APPSUMO;
  }

  const subscriptionType = session?.subscription_type;

  switch (subscriptionType) {
    case ISUBSCRIPTION_TYPE.TRIAL:
      return UserCategory.TRIAL;
    case ISUBSCRIPTION_TYPE.FREE:
      return UserCategory.FREE;
    case ISUBSCRIPTION_TYPE.CUSTOM:
      return UserCategory.CUSTOM;
    case ISUBSCRIPTION_TYPE.PADDLE:
      return UserCategory.PAID;
    default:
      return UserCategory.FREE;
  }
};

/**
 * Maps subscription status string to enum
 */
export const getSubscriptionStatus = (status?: string | null): SubscriptionStatus => {
  const statusLower = status?.toLowerCase();

  switch (statusLower) {
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'trialing':
      return SubscriptionStatus.TRIALING;
    case 'past_due':
      return SubscriptionStatus.PAST_DUE;
    case 'paused':
      return SubscriptionStatus.PAUSED;
    case 'canceled':
      return SubscriptionStatus.CANCELED;
    case 'expired':
      return SubscriptionStatus.EXPIRED;
    default:
      return SubscriptionStatus.ACTIVE;
  }
};

/**
 * Determines the plan tier from plan name
 */
export const getPlanTier = (planName?: string | null): PlanTier => {
  const name = planName?.toLowerCase() || '';

  if (name.includes('enterprise')) {
    return PlanTier.ENTERPRISE;
  } else if (name.includes('business') && name.includes('small')) {
    return PlanTier.BUSINESS_SMALL;
  } else if (name.includes('business')) {
    return PlanTier.BUSINESS;
  } else if (name.includes('pro') && name.includes('small')) {
    return PlanTier.PRO_SMALL;
  } else if (name.includes('pro')) {
    return PlanTier.PRO;
  } else {
    return PlanTier.FREE;
  }
};

/**
 * Determines the pricing model based on plan and team size
 */
export const getPricingModel = (planTier: PlanTier, teamSize?: number): PricingModel => {
  // Enterprise is always enterprise pricing
  if (planTier === PlanTier.ENTERPRISE) {
    return PricingModel.ENTERPRISE;
  }

  // Small team plans are per-user
  if (planTier === PlanTier.PRO_SMALL || planTier === PlanTier.BUSINESS_SMALL) {
    return PricingModel.PER_USER;
  }

  // For regular Pro and Business, decide based on team size
  if (teamSize && teamSize <= 5) {
    return PricingModel.PER_USER;
  }

  return PricingModel.BASE_PLAN;
};

/**
 * Gets complete user subscription information
 */
export const getUserSubscriptionInfo = (
  session?: ILocalSession | null,
  billingInfo?: IBillingAccountInfo | null
): UserSubscriptionInfo => {
  const userCategory = getUserCategory(session, billingInfo);
  const status = getSubscriptionStatus(billingInfo?.status);
  const planTier = getPlanTier(billingInfo?.plan_name);
  const daysRemaining = calculateDaysRemaining(
    session?.valid_till_date,
    session?.trial_expire_date
  );
  const teamSize = billingInfo?.total_used || 1;
  const pricingModel = getPricingModel(planTier, teamSize);

  return {
    status,
    planTier,
    userCategory,
    pricingModel,
    daysRemaining: daysRemaining || undefined,
    validTillDate: session?.valid_till_date,
    trialExpireDate: session?.trial_expire_date,
    seatCount: teamSize,
    maxSeats: 100, // Default max, can be adjusted based on plan
    isAppSumoUser: userCategory === UserCategory.APPSUMO,
    canUpgrade: planTier !== PlanTier.ENTERPRISE,
  };
};

/**
 * Formats pricing display text
 */
export const formatPricing = (
  price: number,
  billingCycle: 'monthly' | 'yearly',
  pricingModel: PricingModel,
  teamSize?: number
): string => {
  if (pricingModel === PricingModel.PER_USER) {
    const totalPrice = price * (teamSize || 1);
    return billingCycle === 'monthly' ? `$${totalPrice}/month` : `$${totalPrice}/year`;
  }

  return billingCycle === 'monthly' ? `$${price}/month` : `$${price}/year`;
};

/**
 * Gets available upgrade plans for a user
 */
export const getAvailableUpgradePlans = (userInfo: UserSubscriptionInfo): PlanTier[] => {
  const { planTier, isAppSumoUser } = userInfo;

  // AppSumo users can only upgrade to Business or Enterprise
  if (isAppSumoUser) {
    return [PlanTier.BUSINESS, PlanTier.ENTERPRISE];
  }

  // Regular users can upgrade to any plan higher than their current
  const allPlans = [
    PlanTier.FREE,
    PlanTier.PRO_SMALL,
    PlanTier.PRO,
    PlanTier.BUSINESS_SMALL,
    PlanTier.BUSINESS,
    PlanTier.ENTERPRISE,
  ];

  const currentIndex = allPlans.indexOf(planTier);
  return allPlans.slice(currentIndex + 1);
};

/**
 * Calculates urgency level for upgrade prompt
 */
export const getUpgradeUrgency = (daysRemaining?: number): 'normal' | 'warning' | 'urgent' => {
  if (daysRemaining === undefined || daysRemaining > 7) {
    return 'normal';
  }

  if (daysRemaining <= 3) {
    return 'urgent';
  }

  return 'warning';
};
