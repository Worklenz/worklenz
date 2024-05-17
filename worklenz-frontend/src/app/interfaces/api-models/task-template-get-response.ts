import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";

export interface ITaskTemplateGetResponse {
  id?: string;
  name?: string;
  tasks?: IProjectTask[]
}
