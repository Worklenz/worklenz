export interface ITaskAttachment {
  /** Base64 string */
  file: string;
  file_name: string;
  project_id: string;
  size: number;
  task_id?: string | null;
}
