export interface ITaskListStatusChangeResponse {
  status_id: string | undefined;
  id: string;
  parent_task: string;
  color_code: string;
  color_code_dark: string;
  complete_ratio: number;
  completed_at?: string;
  timer_start_time?: number;
  statusCategory?: {
    is_todo: boolean;
    is_doing: boolean;
    is_done: boolean;
  };
  completed_deps?: boolean;
}
