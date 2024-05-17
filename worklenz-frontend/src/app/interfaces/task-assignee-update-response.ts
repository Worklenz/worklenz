import {ITaskAssignee} from "@interfaces/api-models/project-tasks-view-model";
import {InlineMember} from "@interfaces/api-models/inline-member";
import {ITeamMemberViewModel} from "./api-models/team-members-get-response";

export interface ITaskAssigneesUpdateResponse {
  id: string;
  parent_task: string;
  assignees: ITaskAssignee[];
  names: InlineMember[];
  members: ITeamMemberViewModel[];
  mode: any;
  team_member_id: string;
}
