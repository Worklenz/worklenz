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
  is_google?: boolean;
  build_v?: string;
  timezone?: string;
  timezone_name?: string;
  socket_id?: string;
  is_expired?: boolean;
  owner_id?: string;
  subscription_status?: string;
  mobile_app_banner_dismissed?: boolean;
  appsumo_popup_frequency_days?: number;
  entitlements?: {
    tier: "free" | "pro" | "business" | "enterprise";
    features: string[];
    guest_limit: number; // -1 = unlimited
    seat_limit: number | null; // -1 = unlimited, null = unknown
    primary_source: string;
    enforced: boolean; // true when gates follow entitlements (ENTITLEMENTS_ENFORCE=on)
  };
}
