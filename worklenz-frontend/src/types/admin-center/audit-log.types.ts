import type { AuditEventCategoryId } from '@/shared/audit-log-constants';

export interface IAuditLogEvent {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_name: string;
  category: AuditEventCategoryId;
  event_type: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  team_id: string | null;
  /** False once the actor has left every team in the workspace (their name is kept for the record). */
  actor_in_workspace: boolean;
}

export interface IAuditLogListResponse {
  total: number;
  data: IAuditLogEvent[];
}

export interface IAuditLogSummary {
  total: number;
  failed_logins: number;
  by_category: Record<AuditEventCategoryId, number>;
}

/** Query params understood by every audit log read/export endpoint (CSV lists are comma-joined). */
export interface IAuditLogQueryParams {
  start_date?: string;
  end_date?: string;
  category?: string;
  actor_user_id?: string;
  search?: string;
}

export interface IAuditLogListParams extends IAuditLogQueryParams {
  index: number;
  size: number;
}

export type AuditLogExportJobStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'expired';

export interface IAuditLogExportJob {
  id: string;
  status: AuditLogExportJobStatus;
  row_count: number | null;
  file_name: string | null;
  size_bytes: number | null;
  error_message: string | null;
  expires_at: string | null;
  created_at: string;
  can_download: boolean;
}

export type IAuditLogExportResult =
  | { mode: 'sync'; blob: Blob; fileName: string }
  | { mode: 'async'; job: IAuditLogExportJob };

export interface IAuditLogExportDownload {
  url: string;
  expires_in: number;
  file_name: string | null;
}

export interface IAuditLogRetention {
  retention_months: number;
  min_months: number;
  max_months: number;
  default_months: number;
  pci_min_months: number;
  options: number[];
  can_edit: boolean;
}

export interface IAuditLogActorOption {
  value: string;
  label: string;
}
