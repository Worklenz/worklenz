import { IUserType } from '../user.types';

export interface IWorklenzAlert {
  description: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export interface ILocalSession extends IUserType {
  team_id?: string;
  team_name?: string;
  owner?: boolean;
  demo_data?: boolean;
  is_admin?: boolean;
  is_member?: boolean;
  role_name?: string;
  build_v?: string;
  is_google?: boolean;
  setup_completed?: boolean;
  my_setup_completed?: boolean;
  timezone?: string;
  timezone_name?: string;
  avatar_url?: string;
  joined_date?: string;
  last_updated?: string;
  user_no?: number;
  team_member_id?: string;
  alerts?: Array<IWorklenzAlert>;
  is_expired?: boolean;
  subscription_status?: string;
  subscription_type?: string;
  plan_name?: string;
  trial_expire_date?: string;
  valid_till_date?: string;
  // Plan trial fields
  active_plan_trial?: string;      // 'BUSINESS', 'ENTERPRISE', etc.
  plan_trial_end_date?: string;    // End date of plan trial
  trial_days_remaining?: number;   // Days remaining in plan trial
  trial_plan_display_name?: string; // Display name of trial plan
  is_plan_trial?: boolean;         // Quick flag for plan trial status
  // Timestamp fields
  created_at?: string;
  updated_at?: string;
}
