import { IProjectMember } from './project/projectMember.types';

export interface IProjectMemberViewModel extends IProjectMember {
  id?: string;
  name?: string;
  email?: string;
  access?: string;
  pending_invitation?: boolean;
  all_tasks_count?: number;
  completed_tasks_count?: number;
  progress?: number;
  job_title?: string;
  avatar_url?: string;
  team_member_id?: string;
}

export interface IProjectMembersViewModel {
  total?: number;
  data?: IProjectMemberViewModel[];
}
