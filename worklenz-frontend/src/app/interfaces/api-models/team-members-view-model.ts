import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";

export interface ITeamMembersViewModel {
  data?: ITeamMemberViewModel[];
  total?: number;
}
