import { IProjectTask } from '../project/projectTasksViewModel.types';
import { ITaskStatusViewModel } from '../tasks/taskStatusGetResponse.types';

export interface IMyTask extends IProjectTask {
  is_task: boolean;
  done: boolean;
  project_color?: string;
  project_name?: string;
  team_id?: string;
  status_color?: string;
  project_statuses?: ITaskStatusViewModel[];
  parent_task_name?: string;
  /** Pinned by the current user on Today's Priorities. Only set on rows from GET /home/tasks. */
  is_pinned?: boolean;
  pinned_at?: string | null;
}
