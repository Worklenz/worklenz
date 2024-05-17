import {IMentionMember} from "@interfaces/project-comments";

export interface IProjectCommentsCreateRequest {
  project_id?: string;
  project_name?:string;
  team_id?: string;
  team_name?: string;
  content?: string;
  mentions?: IMentionMember[];
}
