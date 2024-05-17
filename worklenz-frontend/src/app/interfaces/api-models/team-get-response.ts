import {ITeam} from "@interfaces/team";

export interface ITeamGetResponse extends ITeam {
  owner?: boolean;
  owns_by?: string;
  created_at?: string;
}
