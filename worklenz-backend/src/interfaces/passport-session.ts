import {IUser} from "./user";

export interface IPassportSession extends IUser {
  id?: string;
  email?: string;
  name?: string;
  owner?: boolean;
  team_id?: string;
  organization_id?: string;
  team_member_id?: string;
  team_name?: string;
  is_admin?: boolean;
  is_member?: boolean;
  is_guest?: boolean;
  role_name?: string;
  /** Phase 5 — may create projects from templates (Owner/Admin always true). */
  can_create_projects_from_templates?: boolean;
  is_google?: boolean;
  has_password?: boolean;
  build_v?: string;
  timezone?: string;
  timezone_name?: string;
  socket_id?: string;
  is_expired?: boolean;
  owner_id?: string;
  subscription_status?: string;
  mobile_app_banner_dismissed?: boolean;
  appsumo_popup_frequency_days?: number;
}
