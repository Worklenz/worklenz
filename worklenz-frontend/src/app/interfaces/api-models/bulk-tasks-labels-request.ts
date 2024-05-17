import {ITaskLabel} from "@interfaces/task-label";

export interface IBulkTasksLabelsRequest {
  tasks: string[];
  text: string | null;
  labels: ITaskLabel[];
}
