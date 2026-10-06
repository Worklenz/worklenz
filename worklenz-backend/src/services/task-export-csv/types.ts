/**
 * Shared types for project task / comment CSV export.
 * Pure data shapes — callers (controllers, workers) map DB rows into these.
 */

export type TaskExportColumnId =
  | "task_id"
  | "task_name"
  | "description"
  | "status"
  | "priority"
  | "phase"
  | "assignees"
  | "reporter"
  | "labels"
  | "start_date"
  | "due_date"
  | "completed_date"
  | "estimated_time"
  | "time_spent"
  | "progress"
  | "parent_task"
  | "is_subtask"
  | "created_at"
  | "updated_at";

export interface TaskExportColumnDef {
  id: TaskExportColumnId;
  header: string;
}

/** Project custom column definition used to inject dynamic CSV headers. */
export interface TaskExportCustomFieldDef {
  /** Stable storage key (cc_custom_columns.key) used to look up values. */
  key: string;
  /** Display name used as the CSV header (cc_custom_columns.name). */
  name: string;
  field_type?: string | null;
}

export interface TaskExportNamedRef {
  name?: string | null;
}

/**
 * Normalized task row for CSV generation.
 * Assignees/labels may be name strings or `{ name }` objects from SQL JSON.
 */
export interface TaskExportSource {
  task_key: string;
  name: string;
  description?: string | null;
  status_name?: string | null;
  priority_name?: string | null;
  phase_name?: string | null;
  assignees?: Array<TaskExportNamedRef | string> | null;
  reporter?: string | null;
  labels?: Array<TaskExportNamedRef | string> | null;
  start_date?: string | Date | null;
  end_date?: string | Date | null;
  completed_at?: string | Date | null;
  /** Estimated effort in minutes. */
  total_minutes?: number | string | null;
  /** Logged work in seconds (task_work_log sum). */
  time_spent_seconds?: number | string | null;
  progress?: number | string | null;
  parent_task_key?: string | null;
  is_sub_task?: boolean | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  /**
   * Values keyed by custom column `key` (not display name),
   * matching TasksControllerV2 `custom_column_values`.
   */
  custom_column_values?: Record<string, unknown> | null;
}

export type TaskCommentsExportColumnId =
  | "task_id"
  | "task_name"
  | "comment_author"
  | "comment_text"
  | "created_at"
  | "edited_at"
  | "attachments";

export interface TaskCommentsExportColumnDef {
  id: TaskCommentsExportColumnId;
  header: string;
}

export interface CommentExportSource {
  task_key: string;
  task_name: string;
  author_name?: string | null;
  content?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  /** When false/undefined, Edited At is left blank. */
  is_edited?: boolean | null;
  /**
   * Mentioned members in placeholder order (`{0}`, `{1}`, …).
   * Stored separately in `task_comment_mentions`; resolve before CSV output.
   */
  mentions?: Array<{ user_name?: string | null } | string> | null;
  /** Filenames of files uploaded on this comment (images, docs, etc.). */
  attachment_names?: string[] | null;
}
