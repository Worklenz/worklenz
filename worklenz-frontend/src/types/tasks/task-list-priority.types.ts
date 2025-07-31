export interface ITaskListPriorityChangeResponse {
  priority_id: string | undefined;
  id: string;
  parent_task?: string;
  color_code: string;
  color_code_dark: string;
}
