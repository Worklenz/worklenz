import {IProject} from "@interfaces/project";

export interface ISelectableProject extends IProject {
  selected?: boolean;
}
