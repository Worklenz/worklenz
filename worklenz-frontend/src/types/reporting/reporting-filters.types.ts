import { IProject } from '@/types/project/project.types';
import { IProjectCategory } from '@/types/project/projectCategory.types';
import { ITeam } from '@/types/teams/team.type';

export interface ISelectableProject extends IProject {
  selected?: boolean;
  // Additional properties for grouping
  category_name?: string;
  category_color?: string;
  team_name?: string;
  team_color?: string;
  status_name?: string;
  status_color?: string;
}

export interface ISelectableTeam extends ITeam {
  selected?: boolean;
}

export interface ISelectableCategory extends IProjectCategory {
  selected?: boolean;
}
