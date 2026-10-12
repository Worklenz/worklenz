export type SprintStatus = 'planned' | 'active' | 'completed';

export interface ITaskPhase {
  id: string;
  name: string;
  color_code: string;
  sort_index: number;
  default_assignee_id?: string | null;
  default_assignee_name?: string | null;
  default_assignee_avatar_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  sprint_status?: SprintStatus;
  sprint_goal?: string | null;
  /** Issues moved into the active sprint after it started. */
  scope_added_count?: number;
  /** Active sprint health metrics (0 for non-active phases). */
  issue_count?: number;
  done_issue_count?: number;
  total_points?: number;
  done_points?: number;
  blocked_issue_count?: number;
  high_priority_open_count?: number;
  usage?: number;
}
