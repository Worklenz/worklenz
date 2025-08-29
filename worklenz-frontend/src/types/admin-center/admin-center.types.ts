import { ISUBSCRIPTION_TYPE } from '@/shared/constants';

export interface IOrganization {
  name?: string;
  owner_name?: string;
  email?: string;
  contact_number?: string;
  contact_number_secondary?: string;
  calculation_method?: 'hourly' | 'man_days';
  hours_per_day?: number;
  country_code?: string;
  state_code?: string;
  auto_sync_holidays?: boolean;
}

export interface IOrganizationAdmin {
  name?: string;
  email?: string;
  is_owner?: boolean;
}

export interface IOrganizationUser {
  name?: string;
  email?: string;
  is_owner?: boolean;
  is_admin?: boolean;
  color_code?: string;
  avatar_url?: string;
  last_logged?: string;
  user_id?: string;
}

export interface IOrganizationTeamMember {
  id?: string;
  user_id?: string;
  name?: string;
  avatar_url?: string;
  color_code?: string;
  email?: string;
  role_id?: string;
  role_name?: string;
  created_at?: string;
  pending_invitation?: boolean;
}

export interface IOrganizationTeam {
  id?: string;
  name?: string;
  created_at?: string;
  members_count?: number;
  names?: any;
  team_members?: IOrganizationTeamMember[];
}

export enum ISubscriptionStatus {
  DELETED = 'deleted',
  PAUSED = 'paused',
  ACTIVE = 'active',
  PASTDUE = 'past_due',
  TRIALING = 'trialing',
  LIFE_TIME_DEAL = 'life_time_deal',
}

export interface IBillingAccountInfo {
  billing_type?: string;
  cancel_url?: string;
  cancellation_effective_date?: string;
  contact_no?: string;
  contact_number_secondary?: string;
  default_currency?: string;
  default_storage?: number;
  default_trial_storage?: number;
  email?: string;
  expire_date_string?: string;
  name?: string;
  paused_from?: string;
  plan_name?: string;
  plan_id?: string;
  remainingStorage?: number;
  status?: ISubscriptionStatus;
  trial_in_progress?: boolean;
  trial_expire_date?: string;
  valid_till_date?: string;
  unit_price?: number;
  unit_price_per_month?: number;
  usedPercentage?: number;
  usedStorage?: number;
  is_custom?: boolean;
  is_ltd_user?: boolean;
  ltd_users?: number;
  total_seats?: number;
  total_used?: number;
  is_lkr_billing?: boolean;
  subscription_type?: ISUBSCRIPTION_TYPE;
  pricing_model?: 'per_user' | 'flat_rate';
  flat_rate_price?: number;
  flat_rate_max_users?: number;
  actual_users?: number;
  subscription_id?: string;
}

export interface IPricingPlans {
  monthly_plan_id?: string | null;
  monthly_plan_name?: string;
  annual_plan_id?: string | null;
  annual_plan_name?: string;
  team_member_limit?: string;
  projects_limit?: string;
  free_tier_storage?: string;
  current_user_count?: string;
  annual_price?: string;
  monthly_price?: string;
}

export interface IPaddleCheckoutParams {
  custom_message?: string;
  customer_country?: string;
  customer_email?: string;
  customer_postcode?: string;
  discountable?: number;
  expires?: string;
  image_url?: string;
  is_recoverable?: number;
  marketing_consent?: number;
  passthrough?: string;
  prices?: Array<string>;
  product_id?: number;
  quantity_variable?: number;
  quantity?: number;
  recurring_prices?: string;
  return_url?: string;
  title?: string;
  trial_days?: number;
  vat_company_name?: string;
  vat_number?: string;
  webhook_url?: string;
  coupon_code?: string;
  vat_street?: string;
}

export interface IUpgradeSubscriptionPlanResponse {
  params: IPaddleCheckoutParams;
  sandbox: boolean;
  vendor_id: string;
  pricing_model?: 'per_user' | 'flat_rate';
  plan_variant?: any;
}

export interface IPricingOption {
  plan_id: string;
  plan_name: string;
  variant_type: 'per_user' | 'flat_rate';
  flat_price?: number;
  per_user_price?: number;
  user_range_min: number;
  user_range_max: number;
  total_cost: number;
  is_recommended: boolean;
}

export interface IPricingComparison {
  per_user: {
    total: number;
    per_seat: number;
    recommended: boolean;
  };
  flat_rate: {
    total: number;
    max_users: number;
    recommended: boolean;
  };
}

export interface IBillingConfiguration {
  name?: string;
  email?: string;
  organization_name?: string;
  contact_number?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface IBillingTransaction {
  subscription_payment_id?: string;
  event_time?: string;
  next_bill_date?: string;
  currency?: string;
  receipt_url?: string;
  payment_method?: string;
  payment_status?: string;
}

export interface IStorageInfo {
  storage?: string;
  default_trial_storage?: string;
  plan_name?: string;
  trial_expire_date?: string;
  trial_in_progress?: boolean;
  storage_addon_price?: string;
  storage_addon_size?: string;
}

export interface IBillingCharge {
  amount?: number;
  end_date?: string;
  name?: string;
  quantity?: number;
  start_date?: string;
  status?: string;
  unit_price?: number;
  currency?: string;
}

export interface IBillingAccountStorage {
  used?: number;
  total?: number;
  used_percent?: number;
  remaining?: number;
}

export interface IBillingConfigurationCountry {
  id?: string;
  name: string;
  code?: string;
}

export interface IBillingModifier {
  subscription_id?: string;
  created_at?: string;
}

export interface IBillingChargesResponse {
  plan_charges?: IBillingCharge[];
  modifiers?: IBillingModifier[];
}

export interface IOrganizationUsersGetRequest {
  total?: number;
  data?: IOrganizationUser[];
}

export interface IOrganizationTeamGetRequest {
  total?: number;
  data?: IOrganizationTeam[];
  current_team_data?: IOrganizationTeam;
}

export interface IOrganizationProject {
  id?: string;
  name?: string;
  created_at?: string;
  member_count?: number;
  team_name?: string;
}

export interface IFreePlanSettings {
  projects_limit?: number;
  team_member_limit?: number;
  free_tier_storage?: number;
}

export interface IOrganizationProjectsGetResponse {
  total?: number;
  data?: IOrganizationProject[];
}
