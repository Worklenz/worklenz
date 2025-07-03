export interface IProjectViewModel {
  id: string;
  name: string;
  description: string;
  team_id: string;
  created_at: string;
  updated_at: string;
  use_manual_progress: boolean;
  use_weighted_progress: boolean;
  use_time_progress: boolean;
}
