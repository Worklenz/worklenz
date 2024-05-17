import {IOrganizationTeam} from "@interfaces/account-center";

export interface IOrganizationTeamGetRequest {
  total?: number;
  data?: IOrganizationTeam[];
  current_team_data?: IOrganizationTeam
}
