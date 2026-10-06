import { getKey, getObjectBuffer, getTaskAttachmentKey } from "../../shared/storage";
import { TaskExportAttachmentRow } from "./types";
import {
  buildUniqueAttachmentZipPath,
  ZipEntry,
} from "./task-export-zip";

export type { ZipEntry } from "./task-export-zip";
export { buildUniqueAttachmentZipPath, createZipBuffer } from "./task-export-zip";

export interface BundleAttachmentsResult {
  entries: ZipEntry[];
  totalBytes: number;
  fileCount: number;
  skippedMissing: number;
}

const resolveAttachmentStorageKey = (
  attachment: TaskExportAttachmentRow
): string | null => {
  if (attachment.source === "comment") {
    if (!attachment.comment_id) return null;
    return getTaskAttachmentKey(
      attachment.team_id,
      attachment.project_id,
      attachment.task_id,
      attachment.comment_id,
      attachment.id,
      attachment.type
    );
  }

  return getKey(
    attachment.team_id,
    attachment.project_id,
    attachment.id,
    attachment.type
  );
};

/**
 * TE-16 / TE-31: Download task + comment attachments into one folder per task key.
 * Comment uploads use a different S3 key shape than task attachments.
 * Only tasks that have at least one readable attachment get a folder —
 * tasks with zero attachments produce no ZIP path prefix at all.
 */
export const collectAttachmentZipEntries = async (
  attachments: TaskExportAttachmentRow[]
): Promise<BundleAttachmentsResult> => {
  const usedPaths = new Set<string>();
  const entries: ZipEntry[] = [];
  let totalBytes = 0;
  let skippedMissing = 0;

  for (const attachment of attachments) {
    if (!attachment.task_id || !attachment.task_key) {
      skippedMissing += 1;
      continue;
    }

    const storageKey = resolveAttachmentStorageKey(attachment);
    if (!storageKey) {
      skippedMissing += 1;
      continue;
    }

    const buffer = await getObjectBuffer(storageKey);
    if (!buffer) {
      skippedMissing += 1;
      continue;
    }

    // Keep original filename; collision helper appends (n) within the task folder.
    const zipPath = buildUniqueAttachmentZipPath(
      attachment.task_key,
      attachment.name,
      usedPaths
    );
    entries.push({ path: zipPath, data: buffer });
    totalBytes += buffer.length;
  }

  return {
    entries,
    totalBytes,
    fileCount: entries.length,
    skippedMissing,
  };
};
