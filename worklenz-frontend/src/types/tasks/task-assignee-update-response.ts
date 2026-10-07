import { ITaskAssignee } from '../project/projectTasksViewModel.types';
import { InlineMember } from '../teamMembers/inlineMember.types';
import { ITeamMemberViewModel } from '../teamMembers/teamMembersGetResponse.types';

export interface ITaskAssigneesUpdateResponse {
  id: string;
  parent_task?: string;
  assignees: ITaskAssignee[];
  names: InlineMember[];
  assignee_names?: InlineMember[];
  members?: ITeamMemberViewModel[];
  mode?: unknown;
  team_member_id?: string;
  name?: string;
}
