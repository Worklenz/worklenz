export interface ITaskPhaseChangeResponse {
  id: string;
  task_id: string | undefined;
  parent_task: string;
  color_code: string;
}
