import { ITaskAssignee } from './task.types';
import { ITaskLabel } from './taskLabel.types';

export interface IBulkTasksStatusChangeRequest {
  tasks: string[];
  status_id: string;
}

export interface IBulkTasksPriorityChangeRequest {
  tasks: string[];
  priority_id: string;
}

export interface IBulkTasksPhaseChangeRequest {
  tasks: string[];
  phase_id: string;
}

export interface IBulkTasksDeleteRequest {
  tasks: string[];
}

export interface IBulkTasksArchiveRequest {
  tasks: string[];
  project_id: string;
}

export interface IBulkTasksLabelsRequest {
  tasks: string[];
  text: string | null;
  labels: ITaskLabel[];
}

export interface IBulkAssignRequest {
  tasks: string[];
  project_id: string;
}

export interface IBulkAssignMembersRequest {
  tasks: string[];
  project_id: string;
  members: ITaskAssignee[];
}
