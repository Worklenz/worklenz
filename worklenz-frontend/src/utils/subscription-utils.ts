import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { ILocalSession } from '@/types/auth/local-session.types';

/**
 * Checks if user has access to business features (client portal, project finance)
 * PADDLE users with business or enterprise plans, ANNUAL_BUSINESS users, SELF_HOSTED users,
 * users on active Business plan trials, manual overrides, and AppSumo users with 5+ codes have access.
 */
export const hasBusinessFeatureAccess = (session: ILocalSession | null): boolean => {
  if (!session) return false;

  const isTruthy = (value: unknown): boolean =>
    value === true || value === 1 || value === 'true' || value === 't';

  // PRIORITY 1: Manual override flag (highest priority)
  if (isTruthy(session.business_plan_override)) {
    return true;
  }

  // Strict LTD rule: LTD users should not have Business feature access
  if (
    session.subscription_type === ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL ||
    String(session.subscription_status || '').toLowerCase() === 'life_time_deal'
  ) {
    return false;
  }

  // Check for active Business plan trial
  if (session.active_plan_trial === 'BUSINESS_LARGE' && session.plan_trial_end_date) {
    const trialEndDate = new Date(session.plan_trial_end_date);
    if (trialEndDate > new Date()) {
      return true; // Active Business trial grants access
    }
  }

  // Check for Business trial subscription type (from deserialize_user)
  if (session.subscription_type === 'BUSINESS_TRIAL') {
    return true;
  }

  // ANNUAL_BUSINESS subscription type qualifies
  if (session.subscription_type === ISUBSCRIPTION_TYPE.ANNUAL_BUSINESS) {
    return true;
  }

  // SELF_HOSTED users have the same privileges as business plan users
  if (session.subscription_type === ISUBSCRIPTION_TYPE.SELF_HOSTED) {
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

  const isTruthy = (value: unknown): boolean =>
    value === true || value === 1 || value === 'true' || value === 't';

  // PRIORITY 1: Manual override flag (highest priority)
  if (isTruthy(session.business_plan_override)) {
    return true;
  }

  // Strict LTD rule: LTD users should not be treated as Business plan users
  if (
    session.subscription_type === ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL ||
    String(session.subscription_status || '').toLowerCase() === 'life_time_deal'
  ) {
    return false;
  }

  // Check for active Business plan trial
  if (session.subscription_type === 'BUSINESS_TRIAL') {
    return true;
  }

  if (session.active_plan_trial === 'BUSINESS_LARGE' && session.plan_trial_end_date) {
    const trialEndDate = new Date(session.plan_trial_end_date);
    if (trialEndDate > new Date()) {
      return true;
    }
  }

  // ANNUAL_BUSINESS is considered a business plan
  if (session.subscription_type === ISUBSCRIPTION_TYPE.ANNUAL_BUSINESS) {
    return true;
  }

  // SELF_HOSTED users are considered to have business plan privileges
  if (session.subscription_type === ISUBSCRIPTION_TYPE.SELF_HOSTED) {
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

  // SELF_HOSTED users are considered to have enterprise plan privileges
  if (session.subscription_type === ISUBSCRIPTION_TYPE.SELF_HOSTED) {
    return true;
  }

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

  // Check for plan trials first
  if (session.subscription_type === 'BUSINESS_TRIAL') {
    return 'Business Trial';
  }
  if (session.subscription_type === 'ENTERPRISE_TRIAL') {
    return 'Enterprise Trial';
  }
  if (session.subscription_type === 'PLAN_TRIAL') {
    return `${session.trial_plan_display_name || 'Plan'} Trial`;
  }

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
    case ISUBSCRIPTION_TYPE.SELF_HOSTED:
      return 'Self Hosted';
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

/**
 * Checks if user is currently on a plan-specific trial
 */
export const isOnPlanTrial = (session: ILocalSession | null): boolean => {
  if (!session) return false;
  return Boolean(
    session.is_plan_trial || (session.active_plan_trial && session.plan_trial_end_date)
  );
};

/**
 * Gets the number of days remaining in a plan trial
 */
export const getPlanTrialDaysRemaining = (session: ILocalSession | null): number => {
  if (!session?.plan_trial_end_date) return 0;

  const endDate = new Date(session.plan_trial_end_date);
  const today = new Date();
  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
};

/**
 * Checks if user is on a Business plan trial specifically
 */
export const isOnBusinessTrial = (session: ILocalSession | null): boolean => {
  if (!session) return false;
  return (
    session.subscription_type === 'BUSINESS_TRIAL' ||
    (session.active_plan_trial === 'BUSINESS_LARGE' && Boolean(session.plan_trial_end_date))
  );
};

/**
 * Gets trial expiration message
 */
export const getTrialExpirationMessage = (session: ILocalSession | null): string | null => {
  if (!isOnPlanTrial(session)) return null;

  const daysRemaining = getPlanTrialDaysRemaining(session);
  const planName = session?.trial_plan_display_name || 'Plan';

  if (daysRemaining === 0) {
    return `Your ${planName} trial expires today`;
  } else if (daysRemaining === 1) {
    return `Your ${planName} trial expires tomorrow`;
  } else if (daysRemaining <= 3) {
    return `Your ${planName} trial expires in ${daysRemaining} days`;
  }

  return null;
};

/**
 * Checks if user should be restricted from setting project health
 * NOTE: Project health is now available to all users regardless of subscription plan
 */
export const shouldRestrictProjectHealth = (session: ILocalSession | null): boolean => {
  // No restrictions - all users can access project health
  return false;
};

/**
 * Checks if user should be restricted from using billable feature
 * Pro Plan users and AppSumo/Lifetime Deal users (who have Pro Plan features) are restricted
 */
export const shouldRestrictBillableFeature = (session: ILocalSession | null): boolean => {
  if (!session) return true;

  // Free users are restricted
  if (session.subscription_type === ISUBSCRIPTION_TYPE.FREE) {
    return true;
  }

  // AppSumo/Lifetime Deal users have Pro Plan features and should be restricted
  if (session.subscription_type === ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL) {
    return true;
  }

  // Pro Plan users are restricted
  if (session.subscription_type === ISUBSCRIPTION_TYPE.PADDLE) {
    const planName = session.plan_name?.toLowerCase() || '';
    if (planName.includes('pro')) {
      return true;
    }
  }

  // Business and Enterprise plans have access to billable feature
  return false;
};
