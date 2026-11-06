/** Internal TypeScript interfaces for the Permission Schemes controller. */

export interface IPermissionSchemeRow {
  id: string;
  team_id: string;
  name: string;
  is_default: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface IPermissionGrantRow {
  scheme_id: string;
  role_name: string;
  permission: string;
  granted: boolean;
}

export interface IGrantUpdate {
  role_name: string;
  permission: string;
  granted: boolean;
}

export interface IPermissionGroupRow {
  id: string;
  team_id: string;
  name: string;
  created_at: string;
  member_count?: number;
}
