export interface PricingTier {
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
  price: string;
  label: string;
  subtitle?: React.ReactNode;
  isAppSumoUser?: boolean;
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
  generateTeamSizeOptions: () => { value: number; label: string }[];
}