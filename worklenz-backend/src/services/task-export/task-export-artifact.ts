import moment from "moment";

import {
  generateCommentsCsv,
  generateTasksCsv,
} from "../task-export-csv";
import { collectAttachmentZipEntries } from "./task-export-bundler";
import { createZipBuffer, ZipEntry } from "./task-export-zip";
import {
  fetchAttachmentsForExport,
  fetchCommentsForExport,
  fetchProjectCustomFields,
  fetchTasksForExport,
} from "./task-export-data";
import {
  TASK_EXPORT_MAX_BUNDLE_BYTES,
  TASK_EXPORT_MAX_BUNDLE_ERROR,
  TaskExportOptions,
} from "./types";

export interface TaskExportArtifact {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  stats: Record<string, unknown>;
}

/**
 * Builds CSV/ZIP payload in memory.
 * TE-32: reads tasks / custom fields / comments / attachments at call time.
 * TE-29 / TE-30 / TE-31: empty custom fields / comments / attachments behave as edge-case specs.
 */
export const buildTaskExportArtifact = async (
  projectId: string,
  options: TaskExportOptions
): Promise<TaskExportArtifact> => {
  const taskIds = options.task_ids || null;

  // Tasks/custom-fields, comments, and attachments are independent reads
  // keyed only by projectId/taskIds — run them concurrently instead of
  // paying their latencies back-to-back.
  const [customFields, tasks, comments, attachments] = await Promise.all([
    options.include_tasks ? fetchProjectCustomFields(projectId) : Promise.resolve([]),
    options.include_tasks ? fetchTasksForExport(projectId, taskIds) : Promise.resolve(null),
    options.include_comments ? fetchCommentsForExport(projectId, taskIds) : Promise.resolve(null),
    options.include_files ? fetchAttachmentsForExport(projectId, taskIds) : Promise.resolve(null),
  ]);

  const entries: ZipEntry[] = [];
  const stats: Record<string, unknown> = {
    include_tasks: options.include_tasks,
    include_comments: options.include_comments,
    include_files: options.include_files,
    scope: options.scope,
  };

  if (options.include_tasks && tasks) {
    const csv = generateTasksCsv(tasks, customFields);
    entries.push({ path: "tasks.csv", data: csv });
    stats.task_count = tasks.length;
  }

  if (options.include_comments && comments) {
    const csv = generateCommentsCsv(comments);
    entries.push({ path: "comments.csv", data: csv });
    stats.comment_count = comments.length;
  }

  if (options.include_files && attachments) {
    const bundled = await collectAttachmentZipEntries(attachments);
    if (bundled.totalBytes > TASK_EXPORT_MAX_BUNDLE_BYTES) {
      throw new Error(TASK_EXPORT_MAX_BUNDLE_ERROR);
    }
    entries.push(...bundled.entries);
    stats.file_count = bundled.fileCount;
    stats.attachment_bytes = bundled.totalBytes;
    stats.skipped_missing_attachments = bundled.skippedMissing;
  }

  const hasSelection =
    options.include_tasks || options.include_comments || options.include_files;

  if (!hasSelection) {
    throw new Error("Select at least one of Tasks, Task Comments, or Files");
  }

  if (entries.length === 0) {
    // Tasks/comments CSVs always produce at least a header row, so reaching
    // here with a valid selection means include_files was selected but none
    // of the project's attachments were available to bundle (e.g. all were
    // deleted from storage) — a distinct case from "nothing was selected".
    throw new Error("No files were found to export for the selected scope");
  }

  const needsZip =
    options.include_files ||
    (options.include_tasks && options.include_comments) ||
    entries.length > 1;

  if (needsZip) {
    const buffer = await createZipBuffer(entries);
    return {
      buffer,
      fileName: `task-export-${moment.utc().format("YYYYMMDD-HHmmss")}.zip`,
      contentType: "application/zip",
      stats,
    };
  }

  const only = entries[0];
  const buffer =
    typeof only.data === "string"
      ? Buffer.from(only.data, "utf8")
      : only.data;
  return {
    buffer,
    fileName: only.path,
    contentType: "text/csv; charset=utf-8",
    stats,
  };
};
