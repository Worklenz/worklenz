import { ITaskAssignee } from '../project/projectTasksViewModel.types';
import { InlineMember } from '../teamMembers/inlineMember.types';
import { ITeamMemberViewModel } from '../teamMembers/teamMembersGetResponse.types';

export interface ITaskAssigneesUpdateResponse {
  id: string;
  parent_task: string;
  assignees: ITaskAssignee[];
  names: InlineMember[];
  members: ITeamMemberViewModel[];
  mode: any;
  team_member_id: string;
}
