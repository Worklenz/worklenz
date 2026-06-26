// Subscription Status Types
export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  PAUSED = 'paused',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
}

// User Category Types for Pricing
export enum UserCategory {
  FREE = 'free',
  TRIAL = 'trial',
  APPSUMO = 'appsumo',
  PAID = 'paid',
  CUSTOM = 'custom',
  ENTERPRISE = 'enterprise',
}

// Plan Tier Types
export enum PlanTier {
  FREE = 'free',
  PRO_SMALL = 'pro_small',
  PRO = 'pro',
  BUSINESS_SMALL = 'business_small',
  BUSINESS = 'business',
  ENTERPRISE = 'enterprise',
}

// Pricing Model Types
export enum PricingModel {
  PER_USER = 'per_user',
  BASE_PLAN = 'base_plan',
  ENTERPRISE = 'enterprise',
}

// Button Display Configuration
export interface UpgradePlanButtonConfig {
  showBadge: boolean;
  badgeText?: string;
  badgeColor?: string;
  buttonStyle?: 'default' | 'warning' | 'urgent' | 'appsumo';
  tooltipContent?: string | React.ReactNode;
  icon?: React.ReactNode;
}

// User Subscription Info
export interface UserSubscriptionInfo {
  status: SubscriptionStatus;
  planTier: PlanTier;
  userCategory: UserCategory;
  pricingModel: PricingModel;
  daysRemaining?: number;
  validTillDate?: string;
  trialExpireDate?: string;
  seatCount?: number;
  maxSeats?: number;
  isAppSumoUser: boolean;
  canUpgrade: boolean;
}

// Upgrade Options
export interface UpgradeOption {
  planTier: PlanTier;
  name: string;
  description: string;
  pricing: {
    monthly: number;
    yearly: number;
    perUser?: number;
  };
  features: string[];
  recommended?: boolean;
  availableForAppSumo: boolean;
}

// Button Event Handlers
export interface UpgradePlanButtonHandlers {
  onUpgradeClick?: () => void;
  onPlanSelect?: (planTier: PlanTier, pricingModel: PricingModel) => void;
  onModalOpen?: () => void;
  onModalClose?: () => void;
}
