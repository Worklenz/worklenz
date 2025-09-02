import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { ILocalSession } from '@/types/auth/local-session.types';

/**
 * Checks if user has access to business features (client portal, project finance)
 * PADDLE users with business or enterprise plans and ANNUAL_BUSINESS users have access
 * Excludes lifetime deal users and other subscription types
 */
export const hasBusinessFeatureAccess = (session: ILocalSession | null): boolean => {
  if (!session) return false;

  // ANNUAL_BUSINESS subscription type qualifies
  if (session.subscription_type === ISUBSCRIPTION_TYPE.ANNUAL_BUSINESS) {
    return true;
  }

  // Only PADDLE subscription type qualifies for plan-based access
  if (session.subscription_type !== ISUBSCRIPTION_TYPE.PADDLE) {
    return false;
  }

  // Check if plan_name indicates business or enterprise plan
  const planName = session.plan_name?.toLowerCase() || '';
  return planName.includes('business') || planName.includes('enterprise');
};

/**
 * Checks if user is on a business plan specifically
 */
export const isBusinessPlan = (session: ILocalSession | null): boolean => {
  if (!session) return false;

  // ANNUAL_BUSINESS is considered a business plan
  if (session.subscription_type === ISUBSCRIPTION_TYPE.ANNUAL_BUSINESS) {
    return true;
  }

  if (session.subscription_type !== ISUBSCRIPTION_TYPE.PADDLE) {
    return false;
  }

  const planName = session.plan_name?.toLowerCase() || '';
  return planName.includes('business');
};

/**
 * Checks if user is on an enterprise plan specifically
 */
export const isEnterprisePlan = (session: ILocalSession | null): boolean => {
  if (!session) return false;

  if (session.subscription_type !== ISUBSCRIPTION_TYPE.PADDLE) {
    return false;
  }

  const planName = session.plan_name?.toLowerCase() || '';
  return planName.includes('enterprise');
};

/**
 * Checks if user is on a free plan
 */
export const isFreeUser = (session: ILocalSession | null): boolean => {
  if (!session) return true;
  return session.subscription_type === ISUBSCRIPTION_TYPE.FREE;
};

/**
 * Get the subscription plan type for display purposes
 */
export const getSubscriptionPlanType = (session: ILocalSession | null): string => {
  if (!session) return 'Unknown';

  switch (session.subscription_type) {
    case ISUBSCRIPTION_TYPE.FREE:
      return 'Free';
    case ISUBSCRIPTION_TYPE.TRIAL:
      return 'Trial';
    case ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL:
      return 'Lifetime Deal';
    case ISUBSCRIPTION_TYPE.CUSTOM:
      return 'Custom';
    case ISUBSCRIPTION_TYPE.CREDIT:
      return 'Credit';
    case ISUBSCRIPTION_TYPE.ANNUAL_BUSINESS:
      return 'Annual Business';
    case ISUBSCRIPTION_TYPE.PADDLE:
      const planName = session.plan_name?.toLowerCase() || '';
      if (planName.includes('business')) return 'Business';
      if (planName.includes('enterprise')) return 'Enterprise';
      if (planName.includes('pro')) return 'Pro';
      return 'Paddle';
    default:
      return 'Unknown';
  }
};
