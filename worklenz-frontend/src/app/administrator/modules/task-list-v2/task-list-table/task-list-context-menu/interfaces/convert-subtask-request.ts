import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";

export interface ISubtaskConvertRequest {
  selectedTask: IProjectTask;
  projectId: string;
}
