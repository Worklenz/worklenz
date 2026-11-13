import type { PagedList, PagedParams, PortalSide } from './common';

export type ThreadContextType = 'project' | 'task' | 'file' | 'approval' | 'change_request';

/** `client` messages reach the portal. `internal` comments never do. */
export type MessageVisibility = 'client' | 'internal';

export interface ThreadContext {
  type: ThreadContextType;
  /** Null for the project's general thread. */
  ref_id: string | null;
  /** "General", "Task: Landing page copy", "Approval: AP-000123". */
  label: string;
}

export interface ThreadAttachment {
  id: string;
  /** The project file staff download from. Null once the file was removed from the project. */
  file_id: string | null;
  name: string;
  /** File extension without the dot, lower case. */
  type: string;
  size: number;
}

export interface ThreadReactionUser {
  id: string;
  name: string;
  side: PortalSide;
}

export interface ThreadReaction {
  emoji: string;
  count: number;
  has_reacted: boolean;
  users: ThreadReactionUser[];
}

export interface ThreadMessage {
  id: string;
  author: string;
  side: PortalSide;
  visibility: MessageVisibility;
  text: string;
  at: string;
  /** Names mentioned: client users on a client-visible message, project members on an internal comment. */
  mentions: string[];
  attachments: ThreadAttachment[];
  deleted?: boolean;
  reactions?: ThreadReaction[];
}

export interface Thread {
  id: string;
  /** Short reference staff can copy and search by, e.g. DS-000123. */
  ref_no: string;
  organization_id: string;
  organization_name: string;
  project_id: string;
  project_name: string;
  context: ThreadContext;
  unread: boolean;
  /** The linked task or file is Internal Only, so the client cannot see this thread. */
  hidden_from_client: boolean;
  last_message: { text: string; visibility: MessageVisibility; at: string; attachment_count: number };
  messages: ThreadMessage[];
}

export interface ThreadsParams extends PagedParams {
  project_id?: string;
  unread?: boolean;
  context_type?: ThreadContextType;
}

export type ThreadsList = PagedList<Thread>;

/** Active client users on the project, for the @ mention selector. */
export interface MentionOption {
  id: string;
  name: string;
}

export interface StartThreadRequest {
  project_id: string;
  context: { type: ThreadContextType; ref_id: string | null };
  /** A new thread always starts with a client-visible message. */
  message: string;
  /** Notify only these client users. Everyone on the project can still read the thread. Omit to notify everyone. */
  notify_contact_ids?: string[];
  /** Ids of files already uploaded to the project for this message. */
  attachment_file_ids?: string[];
}

export interface PostMessageRequest {
  visibility: MessageVisibility;
  text: string;
  /** Rejected for `internal` messages. Mentioned people are notified instead of everyone on the project. */
  mention_ids?: string[];
  /** Project members (user ids) mentioned. Only for `internal` comments; rejected on client-visible messages. */
  mention_user_ids?: string[];
  /** Ids of files already uploaded to the project for this message. */
  attachment_file_ids?: string[];
}

export interface PostMessageResult {
  message: ThreadMessage;
  /** Names of the client users who will be notified. Empty for internal comments. */
  notified: string[];
}

/** What a thread can be about, per project. Internal Only items and Draft approvals are excluded. */
export interface ThreadContextOptions {
  tasks: Array<{ id: string; label: string }>;
  files: Array<{ id: string; label: string }>;
  approvals: Array<{ id: string; label: string }>;
}

export interface ThreadOptions {
  context: ThreadContextOptions;
  mentions: MentionOption[];
  /** Active project members (staff), mentionable in internal comments. */
  members: MentionOption[];
}
