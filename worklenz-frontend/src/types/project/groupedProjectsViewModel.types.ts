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
  /** Total projects matching the current filters, independent of pagination —
   * summing `project_count` across `data` only covers the current page of groups. */
  total_projects: number;
  data: IProjectGroup[];
}
