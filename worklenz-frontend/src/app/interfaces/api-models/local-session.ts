import {IUser} from "../user";

export interface WorklenzAlert {
  description: string;
  type: "success" | "info" | "warning" | "error";
}

export interface ILocalSession extends IUser {
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
  alerts?: Array<WorklenzAlert>;
  is_expired?: boolean;
}
