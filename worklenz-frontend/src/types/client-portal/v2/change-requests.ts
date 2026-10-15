import type { PagedList, PagedParams, PortalSide, StaffRef } from './common';

export type ChangeRequestStatus =
  | 'submitted'
  | 'under_review'
  | 'more_info'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/** Set by the client. Staff cannot change it. */
export type ChangeRequestPriority = 'low' | 'medium' | 'high';

/** Statuses a quote or invoice can be started from. */
export const CHANGE_REQUEST_BILLABLE_STATUSES: readonly ChangeRequestStatus[] = [
  'approved',
  'in_progress',
  'completed',
];

/** Terminal states are read-only except for linking billing documents. */
export const CHANGE_REQUEST_TERMINAL_STATUSES: readonly ChangeRequestStatus[] = [
  'completed',
  'rejected',
  'cancelled',
];

/** Both fields are nullable: a blank stays blank and the client never sees 0 unless staff enter 0. */
export interface ChangeRequestEstimate {
  hours: number | null;
  cost: number | null;
}

export interface ChangeRequestMessage {
  id: string;
  from: 'client' | 'team';
  author: string;
  text: string;
  at: string;
}

export interface ChangeRequestHistoryEntry {
  at: string;
  actor: string;
  side: PortalSide;
  text: string;
}

export interface ChangeRequestLinkedWork {
  task_id: string;
  task_key: string;
  mode: 'created' | 'linked';
}

/** A file the client attached. `file_id` is null once the project file behind it was removed. */
export interface ChangeRequestAttachment {
  id: string;
  file_id: string | null;
  name: string;
  size: number;
}

export interface ChangeRequest {
  id: string;
  /** CR-0048. Unique and never reused. */
  cr_no: string;
  organization_id: string;
  organization_name: string;
  project_id: string;
  project_name: string;
  project_color?: string | null;
  title: string;
  description: string;
  notes: string;
  attachments: ChangeRequestAttachment[];
  priority: ChangeRequestPriority;
  requester_id: string;
  requester_name: string;
  submitted_at: string;
  updated_at: string;
  status: ChangeRequestStatus;
  /** Never shown to the client. */
  assignee: StaffRef | null;
  estimate: ChangeRequestEstimate | null;
  /** Latest client-visible response. */
  response: string;
  /** Private text field. Never part of any client payload. */
  internal_assessment: string;
  linked_work: ChangeRequestLinkedWork | null;
  messages: ChangeRequestMessage[];
  history: ChangeRequestHistoryEntry[];
  /** Quotes and invoices already created from this request. */
  billing: { quotes: string[]; invoices: string[] };
}

export interface ChangeRequestStats {
  needs_review: number;
  waiting_on_client: number;
  approved_or_in_progress: number;
  completed: number;
}

export interface ChangeRequestsParams extends PagedParams {
  /** Comma-separated lists, so the admin UI can select several values at once. */
  status?: string;
  organization_id?: string;
  priority?: string;
}

export type ChangeRequestsList = PagedList<ChangeRequest> & { stats: ChangeRequestStats };

/** Explicit status actions. Status never changes through an inline dropdown. */
export type ChangeRequestAction =
  | { action: 'start_review' }
  | { action: 'approve'; response?: string; estimate?: ChangeRequestEstimate }
  | { action: 'ask_more_info'; response: string }
  | { action: 'reject'; response: string }
  | { action: 'return_to_review' }
  | { action: 'complete'; response?: string }
  | { action: 'cancel' }
  | { action: 'send_response'; response: string };

export type ConvertToWorkRequest =
  | { mode: 'create'; title: string; assignee_id: string | null; visibility: 'internal' | 'client' }
  | { mode: 'link'; task_id: string };

export interface UpdateChangeRequestRequest {
  assignee_id?: string | null;
  estimate?: ChangeRequestEstimate | null;
  internal_assessment?: string;
}

export interface BillableChangeRequest {
  id: string;
  cr_no: string;
  title: string;
  organization_id: string;
  status: ChangeRequestStatus;
  existing_invoice_count: number;
}

/** A project task that is not yet linked to a change request, for "Link an existing task". */
export interface LinkableTask {
  id: string;
  key: string;
  title: string;
}
