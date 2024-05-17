export interface ITaskListStatusChangeResponse {
  status_id: string | undefined;
  id: string;
  parent_task: string;
  color_code: string;
  complete_ratio: number;
  completed_at?: string;
  timer_start_time?: number;
  statusCategory?: {
    is_todo: boolean;
    is_doing: boolean;
    is_done: boolean;
  };
}
