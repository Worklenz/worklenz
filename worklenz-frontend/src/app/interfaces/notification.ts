export interface INotification {
  id?: string;
  message?: string;
  user_id?: string;
  team_id?: string;
  read?: boolean;
  team?: string;
  project?: string;
  url?: string;
  color?: string;
  team_color?: string;
  created_at?: string;
  updated_at?: string;
}
