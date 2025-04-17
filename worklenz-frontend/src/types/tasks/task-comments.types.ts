import { ITaskAttachment, ITaskAttachmentViewModel } from './task-attachment-view-model';

export interface ITaskCommentsCreateRequest {
  task_id?: string;
  content?: string;
  mentions?: any[];
  attachments?: ITaskAttachment[];
}

export interface ITaskAttachmentCreateRequest {
  task_id?: string;
  attachments?: ITaskAttachment[];
}

export interface ITaskComment {
  id?: string;
  content?: string;
  rawContent?: string;
  user_id?: string;
  team_member_id?: string;
  task_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ITaskCommentViewModel extends ITaskComment {
  edit?: boolean;
  is_edited?: boolean;
  member_name?: string;
  team_member_id?: string;
  avatar_url?: string;
  reactions?: ITaskCommentReaction;
  attachments?: ITaskAttachmentViewModel[];
}

interface ITaskCommentReaction {
  likes: {
    count: number;
    liked_members: string[];
    liked_member_ids: string[];
  };
}
