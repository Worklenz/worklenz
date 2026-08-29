export interface ITaskListStatusChangeResponse {
  status_id: string | undefined;
  id: string;
  parent_task: string;
  color_code: string;
  color_code_dark: string;
  complete_ratio: number;
  completed_at?: string | null;
  timer_start_time?: number;
  statusCategory?: {
    is_todo: boolean;
    is_doing: boolean;
    is_done: boolean;
  };
  completed_deps?: boolean;
  /** Phase completion guard: true when the current user is not the phase assignee */
  phase_guard_blocked?: boolean;
  /** Display name of the phase assignee who should complete this task */
  phase_assignee_name?: string | null;
  /**
   * Set to true when this TASK_STATUS_CHANGE is a phase-auto-advance reset back to "To Do".
   * The frontend must apply this unconditionally, bypassing optimistic-update interference.
   */
  phase_auto_advanced?: boolean;
}
