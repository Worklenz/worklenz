// Mixpanel Event Types for Billing and Upgrade Flow

export type UserType = 'free' | 'trial' | 'paid' | 'appsumo';
export type BillingFrequency = 'monthly' | 'annual';
export type PricingModel = 'per_user' | 'base_plan';
export type PlanType = 'free' | 'pro' | 'business' | 'enterprise';

// Common properties across billing events
export interface BaseBillingEventProps {
  user_type: UserType;
  current_plan?: string;
  current_plan_type?: PlanType;
  trial_days_remaining?: number;
  is_appsumo_user?: boolean;
  team_size?: number;
  subscription_status?: string;
}

// Upgrade button events
export interface UpgradeButtonEventProps extends BaseBillingEventProps {
  source_location: string;
  badge_state?: 'trial_expiring' | 'last_day' | 'appsumo' | null;
  button_style?: 'default' | 'warning' | 'urgent' | 'appsumo';
}

// Plan selection events
export interface PlanSelectionEventProps extends BaseBillingEventProps {
  selected_plan: PlanType;
  previous_plan?: PlanType;
  billing_frequency: BillingFrequency;
  selected_team_size: number;
  pricing_model: PricingModel;
  calculated_monthly_price: number;
  calculated_annual_price?: number;
  discount_applied: boolean;
  discount_percentage?: number;
  is_small_team?: boolean;
}

// Team size change events
export interface TeamSizeChangeEventProps extends BaseBillingEventProps {
  old_team_size: number;
  new_team_size: number;
  selected_plan: PlanType;
  pricing_model: PricingModel;
  price_difference?: number;
}

// Billing frequency change events
export interface BillingFrequencyChangeEventProps extends BaseBillingEventProps {
  old_frequency: BillingFrequency;
  new_frequency: BillingFrequency;
  selected_plan: PlanType;
  annual_savings?: number;
  team_size: number;
}

// Checkout events
export interface CheckoutEventProps extends BaseBillingEventProps {
  plan_id: string;
  plan_type: PlanType;
  billing_frequency: BillingFrequency;
  team_size: number;
  checkout_amount: number;
  pricing_model: PricingModel;
  discount_applied: boolean;
  discount_percentage?: number;
  payment_method?: string;
}

// Checkout result events
export interface CheckoutResultEventProps extends CheckoutEventProps {
  success: boolean;
  error_message?: string;
  error_code?: string;
  time_to_complete?: number; // in seconds
}

// Billing page events
export interface BillingPageEventProps extends BaseBillingEventProps {
  entry_point?: string;
  storage_usage_percentage?: number;
  has_invoices?: boolean;
  has_charges?: boolean;
}

// AppSumo specific events
export interface AppSumoEventProps extends BaseBillingEventProps {
  promo_active: boolean;
  promo_days_remaining?: number;
  viewed_plan?: PlanType;
  discount_percentage: number;
}

// Modal events
export interface PricingModalEventProps extends BaseBillingEventProps {
  trigger_source: string;
  initial_plan_shown?: PlanType;
  initial_billing_frequency?: BillingFrequency;
  initial_team_size?: number;
}

// Event names enum for consistency
export enum MixpanelBillingEvents {
  // Upgrade button events
  UPGRADE_BUTTON_CLICKED = 'upgrade_button_clicked',
  UPGRADE_BUTTON_VIEWED = 'upgrade_button_viewed',
  
  // Pricing modal events
  PRICING_MODAL_OPENED = 'pricing_modal_opened',
  PRICING_MODAL_CLOSED = 'pricing_modal_closed',
  
  // Plan selection events
  PLAN_SELECTED = 'plan_selected',
  PLAN_COMPARED = 'plan_compared',
  
  // Configuration events
  BILLING_FREQUENCY_CHANGED = 'billing_frequency_changed',
  TEAM_SIZE_CHANGED = 'team_size_changed',
  
  // Checkout events
  CHECKOUT_INITIATED = 'checkout_initiated',
  CHECKOUT_COMPLETED = 'checkout_completed',
  CHECKOUT_FAILED = 'checkout_failed',
  CHECKOUT_ABANDONED = 'checkout_abandoned',
  
  // Free plan events
  FREE_PLAN_SELECTED = 'free_plan_selected',
  FREE_PLAN_SWITCH_COMPLETED = 'free_plan_switch_completed',
  
  // Billing page events
  BILLING_PAGE_VIEWED = 'billing_page_viewed',
  CURRENT_PLAN_VIEWED = 'current_plan_viewed',
  STORAGE_USAGE_VIEWED = 'storage_usage_viewed',
  INVOICES_VIEWED = 'invoices_viewed',
  CHARGES_VIEWED = 'charges_viewed',
  
  // AppSumo events
  APPSUMO_DISCOUNT_VIEWED = 'appsumo_discount_viewed',
  APPSUMO_UPGRADE_INITIATED = 'appsumo_upgrade_initiated',
  APPSUMO_PLAN_SELECTED = 'appsumo_plan_selected',
  
  // Error events
  PADDLE_LOAD_ERROR = 'paddle_load_error',
  PRICING_FETCH_ERROR = 'pricing_fetch_error',
}

// Helper function to get base properties
export function getBaseBillingProperties(
  userType: UserType,
  currentPlan?: string,
  trialDaysRemaining?: number,
  isAppSumoUser?: boolean,
  teamSize?: number,
  subscriptionStatus?: string
): BaseBillingEventProps {
  return {
    user_type: userType,
    current_plan: currentPlan,
    trial_days_remaining: trialDaysRemaining,
    is_appsumo_user: isAppSumoUser,
    team_size: teamSize,
    subscription_status: subscriptionStatus,
  };
}