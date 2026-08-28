export interface ITaskPhase {
  id: string;
  name: string;
  color_code: string;
  sort_index: number;
  default_assignee_id?: string | null;
  default_assignee_name?: string | null;
  default_assignee_avatar_url?: string | null;
}
