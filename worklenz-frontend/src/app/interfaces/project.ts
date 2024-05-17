import {IProjectCategory} from "@interfaces/project-category";
import {IProjectStatus} from "@interfaces/project-status";
import {ITaskComment} from "@interfaces/task-comment";

export interface IProject {
  id?: string;
  name?: string;
  color_code?: string;
  notes?: string;
  team_id?: string;
  client_id?: string;
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
  status_id?: string;
  man_days?: number
  hours_per_day?: number
}

export interface IProjectUpdate {
  name?: string;
  category?: IProjectCategory;
  status?: IProjectStatus,
  notes?: string
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
  mentions: [
    user_name?: string,
    user_email?: string
  ];
}
