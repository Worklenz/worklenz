export interface PricingTier {
  monthly_price?: string; // Legacy field, kept for compatibility
  annual_price?: string; // Legacy field, kept for compatibility
  annual_total?: string; // Legacy field, kept for compatibility
  users_included?: string; // Legacy field, kept for compatibility
  max_users?: string; // Legacy field, kept for compatibility
  additional_user_price?: string; // Legacy field, kept for compatibility

  // New API fields to match actual structure
  monthly_base_price: string;
  annual_base_price: string;
  monthly_per_user_price: string;
  annual_per_user_price: string;
  included_users: string;
  max_users_limit?: string;

  monthly_plan_id?: string;
  annual_plan_id?: string;
  pricing_model: string;
  tier_id?: string;
}

export interface PricingData {
  free: PricingTier;
  pro: PricingTier;
  pro_small: PricingTier;
  business: PricingTier;
  business_small: PricingTier;
  enterprise: PricingTier;
}

export interface AppSumoDiscountInfo {
  remainingDays: number;
  remainingHours: number;
  remainingMinutes: number;
  eligibleForDiscount: boolean;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export type PlanType = 'free' | 'pro' | 'business' | 'enterprise';
export type BillingFrequency = 'monthly' | 'annual';

export interface PlanFeatureProps {
  text: string;
  iconColor?: string;
}

export interface PlanPriceDisplayProps {
  monthlyPrice: string;
  annualPrice?: string;
  perUserMonthlyPrice?: string | null;
  perUserAnnualPrice?: string | null;
  isSmallTeam?: boolean;
  billingFrequency: 'monthly' | 'annual';
  label: string;
  subtitle?: React.ReactNode;
  isAppSumoUser?: boolean;
  originalMonthlyPrice?: string | null;
  originalAnnualPrice?: string | null;
}

export interface PlanCardProps {
  planType: PlanType;
  title: string;
  description: string;
  features: React.ReactNode[];
  priceDisplay: React.ReactNode;
  selectedPlanType: PlanType;
  onPlanSelect: (planType: PlanType) => void;
  isLoading?: boolean;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  primaryActionDisabled?: boolean;
  primaryActionLoading?: boolean;
  footerNote?: React.ReactNode;
  isAppSumoUser?: boolean;
  themeMode?: 'light' | 'dark';
  teamSize?: number;
  billingFrequency?: 'monthly' | 'annual';
  calculateTotalCostForPlan?: (
    planType: 'pro' | 'business' | 'enterprise',
    teamSize: number,
    isAnnual: boolean
  ) => number;
}

export interface AppSumoAlertProps {
  appSumoDiscountInfo: AppSumoDiscountInfo;
}

export interface PlanSelectionControlsProps {
  teamSize: number;
  billingFrequency: BillingFrequency;
  isLoadingPlans: boolean;
  isAppSumoUser: boolean;
  selectedPlanType: PlanType;
  onTeamSizeChange: (size: number) => void;
  onBillingFrequencyChange: (frequency: BillingFrequency) => void;
  generateTeamSizeOptions: () => { value: number; label: string; disabled?: boolean }[];
  minTeamSize: number;
  maxTeamSize: number;
  annualSavingsPercent?: number;
}
