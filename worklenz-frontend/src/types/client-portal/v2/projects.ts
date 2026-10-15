import type { ClientRole, ClientUserStatus } from './access';
import type { PagedList, PagedParams, PortalVisibility, StaffRef } from './common';

// ─── Portal Projects ────────────────────────────────────────────────────────

/** Client-facing project status, separate from the internal WorkLenz status. */
export type ClientProjectStatus = 'on_track' | 'at_risk' | 'on_hold' | 'completed';

export const PROJECT_PHASES = ['Discovery', 'Design', 'Development', 'UAT', 'Deployment'] as const;
export type ProjectPhase = (typeof PROJECT_PHASES)[number];

/** `worklenz` follows task completion (read-only); `manual` is a 0-100 value staff set. */
export type ProgressSource = 'worklenz' | 'manual';

/** `worklenz` shows the WorkLenz project's phases as milestones (read-only); `manual` shows the ones staff add. */
export type MilestoneSource = 'worklenz' | 'manual';

export interface PortalProject {
  id: string;
  name: string;
  color: string;
  /** Null for a workspace project that has no client yet. */
  organization_id: string | null;
  organization_name: string | null;
  portal_enabled: boolean;
  status: ClientProjectStatus;
  phase: ProjectPhase | null;
  progress: number;
  next_milestone: { name: string; target_date: string } | null;
  active_client_users: number;
}

export interface PortalProjectStats {
  portal_enabled: number;
  total: number;
  awaiting_client_approval: number;
  open_change_requests: number;
  delayed_milestones: number;
}

export interface PortalProjectsParams extends PagedParams {
  /** A client id, or `none` for workspace projects that have no client yet. Several can be joined with commas. */
  organization_id?: string;
  portal?: 'on' | 'off';
  /** Only projects that belong to a client. */
  has_client?: boolean;
  /** One client-facing status, or several joined with commas. */
  status?: ClientProjectStatus | string;
  /** One phase, or several joined with commas. */
  phase?: ProjectPhase | string;
}

export type PortalProjectsList = PagedList<PortalProject> & { stats: PortalProjectStats };

export interface ProjectUpdate {
  id: string;
  project_id: string;
  author: StaffRef;
  body: string;
  published_at: string;
}

export interface ProjectOverview {
  project_id: string;
  status: ClientProjectStatus;
  phase: ProjectPhase | null;
  progress_source: ProgressSource;
  milestone_source: MilestoneSource;
  /** The computed WorkLenz progress, shown read-only when `progress_source` is `worklenz`. */
  worklenz_progress: number;
  manual_progress: number | null;
  start_date: string | null;
  expected_completion: string | null;
  /** The WorkLenz project's own dates, read-only while progress follows WorkLenz. */
  worklenz_start_date: string | null;
  worklenz_end_date: string | null;
  primary_contact_id: string | null;
  client_summary: string;
  allow_client_uploads: boolean;
  /** Never part of any client-facing payload. */
  internal_notes: string;
  updates: ProjectUpdate[];
}

export type UpdateProjectOverviewRequest = Partial<
  Pick<
    ProjectOverview,
    | 'status'
    | 'phase'
    | 'progress_source'
    | 'milestone_source'
    | 'manual_progress'
    | 'start_date'
    | 'expected_completion'
    | 'primary_contact_id'
    | 'client_summary'
    | 'allow_client_uploads'
    | 'internal_notes'
  >
>;

export interface SetPortalResult {
  portal_enabled: boolean;
  /** How many Active client users lose access when the portal is switched off. */
  affected_users: number;
  changed: boolean;
}

export interface ProjectAccessUser {
  id: string;
  name: string;
  email: string;
  role: ClientRole;
  status: ClientUserStatus;
  last_access_at: string | null;
}

export interface ProjectAccess {
  project_id: string;
  organization_id: string | null;
  assigned: ProjectAccessUser[];
  /** Organization users who are not assigned yet and are not Deactivated. */
  assignable: ProjectAccessUser[];
}

// ─── Milestones ─────────────────────────────────────────────────────────────

export type MilestoneStatus = 'upcoming' | 'in_progress' | 'completed' | 'delayed';

export interface MilestoneLinkedWork {
  task_ids: string[];
  file_ids: string[];
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description: string;
  target_date: string;
  completed_at: string | null;
  status: MilestoneStatus;
  visibility: PortalVisibility;
  completion_note: string;
  /** Never shown to the client, not even for a Delayed milestone. */
  internal_note: string;
  linked: MilestoneLinkedWork;
  /** Staff-only: how many linked items the client can actually see. */
  linked_visible_count: number;
  linked_total_count: number;
  /** True for a WorkLenz phase shown as a milestone: it cannot be edited, shared or deleted here. */
  read_only?: boolean;
}

export interface SaveMilestoneRequest {
  name: string;
  description?: string;
  target_date: string;
  status?: MilestoneStatus;
  visibility?: PortalVisibility;
  internal_note?: string;
  linked?: MilestoneLinkedWork;
}

export interface CompleteMilestoneRequest {
  completion_note?: string;
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

/** What the portal shows for an internal task status. */
export type ClientTaskStatus = 'not_started' | 'in_progress' | 'done';

export interface PortalTask {
  id: string;
  /** Task key such as WL-231. */
  key: string;
  project_id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  due_date: string | null;
  assignee: StaffRef | null;
  visibility: PortalVisibility;
  /** Optional wording the client sees instead of the internal title/description. */
  client_title: string;
  client_description: string;
  attached_file_ids: string[];
  /** Staff-only counts shown in the "Never shared" list. */
  never_shared: {
    estimate_hours: number | null;
    logged_hours: number | null;
    internal_comments: number;
  };
}

export interface PortalTasksParams extends PagedParams {
  visibility?: PortalVisibility;
}

export type PortalTasksList = PagedList<PortalTask> & {
  counts: { all: number; client: number; internal: number };
};

export interface UpdatePortalTaskRequest {
  visibility?: PortalVisibility;
  client_title?: string;
  client_description?: string;
  attached_file_ids?: string[];
}

// ─── Files ──────────────────────────────────────────────────────────────────

export const FILE_CATEGORIES = [
  'Proposal',
  'Requirements',
  'Agreement',
  'Design',
  'Report',
  'Deliverable',
  'Supporting Document',
  'Other',
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export interface FileVersion {
  version: number;
  uploaded_at: string;
  uploaded_by: string;
  /** The approval that covers this version, when one does. */
  approval_ref_no: string | null;
  is_current: boolean;
}

export interface PortalFile {
  id: string;
  project_id: string;
  name: string;
  category: FileCategory;
  visibility: PortalVisibility;
  /** Where the file came from; client uploads are always visible to staff. */
  source: 'team' | 'client';
  uploaded_by: string;
  uploaded_at: string;
  size_label: string;
  current_version: number;
  version_count: number;
}

export interface PortalFilesParams extends PagedParams {
  category?: FileCategory;
}

export interface UploadPortalFileRequest {
  name: string;
  category: FileCategory;
  visibility: PortalVisibility;
}

export interface PresignFileRequest {
  filename: string;
  size: number;
  mime_type: string;
  category?: FileCategory;
  visibility?: PortalVisibility;
}

export interface PresignFileResult {
  file_id: string;
  upload_url: string;
  expires_in: number;
}

export interface PresignVersionResult {
  version_id: string;
  version: number;
  upload_url: string;
  expires_in: number;
}

export interface FileDownloadResult {
  url: string;
  expires_in: number;
}
