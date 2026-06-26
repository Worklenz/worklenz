export interface ITaskDuplicateRequest {
  task_id?: string;
  project_id?: string;
  options?: IDuplicateOptions[];
}

interface IDuplicateOptions {
  subtasks: boolean;
  attachments: boolean;
  dates: boolean;
  dependencies: boolean;
  assignees: boolean;
  labels: boolean;
  customFields: boolean;
  subscribers: boolean;
}
