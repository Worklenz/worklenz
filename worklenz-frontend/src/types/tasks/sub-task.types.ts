import { InlineMember } from '@/types/teamMembers/inline-member.types';
import { IProjectTask } from '../project/projectTasksViewModel.types';

export interface ISubTask extends IProjectTask {
  id?: string;
  name?: string;
  status_color?: string;
  status?: string;
  status_name?: string;
  priority?: string;
  priority_name?: string;
  end_date?: string;
  names?: InlineMember[];
  show_handles?: boolean;
  min?: number;
  max?: number;
  color_code?: string;
}
