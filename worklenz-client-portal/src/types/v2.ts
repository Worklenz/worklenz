// Client Portal v2 types.
// Shapes of the /api/client-portal/v2 responses (camelCase client API).

export type ClientRole = 'admin' | 'member' | 'viewer';

export type ProjectStatus = 'on_track' | 'at_risk' | 'on_hold' | 'completed';
export type MilestoneStatus = 'upcoming' | 'in_progress' | 'completed' | 'delayed';
export type TaskStatus = 'not_started' | 'in_progress' | 'done';
export type ApprovalStatus = 'awaiting' | 'approved' | 'changes_requested' | 'cancelled';
export type ChangeRequestStatus =
  | 'submitted'
  | 'under_review'
  | 'more_info'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type ChangeRequestPriority = 'low' | 'medium' | 'high';
export type ThreadContextType = 'project' | 'task' | 'file' | 'approval' | 'change_request';
export type NotificationType =
  | 'Approval'
  | 'Comment'
  | 'File'
  | 'Milestone'
  | 'Project'
  | 'Change Request'
  | 'Access';

/** What the signed-in client may do. Mirrors worklenz-backend `client-portal-permissions.ts`. */
export interface ClientCapabilities {
  comment: boolean;
  upload: boolean;
  submitChangeRequest: boolean;
  approve: boolean;
  manageUsers: boolean;
}

/** planned: GET /v2/me */
export interface ClientMe {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: ClientRole;
  organizationName: string;
  operatorName: string;
  language: string;
  /** IANA/Worklenz timezone id; null means "use the browser's". */
  timezone: string | null;
  capabilities: ClientCapabilities;
  /** Operator switches (Portal Settings). */
  invoicesVisible: boolean;
  adminsCanInvite: boolean;
  adminsCanRemove: boolean;
  /** Event types the operator turned email on for. */
  emailedEventTypes: NotificationType[];
}

export interface ClientProjectV2 {
  id: string;
  name: string;
  status: ProjectStatus;
  phase: string | null;
  progress: number;
  start_date: string | null;
  expected_completion: string | null;
  primary_contact: string | null;
  summary: string;
  latest_update: { body: string; published_at: string } | null;
  shared_counts: { milestones: number; tasks: number; files: number };
  allow_uploads: boolean;
  /** planned: open approvals / change requests for this user, for the project list. */
  open_approvals?: number;
  open_change_requests?: number;
  /** planned */
  contact_email?: string | null;
  contact_title?: string | null;
  color?: string | null;
}

/** GET /v2/projects?page=&size=&search=&sort=&order=&status=&phase= */
export interface ClientProjectsPageV2 {
  data: ClientProjectV2[];
  total: number;
  /** Every phase across the person's projects, for the Phase filter. */
  phases: string[];
}

export interface ClientProjectMemberV2 {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: ClientRole;
  isYou: boolean;
  /** Client Admins open every project, so they can't be removed from one. */
  locked: boolean;
}

/** GET /v2/projects/:id/members. `candidates` is empty unless the caller has Manage users. */
export interface ClientProjectMembersV2 {
  members: ClientProjectMemberV2[];
  candidates: ClientProjectMemberV2[];
}

export interface ClientProjectsQuery {
  page: number;
  size: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: string[];
  phase?: string[];
}

export interface ClientMilestoneV2 {
  id: string;
  name: string;
  description: string;
  target_date: string;
  status: MilestoneStatus;
  completed_at: string | null;
  completion_note: string;
  date_moved: boolean;
  linked_tasks: Array<{ id: string; title: string }>;
  linked_files: Array<{ id: string; name: string }>;
}

export interface ClientTaskV2 {
  id: string;
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  due_date: string | null;
  attachments: Array<{ id: string; name: string; version: number }>;
}

export interface ClientFileV2 {
  id: string;
  name: string;
  category: string;
  version: number;
  size_label: string;
  uploaded_at: string;
  source: 'team' | 'client';
  /** planned */
  uploaded_by?: string;
  version_count?: number;
}

export type ApprovalLinkType = 'file' | 'milestone' | 'task' | 'freeform';

export interface ClientApprovalV2 {
  id: string;
  ref_no: string;
  project_id: string;
  project_name: string;
  title: string;
  status: ApprovalStatus;
  revision: number;
  linked_item: {
    type: ApprovalLinkType;
    name: string;
    task_key: string | null;
    file_version: number | null;
    description: string | null;
    available: boolean;
    /** planned: id of the linked file/milestone/task for the "Open …" button. */
    id?: string | null;
    /** planned: the file's current version, to show the "file moved on" banner. */
    current_file_version?: number | null;
  };
  instructions: string;
  due_date: string | null;
  is_overdue: boolean;
  can_decide: boolean;
  decision: { outcome: string; decided_by: string; decided_at: string; comment: string } | null;
  /** planned */
  approver_name?: string;
  requested_by?: string;
  requested_at?: string;
  updated_at?: string;
}

/** planned: GET /v2/approvals/:id */
export interface ClientApprovalDetailV2 extends ClientApprovalV2 {
  history: Array<{ at: string; actor: string; text: string }>;
  earlier_revisions: Array<{ revision: number; description: string }>;
}

export interface ClientChangeRequestV2 {
  id: string;
  cr_no: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  notes: string;
  attachments: string[];
  priority: ChangeRequestPriority;
  status: ChangeRequestStatus;
  submitted_at: string;
  requester_name: string;
  estimate: { hours: number | null; cost: number | null } | null;
  response: string;
  needs_your_reply: boolean;
  updated_at?: string;
  closed_at?: string | null;
}

