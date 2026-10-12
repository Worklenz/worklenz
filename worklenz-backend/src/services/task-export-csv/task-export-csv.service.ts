import { encodeCsv } from "../../shared/csv-utils";
import {
  getTaskCommentsExportHeaders,
  TASK_EXPORT_STANDARD_COLUMNS,
} from "./columns";
import { buildTaskExportHeaders } from "./custom-fields";
import {
  formatCommentAttachmentNames,
  formatCustomFieldValue,
  formatExportDate,
  formatExportDateTime,
  formatMinutesAsDuration,
  formatNamedList,
  formatProgressPercent,
  formatSecondsAsDuration,
  formatYesNo,
  resolveCommentMentionPlaceholders,
  stripHtmlToPlainText,
} from "./formatters";
import {
  CommentExportSource,
  TaskExportColumnId,
  TaskExportCustomFieldDef,
  TaskExportSource,
} from "./types";

const getStandardCellValue = (
  columnId: TaskExportColumnId,
  task: TaskExportSource
): string => {
  switch (columnId) {
    case "task_id":
      return task.task_key || "";
    case "task_name":
      return task.name || "";
    case "description":
      return stripHtmlToPlainText(task.description);
    case "status":
      return task.status_name || "";
    case "priority":
      return task.priority_name || "";
    case "phase":
      return task.phase_name || "";
    case "assignees":
      return formatNamedList(task.assignees);
    case "reporter":
      return task.reporter || "";
    case "labels":
      return formatNamedList(task.labels);
    case "start_date":
      return formatExportDate(task.start_date);
    case "due_date":
      return formatExportDate(task.end_date);
    case "completed_date":
      return formatExportDate(task.completed_at);
    case "estimated_time":
      return formatMinutesAsDuration(task.total_minutes);
    case "time_spent":
      return formatSecondsAsDuration(task.time_spent_seconds);
    case "progress":
      return formatProgressPercent(task.progress);
    case "parent_task":
      return task.parent_task_key || "";
    case "is_subtask":
      return formatYesNo(Boolean(task.is_sub_task));
    case "created_at":
      return formatExportDateTime(task.created_at);
    case "updated_at":
      return formatExportDateTime(task.updated_at);
    default:
      return "";
  }
};

/**
 * Maps one task into a CSV cell array (standard columns + custom fields in header order).
 */
export const mapTaskToExportRow = (
  task: TaskExportSource,
  customFields: TaskExportCustomFieldDef[] = []
): string[] => {
  const standardCells = TASK_EXPORT_STANDARD_COLUMNS.map((column) =>
    getStandardCellValue(column.id, task)
  );

  const values = task.custom_column_values || {};
  const customCells = customFields.map((field) =>
    formatCustomFieldValue(values[field.key])
  );

  return [...standardCells, ...customCells];
};

/**
 * TE-10 / TE-11 / TE-12: Tasks CSV (UTF-8 BOM, escaped).
 */
export const generateTasksCsv = (
  tasks: TaskExportSource[],
  customFields: TaskExportCustomFieldDef[] = []
): string => {
  const headers = buildTaskExportHeaders(customFields);
  const rows = tasks.map((task) => mapTaskToExportRow(task, customFields));
  return encodeCsv(headers, rows);
};

/**
 * Maps one comment into a CSV cell array joined to its task via Task ID (task key).
 */
export const mapCommentToExportRow = (comment: CommentExportSource): string[] => {
  const editedAt =
    comment.is_edited === true
      ? formatExportDateTime(comment.updated_at)
      : "";

  return [
    comment.task_key || "",
    comment.task_name || "",
    comment.author_name || "",
    stripHtmlToPlainText(
      resolveCommentMentionPlaceholders(comment.content, comment.mentions)
    ),
    formatExportDateTime(comment.created_at),
    editedAt,
    formatCommentAttachmentNames(comment.attachment_names),
  ];
};

/**
 * TE-13 / TE-30: Task Comments CSV — one row per comment; Task ID matches Tasks CSV.
 * Tasks with zero comments are omitted entirely (no blank placeholder rows).
 */
export const generateCommentsCsv = (comments: CommentExportSource[]): string => {
  const headers = getTaskCommentsExportHeaders();
  const rows = comments.map(mapCommentToExportRow);
  return encodeCsv(headers, rows);
};
