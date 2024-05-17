import {ITaskAssignee} from "@interfaces/task-assignee";

export interface IBulkAssignRequest {
  tasks: string[];
  project_id: string;
}

export interface IBulkAssignMembersRequest {
  tasks: string[];
  project_id: string;
  members: ITaskAssignee[];
}
