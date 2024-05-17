export interface ITaskListEstimationChangeResponse {
  id: string;
  total_minutes: number;
  total_hours: number;
  parent_task: string;
  time_spent_string: string;
  total_time_string: string;
}
