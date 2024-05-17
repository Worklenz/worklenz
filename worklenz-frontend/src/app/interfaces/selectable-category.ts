import {IProjectCategory} from "@interfaces/project-category";

export interface ISelectableCategory extends IProjectCategory {
  selected?: boolean;
}
