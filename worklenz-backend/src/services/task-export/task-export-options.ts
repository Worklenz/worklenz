import { TaskExportOptions } from "./types";

/**
 * TE-32: Options persisted on async jobs are selection/scope only.
 * Never store custom-field values, comment bodies, or attachment bytes here —
 * those are always loaded when buildExportArtifact runs (generation time).
 */
export const normalizeTaskExportOptions = (
  raw: Partial<TaskExportOptions>
): TaskExportOptions => {
  const scope = raw.scope === "filtered" ? "filtered" : "project";
  // task_ids only apply to filtered exports — ignore them for full-project scope
  // so audit/job records cannot claim scope:project while silently filtering.
  const task_ids =
    scope === "filtered" && Array.isArray(raw.task_ids)
      ? raw.task_ids.filter((id): id is string => Boolean(id))
      : null;

  return {
    include_tasks: Boolean(raw.include_tasks),
    include_comments: Boolean(raw.include_comments),
    include_files: Boolean(raw.include_files),
    scope,
    task_ids,
  };
};

/** Keys allowed on a persisted job options payload (TE-32 contract). */
export const TASK_EXPORT_PERSISTED_OPTION_KEYS = [
  "include_tasks",
  "include_comments",
  "include_files",
  "scope",
  "task_ids",
] as const;
