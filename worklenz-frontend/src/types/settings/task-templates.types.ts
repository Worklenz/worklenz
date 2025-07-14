import { IProjectTask } from '../project/projectTasksViewModel.types';

export interface ITaskTemplatesGetResponse {
  name?: string;
  id?: string;
  created_at?: string;
}

export interface ITaskTemplateGetResponse {
  id?: string;
  name?: string;
  tasks?: IProjectTask[];
}
