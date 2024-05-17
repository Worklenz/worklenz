export interface IBulkTasksDeleteResponse {
  deleted_tasks: string[];
  counts?: {
    total_tasks: number;
    total_completed: number;
  }
}
