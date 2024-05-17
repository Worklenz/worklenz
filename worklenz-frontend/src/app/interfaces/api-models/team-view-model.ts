import {ITeam} from "../team";

export interface ITeamViewModel extends ITeam {
  all_tasks?: number;
  completed_tasks?: number;
  owns_by?: string;
  loading?: boolean;
  owner?: boolean;
}
