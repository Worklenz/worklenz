import { IServerResponse } from '@/types/common.types';

export type TaskExportUiStatus = 'Processing' | 'Ready' | 'Failed' | 'Expired';

export interface TaskExportOptionsPayload {
  include_tasks: boolean;
  include_comments: boolean;
  include_files: boolean;
}

export interface TaskExportPublicJob {
  id: string;
  status: TaskExportUiStatus;
  status_raw: string;
  included: string[];
  options: TaskExportOptionsPayload & {
    scope?: string;
    task_ids?: string[] | null;
  };
  stats: Record<string, unknown>;
  file_name: string | null;
  size_bytes: number | null;
  error_message: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  download_available: boolean;
}

export interface TaskExportAsyncCreateBody {
  mode: 'async';
  job: TaskExportPublicJob;
}

export interface TaskExportDownloadBody {
  url: string;
  expires_in: number;
  file_name: string;
}

export type TaskExportCreateResult =
  | { mode: 'sync'; blob: Blob; fileName: string }
  | { mode: 'async'; job: TaskExportPublicJob };

export type TaskExportListResponse = IServerResponse<TaskExportPublicJob[]>;
export type TaskExportJobResponse = IServerResponse<TaskExportPublicJob>;
export type TaskExportDownloadResponse = IServerResponse<TaskExportDownloadBody>;
