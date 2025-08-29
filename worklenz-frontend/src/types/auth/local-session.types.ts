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
}
