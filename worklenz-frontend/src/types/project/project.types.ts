import { IProjectCategory } from '@/types/project/projectCategory.types';
import { IProjectStatus } from '@/types/project/projectStatus.types';

export interface IProject {
  id?: string;
  name?: string;
  color_code?: string;
  notes?: string;
  team_id?: string;
  client_id?: string;
  client_name?: string | null;
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
  status_id?: string;
  man_days?: number;
  hours_per_day?: number;
}

export interface IProjectUpdate {
  name?: string;
  category?: IProjectCategory;
  status?: IProjectStatus;
  notes?: string;
}

export interface IProjectUpdateComment {
  id?: string;
  content?: string;
  user_id?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface IProjectUpdateCommentViewModel extends IProjectUpdateComment {
  created_by?: string;
  avatar_url?: string;
  color_code?: string;
  mentions: [user_name?: string, user_email?: string];
}

export enum IProjectFilter {
  All = 'All',
  Favourites = 'Favorites',
  Archived = 'Archived',
}
