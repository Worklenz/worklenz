import { IProjectViewModel } from './projectViewModel.types';

export interface IProjectGroup {
  group_key: string;
  group_name: string;
  group_color?: string;
  project_count: number;
  projects: IProjectViewModel[];
}

export interface IGroupedProjectsViewModel {
  total_groups: number;
  data: IProjectGroup[];
}
