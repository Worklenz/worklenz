import { MemberLoggedTimeType } from '../timeSheet/project.types';

export interface IAllocationProject {
  name?: string;
  color_code?: string;
  status_name?: string;
  status_color_code?: string;
  status_icon?: string;
  all_tasks_count?: number;
  completed_tasks_count?: number;
  progress?: number;
  total?: string;
  time_logs?: Array<{ time_logged: string }>;
}

export interface IAllocationViewModel {
  projects: Array<IAllocationProject>;
  users: Array<MemberLoggedTimeType>;
}
