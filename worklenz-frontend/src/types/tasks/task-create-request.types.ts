import { ITask } from './task.types';

export interface ITaskCreateRequest extends ITask {
  status_id?: string;
  project_id?: string;
  task_index?: number;
  attachments?: string[];
  labels?: string[];
  parent_task_id?: string;
  reporter_id?: string;
  team_id?: string;
  priority_id?: string;
  phase_id?: string;
  chart_start?: string;
  offset?: number;
  width?: number;
  is_dragged?: boolean;
}

export interface IHomeTaskCreateRequest extends ITask {
  name: string;
  project_id?: string;
  reporter_id?: string;
  team_id?: string;
}
