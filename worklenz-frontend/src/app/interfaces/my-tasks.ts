import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";

export interface IMyTask extends IProjectTask {
  is_task: boolean;
  done: boolean
  project_color?: string;
  project_name?: string;
  team_id?: string;
  status_color?: string;
  project_statuses?: ITaskStatusViewModel[];
  parent_task_name?: string;
}
