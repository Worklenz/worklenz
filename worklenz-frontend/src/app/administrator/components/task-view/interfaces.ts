import {InlineMember} from "@interfaces/api-models/inline-member";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {ITaskLabel} from "@interfaces/task-label";
import {ITaskAssignee, ITaskStatusCategory} from "@interfaces/api-models/project-tasks-view-model";

export interface ITaskViewTaskIds {
  id: string;
  project_id: string;
  parent_task_id?: string;
}

export interface ITaskViewTaskOpenRequest {
  task_id: string | null;
  project_id: string | null;
}
