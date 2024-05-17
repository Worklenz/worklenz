import {ITaskComment} from "@interfaces/task-comment";

export interface ITaskCommentViewModel extends ITaskComment {
  is_edited?: boolean;
  member_name?: string;
  team_member_id?: string;
  avatar_url?: string;
}
