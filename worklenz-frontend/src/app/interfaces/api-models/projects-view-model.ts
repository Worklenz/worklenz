import {IProjectViewModel} from "@interfaces/api-models/project-view-model";

export interface IProjectsViewModel {
  total?: number;
  data?: IProjectViewModel[]
}