/** planned: GET /v2/change-requests/:id */
export interface ClientChangeRequestDetailV2 extends ClientChangeRequestV2 {
  attachment_files: Array<{ id: string; name: string }>;
  thread: Array<{ from: 'client' | 'team'; author: string; text: string; at: string }>;
  timeline: Array<{ at: string; text: string }>;
  can_cancel: boolean;
}

export type MessageVisibilityV2 = 'client' | 'client_only';

export interface ClientThreadAttachmentV2 {
  id: string;
  /** The project file to download. Null once the file is no longer shared with the client. */
  file_id: string | null;
  name: string;
  /** File extension without the dot, lower case. */
  type: string;
  size: number;
}

export interface ClientThreadMessageV2 {
  id: string;
  author: string;
  side: 'client' | 'internal';
  /** True for the signed-in person's own messages. */
  mine?: boolean;
  /** `client_only` is read by the project's client users and never by the team. */
  visibility?: MessageVisibilityV2;
  /** Sanitized rich text (HTML), or plain text from before rich text existed. */
  text: string;
  at: string;
  mentions: string[];
  attachments?: ClientThreadAttachmentV2[];
  /** True once the sender changed the text after sending. */
  edited?: boolean;
  /** A deleted message is a tombstone: no text and no attachments, so replies keep their quote. */
  deleted?: boolean;
  /** The message this one replies to. */
  reply_to?: ClientThreadReplyToV2 | null;
}

export interface ClientThreadReplyToV2 {
  id: string;
  author: string;
  /** Plain-text excerpt; empty once the parent was deleted. */
  snippet: string;
  deleted: boolean;
}

export interface MentionOptionV2 {
  id: string;
  name: string;
}

export interface ClientThreadV2 {
  id: string;
  /** Short reference to copy and search by, e.g. DS-000123. */
  ref_no?: string;
  project_id: string;
  project_name: string;
  context: { type: ThreadContextType; label: string; ref_id?: string | null };
  messages: ClientThreadMessageV2[];
  /** planned: per-user read state. */
  unread?: boolean;
}

export interface ClientDashboardV2 {
  active_projects: number;
  pending_actions: number;
  upcoming_milestones: Array<{
    id: string;
    name: string;
    project_id: string;
    project_name: string;
    target_date: string;
    status: MilestoneStatus;
  }>;
  needs_action: Array<{
    kind: 'approval' | 'change_request';
    id: string;
    ref_no: string;
    title: string;
    project_name: string;
    due_date: string | null;
  }>;
  projects: ClientProjectV2[];
  /** planned */
  waiting_on_others?: Array<{ id: string; ref_no: string; title: string; waiting_for: string }>;
  /** planned */
  recent_activity?: ClientActivityV2[];
  /** planned: only present when the operator turned Invoices on. */
  unpaid_amount?: number;
}

/** planned */
export interface ClientActivityV2 {
  id: string;
  kind: 'approval' | 'file' | 'project' | 'milestone' | 'comment' | 'change_request';
  text: string;
  at: string;
  target: ClientTarget;
}

/** A deep link target. Each destination re-checks access when it opens. */
export type ClientTarget =
  | { page: 'approval'; id: string }
  | { page: 'change_request'; id: string }
  | { page: 'project'; projectId: string }
  | { page: 'milestone'; projectId: string; id: string }
  | { page: 'task'; projectId: string; id: string }
  | { page: 'file'; projectId: string; id: string }
  | { page: 'thread'; projectId: string; id: string };

/** planned: GET /v2/notifications */
export interface ClientNotificationV2 {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  at: string;
  unread: boolean;
  emailed: boolean;
  target: ClientTarget;
}

/** planned: GET /v2/notifications */
export interface ClientNotificationsResponse {
  items: ClientNotificationV2[];
  unread_count: number;
}

/** planned: GET /v2/organization/users */
export interface ClientOrgUserV2 {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: ClientRole;
  /** `Deleted`: the person deleted their own account. They cannot sign in; staff keep the profile for 30 days. */
  status: 'Active' | 'Invited' | 'Deactivated' | 'Deleted';
  isYou: boolean;
}

/** GET /v2/organization/users/:id/projects: the projects a Member or Viewer can be assigned to. */
export interface ClientOrgUserProjectsV2 {
  role: ClientRole;
  projects: Array<{ id: string; name: string; assigned: boolean }>;
}

/** planned: GET /v2/timezones (same shape as the main app's timezone list) */
export interface ClientTimezoneV2 {
  id: string;
  name: string;
  abbrev: string;
}

export type NotificationPrefs = Record<NotificationType, boolean>;

/** Widgets a client can place on their dashboard. One instance per type. */
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

export type ProjectCardField = 'status' | 'progress' | 'phase' | 'nextMilestone' | 'expectedCompletion' | 'openItems' | 'sharedCounts';

/** Settings of the "Your projects" widget. `projectIds: 'all'` follows newly shared projects. */
export interface ProjectsWidgetSettings {
  projectIds: string[] | 'all';
  cardFields: ProjectCardField[];
  view: 'cards' | 'compact';
}

export interface DashboardWidgetInstance {
  type: DashboardWidgetType;
  /** 12-column grid position and size. */
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
  settings?: ProjectsWidgetSettings;
}

/** GET/PUT /v2/me/dashboard-layout. `widgets` is null until the user saves a customisation. */
export interface DashboardLayoutV2 {
  version: 1;
  widgets: DashboardWidgetInstance[];
}

export interface DashboardLayoutResponse {
  layout: DashboardLayoutV2 | null;
}
