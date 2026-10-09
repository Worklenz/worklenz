/** Audit Log export job types (Audit log spec, task 5.2). */

import { AuditLogFilters } from "../../shared/audit-log-query";

export type AuditLogExportJobStatus = "queued" | "processing" | "ready" | "failed" | "expired";

export interface AuditLogExportJob {
  id: string;
  organization_id: string;
  created_by: string;
  status: AuditLogExportJobStatus;
  filters: AuditLogFilters;
  row_count: number | null;
  storage_key: string | null;
  file_name: string | null;
  size_bytes: number | null;
  error_message: string | null;
  expires_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface CreateAuditLogExportJobInput {
  organizationId: string;
  createdBy: string;
  filters: AuditLogFilters;
}

/**
 * Task 5.1/5.2 — resolved (no explicit numeric guidance in the spec's spike 0.5, which only
 * says "[Q]"): below this many matching rows, the export streams back synchronously in the
 * request/response cycle (5.1); at or above it, a background job is queued instead and the
 * caller polls for a download link (5.2). 20,000 plain-text audit rows is roughly 3-5MB of
 * CSV — comfortably inside a normal HTTP response/timeout budget, while anything larger
 * (a full, unfiltered export of a long-retention workspace) moves off the request thread.
 */
export const AUDIT_LOG_EXPORT_SYNC_ROW_CAP = 20_000;

/**
 * Hard ceiling even for background jobs, as a memory/runaway-query safety net — not a
 * product requirement. A capped export still completes and downloads; it just notes that it
 * was truncated (see shared/audit-log-csv.ts callers), the same pattern already used by the
 * Time Logs CSV export (TIME_LOGS_EXPORT_ROW_CAP in controllers/reporting/time-logs-query-builder.ts).
 */
export const AUDIT_LOG_EXPORT_MAX_ROWS = 500_000;

/**
 * How long a ready export stays downloadable before the cleanup cron deletes the storage
 * object and flips it to `expired` — mirrors TASK_EXPORT_RETENTION_DAYS
 * (services/task-export/types.ts) for consistency across the two export features.
 */
export const AUDIT_LOG_EXPORT_RETENTION_DAYS = 7;
