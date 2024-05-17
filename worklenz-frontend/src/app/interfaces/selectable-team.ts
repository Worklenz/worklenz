import {ITeam} from "@interfaces/team";

export interface ISelectableTeam extends ITeam {
  selected?: boolean;
}
