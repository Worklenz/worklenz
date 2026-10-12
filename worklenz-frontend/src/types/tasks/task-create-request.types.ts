import { ITask } from './task.types';
import { ITaskLabel } from '../label.type';

export type ITaskCreateRequest = Omit<Partial<ITask>, 'labels'> & {
  status_id?: string;
  project_id?: string;
  task_index?: number;
  attachments?: string[];
  labels?: string[] | ITaskLabel[];
  parent_task_id?: string | null;
  reporter_id?: string;
  team_id?: string;
  priority_id?: string;
  phase_id?: string;
  chart_start?: string;
  offset?: number;
  width?: number;
  is_dragged?: boolean;
};

export type IHomeTaskCreateRequest = Partial<ITask> & {
  name: string;
  project_id?: string;
  reporter_id?: string;
  team_id?: string;
};

