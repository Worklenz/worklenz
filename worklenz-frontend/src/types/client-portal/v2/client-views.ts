import type { ClientRole, ClientRoleDefinition } from './access';
import type { ThreadContextType } from './discussions';

/**
 * What a client user sees. These are the allow-listed payloads the backend's client read layer
 * returns, used by the staff-side "Preview as client" (which calls the same functions with the
 * previewed user as subject) and by the client API. None of them carries time, cost, assignee,
 * internal notes or any hidden item.
 */

export interface ClientProjectView {
  id: string;
  name: string;
  status: 'on_track' | 'at_risk' | 'on_hold' | 'completed';
  phase: string | null;
  progress: number;
  start_date: string | null;
  /** Null renders as "Not set": the portal never invents a date. */
  expected_completion: string | null;
  primary_contact: string | null;
  summary: string;
  latest_update: { body: string; published_at: string } | null;
  shared_counts: { milestones: number; tasks: number; files: number };
  allow_uploads: boolean;
  open_approvals: number;
  open_change_requests: number;
  contact_email: string | null;
  /** The project's colour, for its progress bar and avatar. */
  color: string | null;
}

export interface ClientMilestoneView {
  id: string;
  name: string;
  description: string;
  target_date: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'delayed';
  completed_at: string | null;
  completion_note: string;
  /** A Delayed milestone shows the moved date and a neutral line, never the internal reason. */
  date_moved: boolean;
  linked_tasks: Array<{ id: string; title: string }>;
  linked_files: Array<{ id: string; name: string }>;
}

export interface ClientTaskView {
  id: string;
  key: string;
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'done';
  due_date: string | null;
  attachments: Array<{ id: string; name: string; version: number }>;
}

export interface ClientFileView {
  id: string;
  name: string;
  category: string;
  version: number;
  size_label: string;
  uploaded_at: string;
  source: 'team' | 'client';
}

export interface ClientApprovalView {
  id: string;
  ref_no: string;
  project_id: string;
  project_name: string;
  title: string;
  status: 'awaiting' | 'approved' | 'changes_requested' | 'cancelled';
  revision: number;
  linked_item: {
    type: 'file' | 'milestone' | 'task' | 'freeform';
    name: string;
    task_key: string | null;
    file_version: number | null;
    description: string | null;
    /** False once the linked item was made Internal Only: shown as "No longer shared". */
    available: boolean;
  };
  instructions: string;
  due_date: string | null;
  is_overdue: boolean;
  /** Only the named approver, while Awaiting. Everyone else sees "View only for you". */
  can_decide: boolean;
  approver_name: string;
  requested_by: string;
  requested_at: string;
  updated_at: string;
  decision: { outcome: string; decided_by: string; decided_at: string; comment: string } | null;
}

export interface ClientChangeRequestView {
  id: string;
  cr_no: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  notes: string;
  attachments: string[];
  priority: 'low' | 'medium' | 'high';
  status: string;
  submitted_at: string;
  requester_name: string;
  updated_at: string;
  closed_at: string | null;
  /** Null when staff set none: shown as "No estimate shown". */
  estimate: { hours: number | null; cost: number | null } | null;
  response: string;
  needs_your_reply: boolean;
}

export interface ClientDashboardView {
  active_projects: number;
  pending_actions: number;
  upcoming_milestones: Array<{
    id: string;
    name: string;
    project_id: string;
    project_name: string;
    target_date: string;
    status: string;
  }>;
  needs_action: Array<{
    kind: 'approval' | 'change_request';
    id: string;
    ref_no: string;
    title: string;
    project_name: string;
    due_date: string | null;
  }>;
  projects: ClientProjectView[];
  waiting_on_others: Array<{ id: string; ref_no: string; title: string; waiting_for: string }>;
  recent_activity: Array<{ id: string; kind: string; text: string; at: string }>;
  unpaid_amount?: number;
}

export interface ClientThreadView {
  id: string;
  ref_no: string;
  project_id: string;
  project_name: string;
  context: { type: ThreadContextType; label: string; ref_id: string | null };
  unread: boolean;
  messages: Array<{
    id: string;
    author: string;
    side: 'client' | 'internal';
    mine: boolean;
    visibility: 'client' | 'client_only';
    text: string;
    at: string;
    attachments: Array<{ id: string; name: string }>;
    edited: boolean;
    deleted: boolean;
    reply_to: { id: string; author: string; snippet: string; deleted: boolean } | null;
  }>;
}

export type DashboardWidgetType =
  | 'tile-active-projects'
  | 'tile-pending-actions'
  | 'tile-upcoming-milestones'
  | 'tile-unpaid'
  | 'needs-action'
  | 'upcoming-milestones'
  | 'projects'
  | 'recent-activity'
  | 'chart-projects-by-status'
  | 'chart-project-progress'
  | 'chart-open-items';

export interface DashboardWidgetInstance {
  type: DashboardWidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
  settings?: {
    projectIds: string[] | 'all';
    cardFields: string[];
    view: 'cards' | 'compact';
  };
}

export interface DashboardLayoutView {
  version: number;
  widgets: DashboardWidgetInstance[];
}

/** Staff only. Never part of any client-visible surface. */
export interface HiddenSummary {
  milestones: number;
  tasks: number;
  files: number;
  draft_approvals: number;
}

export interface PreviewUser {
  id: string;
  name: string;
  email: string;
  organization_id: string;
  organization_name: string;
  role: ClientRole;
}

export interface PreviewResponse {
  user: { id: string; name: string; email: string; role: ClientRole };
  role: ClientRoleDefinition | null;
  /** "Manage organization users" reads "currently off in Settings" while this is false. */
  manage_users_enabled: boolean;
  dashboard: ClientDashboardView;
  projects: ClientProjectView[];
  approvals: ClientApprovalView[];
  change_requests: ClientChangeRequestView[];
  threads: ClientThreadView[];
  /** The user's own saved arrangement; null when they never customised it. */
  dashboard_layout: DashboardLayoutView | null;
  hidden: HiddenSummary;
}

export interface PreviewProjectResponse {
  project: ClientProjectView;
  milestones: ClientMilestoneView[];
  tasks: ClientTaskView[];
  files: ClientFileView[];
}
