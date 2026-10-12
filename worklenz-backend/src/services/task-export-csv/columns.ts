import {
  TaskCommentsExportColumnDef,
  TaskExportColumnDef,
} from "./types";

/**
 * Single source of truth for Tasks CSV standard columns (TE-10).
 * Order matches the Task Export product spec.
 */
export const TASK_EXPORT_STANDARD_COLUMNS: readonly TaskExportColumnDef[] = [
  { id: "task_id", header: "Task ID" },
  { id: "task_name", header: "Task Name" },
  { id: "description", header: "Description" },
  { id: "status", header: "Status" },
  { id: "priority", header: "Priority" },
  { id: "phase", header: "Phase" },
  { id: "assignees", header: "Assignee(s)" },
  { id: "reporter", header: "Reporter" },
  { id: "labels", header: "Labels" },
  { id: "start_date", header: "Start Date" },
  { id: "due_date", header: "Due Date" },
  { id: "completed_date", header: "Completed Date" },
  { id: "estimated_time", header: "Estimated Time" },
  { id: "time_spent", header: "Time Spent" },
  { id: "progress", header: "Progress %" },
  { id: "parent_task", header: "Parent Task" },
  { id: "is_subtask", header: "Is Subtask" },
  { id: "created_at", header: "Created At" },
  { id: "updated_at", header: "Updated At" },
] as const;

/**
 * Single source of truth for Task Comments CSV columns (TE-13).
 */
export const TASK_COMMENTS_EXPORT_COLUMNS: readonly TaskCommentsExportColumnDef[] = [
  { id: "task_id", header: "Task ID" },
  { id: "task_name", header: "Task Name" },
  { id: "comment_author", header: "Comment Author" },
  { id: "comment_text", header: "Comment Text" },
  { id: "created_at", header: "Created At" },
  { id: "edited_at", header: "Edited At" },
  { id: "attachments", header: "Attachments" },
] as const;

export const getStandardTaskExportHeaders = (): string[] =>
  TASK_EXPORT_STANDARD_COLUMNS.map((column) => column.header);

export const getTaskCommentsExportHeaders = (): string[] =>
  TASK_COMMENTS_EXPORT_COLUMNS.map((column) => column.header);
