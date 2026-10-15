import type { PagedList, PagedParams, PortalSide } from './common';

export type ApprovalStatus = 'draft' | 'awaiting' | 'approved' | 'changes_requested' | 'cancelled';

export type ApprovalLinkType = 'file' | 'milestone' | 'task' | 'freeform';

export type ApprovalOutcome = 'approved' | 'changes_requested';

export interface ApprovalLinkedItem {
  type: ApprovalLinkType;
  /** Null for a free-form item: it has no record behind it. */
  id: string | null;
  name: string;
  /** Files only: the exact version the approval points at. It never changes when the file is replaced. */
  file_version: number | null;
  /** Tasks only. */
  task_key: string | null;
  /** Free-form only: the text the client sees. */
  description: string | null;
}

/** What a decision was recorded against: a file version, or an item name + revision. */
export interface ApprovalDecision {
  outcome: ApprovalOutcome;
  decided_by: string;
  decided_at: string;
  comment: string;
  /** "Homepage Wireframe.fig v3" or "Content migration plan, revision 1". */
  reference: string;
}

export interface ApprovalHistoryEntry {
  at: string;
  actor: string;
  side: PortalSide;
  text: string;
}

/** A free-form description as it stood at an earlier revision. */
export interface ApprovalEarlierRevision {
  revision: number;
  description: string;
}

export interface Approval {
  id: string;
  /** AP-000123. Unique and never reused, including for cancelled drafts. */
  ref_no: string;
  organization_id: string;
  organization_name: string;
  project_id: string;
  project_name: string;
  project_color?: string | null;
  title: string;
  linked_item: ApprovalLinkedItem;
  /** The primary (first named) approver. */
  approver_id: string;
  /** Every approver's name, joined. */
  approver_name: string;
  /** Everyone named as an approver; the first to decide settles the request. */
  approvers: Array<{ id: string; name: string }>;
  instructions: string;
  due_date: string | null;
  /** When the approval was created. */
  requested_at: string;
  status: ApprovalStatus;
  revision: number;
  created_by: string;
  decision: ApprovalDecision | null;
  /** Draft approvals are never visible to the client. */
  visible_to_client: boolean;
  /** Awaiting with a due date before today. */
  is_overdue: boolean;
  /** Files only: the file now has a newer version than the one recorded. */
  newer_file_version: number | null;
  history: ApprovalHistoryEntry[];
  earlier_revisions: ApprovalEarlierRevision[];
  discussion: { thread_id: string; message_count: number } | null;
}

export interface ApprovalStats {
  awaiting: number;
  overdue: number;
  approved: number;
  changes_requested: number;
  drafts: number;
}

export interface ApprovalsParams extends PagedParams {
  /** One or more statuses, comma-separated. */
  status?: string;
  /** One or more client ids, comma-separated. */
  organization_id?: string;
}

export type ApprovalsList = PagedList<Approval> & { stats: ApprovalStats };

/** Existing items an approval can link to. Only Client Visible ones are offered. */
export interface LinkableItems {
  files: Array<{ id: string; name: string; current_version: number }>;
  milestones: Array<{ id: string; name: string }>;
  tasks: Array<{ id: string; key: string; client_title: string }>;
  /** How many items are Internal Only and must be shared first. */
  internal_counts: { files: number; milestones: number; tasks: number };
}

export interface ApproverOption {
  id: string;
  name: string;
  email: string;
  /** admin, member or viewer. Any active client user can be named; naming them is the grant. */
  role: string;
}

/** Edits to a request the client has not reacted to. The project and linked item cannot change. */
export interface UpdateApprovalRequest {
  title?: string;
  approver_ids?: string[];
  instructions?: string;
  due_date?: string | null;
  /** Free-form items only. */
  freeform?: { name?: string; description?: string };
}

export interface CreateApprovalRequest {
  project_id: string;
  title: string;
  linked_item:
    | { type: 'file' | 'milestone' | 'task'; id: string }
    | { type: 'freeform'; name: string; description?: string };
  approver_ids: string[];
  instructions?: string;
  due_date?: string | null;
  /** Draft is invisible to the client; Awaiting notifies the approver. */
  send: boolean;
}

export interface ResubmitApprovalRequest {
  /** Required for a free-form item; the previous text is kept under "Earlier revisions". */
  description?: string;
}

export interface ApprovalOptions {
  linkable: LinkableItems;
  approvers: ApproverOption[];
}
