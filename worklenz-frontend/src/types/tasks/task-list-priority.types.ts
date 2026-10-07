export interface ITaskListPriorityChangeResponse {
  priority_id: string | undefined;
  /** Display name of the new priority, sent so consumers don't need the
   *  priority list loaded to resolve it. */
  priority_name?: string;
  id: string;
  parent_task?: string;
  color_code: string;
  color_code_dark: string;
  priority_value?: number;
}
