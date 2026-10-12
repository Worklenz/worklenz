export interface ITaskDuplicateRequest {
  task_id: string;
  project_id: string;
  destination_project_id?: string;
  confirm_project_differences?: boolean;
  options: IDuplicateOptions;
}

export interface IDuplicateOptions {
  subtasks: boolean;
  attachments: boolean;
  dates: boolean;
  dependencies: boolean;
  assignees: boolean;
  labels: boolean;
  customFields: boolean;
  subscribers: boolean;
}
