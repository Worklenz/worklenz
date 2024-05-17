export interface ITeamMember {
  id?: string;
  name?: string;
  job_title_id?: string;
  is_owner?: boolean;
  user_id?: string;
  team_id?: string;
  pending_invitation?: boolean;
  role_id?: string;
  created_at?: string;
  updated_at?: string;
}
