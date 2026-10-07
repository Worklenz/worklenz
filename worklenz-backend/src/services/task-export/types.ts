/** Task export job + request types (Phase 2). */

export type TaskExportJobStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "expired";

/** UI-facing status labels from the product spec. */
export type TaskExportUiStatus = "Processing" | "Ready" | "Failed" | "Expired";

export type TaskExportScope = "project" | "filtered";

export type TaskExportAuditAction =
  | "created"
  | "started"
  | "completed"
  | "failed"
  | "downloaded"
  | "expired"
  | "deleted"
  | "sync_exported";

/**
 * Persisted async-job options (TE-32).
 * Selection/scope only — custom-field values, comments, and files are loaded
 * at generation time in buildExportArtifact, not stored here at queue time.
 */
export interface TaskExportOptions {
  include_tasks: boolean;
  include_comments: boolean;
  include_files: boolean;
  scope: TaskExportScope;
  /** When set, only these task UUIDs are exported (filtered List/Board). */
  task_ids?: string[] | null;
}

export interface TaskExportJob {
  id: string;
  team_id: string;
  project_id: string;
  created_by: string;
  status: TaskExportJobStatus;
  options: TaskExportOptions;
  stats: Record<string, unknown>;
  storage_key: string | null;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  error_message: string | null;
  expires_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface CreateTaskExportJobInput {
  teamId: string;
  projectId: string;
  createdBy: string;
  options: TaskExportOptions;
}

export interface TaskExportAttachmentRow {
  id: string;
  name: string;
  type: string;
  size: number;
  task_id: string;
  task_key: string;
  team_id: string;
  project_id: string;
  /**
   * `task` = task_attachments (getKey).
   * `comment` = task_comment_attachments (getTaskAttachmentKey).
   */
  source?: "task" | "comment";
  /** Required when source is `comment` for S3 key resolution. */
  comment_id?: string | null;
}

export const TASK_EXPORT_RETENTION_DAYS = 7;
export const TASK_EXPORT_MAX_BUNDLE_BYTES = 250 * 1024 * 1024; // 250 MB
export const TASK_EXPORT_MAX_BUNDLE_ERROR =
  "This export exceeds 250MB — exclude Files or contact support if you need a larger export.";

export const mapJobStatusToUi = (status: TaskExportJobStatus): TaskExportUiStatus => {
  switch (status) {
    case "queued":
    case "processing":
      return "Processing";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    case "expired":
      return "Expired";
    default:
      return "Failed";
  }
};
