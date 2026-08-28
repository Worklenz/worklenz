// Home > Inbox — project conversation types (GET /project-comments/inbox/conversations)

export interface IInboxProjectConversation {
  id: string;
  name: string;
  color_code?: string;
  last_comment_id?: string;
  last_at?: string;
  author_id?: string;
  author_name?: string;
  last_preview?: string;
  unread_count: number;
}

// Rows of GET /project-comments/pinned/:projectId
export interface IPinnedProjectComment {
  id: string;
  user_id?: string;
  created_by?: string;
  avatar_url?: string;
  color_code?: string;
  created_at?: string;
  pinned_at?: string;
  pinned_by?: string;
  pinned_by_name?: string;
  content_preview?: string;
}

// Enriched NEW_PROJECT_COMMENT_RECEIVED socket payload
export interface INewProjectCommentSocketPayload {
  project_id: string;
  comment_id: string;
  created_at: string;
  author_id: string;
  author_name?: string;
  preview?: string;
}

export interface IProjectCommentDeletedSocketPayload {
  comment_id: string;
  project_id: string;
}

export interface IProjectCommentPinChangedSocketPayload {
  comment_id: string;
  project_id: string;
  pinned: boolean;
  pinned_at?: string | null;
  pinned_by?: string | null;
  pinned_by_name?: string | null;
}
