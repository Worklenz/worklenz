import { InlineMember } from '../teamMembers/inlineMember.types';

export interface IMyDashboardProjectTask {
  id: string;
  name?: string;
  project_name?: string;
  project_color?: string;
  status_color?: string;
  project_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  done?: boolean;
  names?: InlineMember[];
}

export interface IMyDashboardAllTasksViewModel {
  total?: number;
  data?: IMyDashboardProjectTask[];
}

export interface IMyDashboardMyTask {
  id: string;
  name?: string;
  project_name?: string;
  project_color?: string;
  status_color?: string;
  project_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  names?: InlineMember[];
}
