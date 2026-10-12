import moment from "moment";

import { TaskExportJob, TaskExportJobStatus } from "./types";

/**
 * TE-36: true when expires_at is in the past (UTC).
 * Missing expires_at → not expired yet (download gate still requires ready + storage).
 */
export const isTaskExportPastRetention = (
  expiresAt: string | Date | null | undefined
): boolean => {
  if (!expiresAt) return false;
  return moment.utc(expiresAt).isBefore(moment.utc());
};

/**
 * TE-36: whether a job may still be downloaded (status Ready, object present, within window).
 */
export const isTaskExportDownloadAvailable = (
  job: Pick<TaskExportJob, "status" | "storage_key" | "expires_at">
): boolean => {
  if (job.status !== "ready") return false;
  if (!job.storage_key) return false;
  if (isTaskExportPastRetention(job.expires_at)) return false;
  return true;
};

/** Statuses that block download even if a storage key still exists. */
export const TASK_EXPORT_NON_DOWNLOADABLE_STATUSES: readonly TaskExportJobStatus[] =
  ["queued", "processing", "failed", "expired"];
