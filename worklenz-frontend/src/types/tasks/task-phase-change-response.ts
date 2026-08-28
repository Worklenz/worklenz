export interface ITaskPhaseChangeResponse {
  id: string;
  task_id: string | undefined;
  parent_task: string;
  color_code: string;
  phase_name?: string; // Optional: phase name sent directly from backend
}
