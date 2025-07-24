import { IProject } from '@/types/project/project.types';
import { ITeamMemberViewModel } from '../teamMembers/teamMembersGetResponse.types';
import { ITask } from '../tasks/task.types';
import { InlineMember } from '../teamMembers/inlineMember.types';

export interface IProjectViewModel extends IProject {
  key?: string;
  client_name?: string | null;
  project_owner?: string;
  updated_at?: string;
  updated_at_string?: string;
  status?: string;
  status_color?: string;
  status_icon?: string;
  start_date?: string;
  end_date?: string;
  phase_label?: string;
  category_name?: string;
  category_color?: string;
  category_id?: string;
  health_id?: string;
  task_count?: number;
  members_count?: number;
  progress?: number;
  all_tasks_count?: number;
  completed_tasks_count?: number;

  favorite?: boolean;
  archived?: boolean;
  loading?: boolean;
  collapsed?: boolean;
  subscribed?: boolean;

  members?: ITeamMemberViewModel[];
  owner?: ITeamMemberViewModel | null;
  tasks?: ITask[];
  names?: Array<InlineMember>;

  project_manager?: ITeamMemberViewModel | null;
  project_manager_id?: string | null;

  team_member_default_view?: string;
  working_days?: number;

  id?: string;
  name?: string;
  description?: string;
  notes?: string;
  color_code?: string;
  status_id?: string;
  status_name?: string;
  status_color_dark?: string;
  health_name?: string;
  health_color?: string;
  health_color_dark?: string;
  category_color_dark?: string;
  client_id?: string;
  total_tasks?: number;
  completed_tasks?: number;
  tasks_progress?: number;
  man_days?: number;
  hours_per_day?: number;
  default_view?: string;
  task_key_prefix?: string;
  use_manual_progress?: boolean;
  use_weighted_progress?: boolean;
  use_time_progress?: boolean;
  currency?: string;
  budget?: number;
  calculation_method?: 'hourly' | 'man_days';
}
