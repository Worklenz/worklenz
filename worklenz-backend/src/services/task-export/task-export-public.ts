import { isTaskExportDownloadAvailable } from "./task-export-availability";
import { mapJobStatusToUi, TaskExportJob } from "./types";

/** Public job shape returned by list/get APIs (TE-36 download_available). */
export const toPublicTaskExportJob = (job: TaskExportJob) => {
  const options = job.options;
  const included: string[] = [];
  if (options.include_tasks) included.push("Tasks");
  if (options.include_comments) included.push("Task Comments");
  if (options.include_files) included.push("Files");

  return {
    id: job.id,
    status: mapJobStatusToUi(job.status),
    status_raw: job.status,
    included,
    options,
    stats: job.stats,
    file_name: job.file_name,
    size_bytes: job.size_bytes,
    error_message: job.error_message,
    expires_at: job.expires_at,
    created_at: job.created_at,
    updated_at: job.updated_at,
    download_available: isTaskExportDownloadAvailable(job),
  };
};
