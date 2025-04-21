import { IProject } from '@/types/project/project.types';
import { IProjectCategory } from '@/types/project/projectCategory.types';
import { ITeam } from '@/types/teams/team.type';

export interface ISelectableProject extends IProject {
  selected?: boolean;
}

export interface ISelectableTeam extends ITeam {
  selected?: boolean;
}

export interface ISelectableCategory extends IProjectCategory {
  selected?: boolean;
}
