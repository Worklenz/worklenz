import moment from "moment";

import db from "../../config/db";
import { log_error } from "../../shared/utils";
import {
  createPresignedUrlWithClient,
  getAuditLogExportStorageKey,
  uploadBuffer,
} from "../../shared/storage";
import { buildAuditEventsWhereClause, AuditLogFilters } from "../../shared/audit-log-query";
import { buildAuditLogCsv, getAuditLogExportFileName } from "../../shared/audit-log-csv";
import {
  AUDIT_LOG_EXPORT_MAX_ROWS,
  AUDIT_LOG_EXPORT_RETENTION_DAYS,
  AuditLogExportJob,
  AuditLogExportJobStatus,
  CreateAuditLogExportJobInput,
} from "./types";

const parseJobRow = (row: Record<string, unknown>): AuditLogExportJob => {
  const filters =
    typeof row.filters === "string" ? (JSON.parse(row.filters) as AuditLogFilters) : (row.filters as AuditLogFilters);

  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    created_by: String(row.created_by),
    status: row.status as AuditLogExportJobStatus,
    filters,
    row_count: row.row_count != null ? Number(row.row_count) : null,
    storage_key: (row.storage_key as string) || null,
    file_name: (row.file_name as string) || null,
    size_bytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    error_message: (row.error_message as string) || null,
    expires_at: (row.expires_at as string) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
};

/** True when a unique-index race blocked a second active job for the organization. */
export const isActiveJobConflict = (error: unknown): boolean => {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "23505";
};

export async function createJob(input: CreateAuditLogExportJobInput): Promise<AuditLogExportJob> {
  // Concurrent inserts for the same organization are rejected by
  // idx_audit_log_export_jobs_one_active_per_org (unique, queued/processing) - see
  // isActiveJobConflict above and the controller's hasActiveAsyncJob pre-check.
  const { rows } = await db.query(
    `INSERT INTO audit_log_export_jobs (organization_id, created_by, status, filters)
     VALUES ($1::UUID, $2::UUID, 'queued', $3::JSONB)
     RETURNING *`,
    [input.organizationId, input.createdBy, JSON.stringify(input.filters)]
  );
  return parseJobRow(rows[0]);
}

export async function getJob(jobId: string): Promise<AuditLogExportJob | null> {
  const { rows } = await db.query(`SELECT * FROM audit_log_export_jobs WHERE id = $1::UUID LIMIT 1`, [jobId]);
  return rows[0] ? parseJobRow(rows[0]) : null;
}

/**
 * The organization's most recent background export from the last 24 hours, so the Audit Log
 * page can resume showing its progress or download link after a reload (or after a 409).
 */
export async function getLatestJob(organizationId: string): Promise<AuditLogExportJob | null> {
  const { rows } = await db.query(
    `SELECT * FROM audit_log_export_jobs
     WHERE organization_id = $1::UUID
       AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY created_at DESC
     LIMIT 1`,
    [organizationId]
  );
  return rows[0] ? parseJobRow(rows[0]) : null;
}

/** Per-organization concurrency gate, same approach as TaskExportService.hasActiveAsyncJob. */
export async function hasActiveAsyncJob(organizationId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `SELECT 1 FROM audit_log_export_jobs
     WHERE organization_id = $1::UUID
       AND status IN ('queued', 'processing')
     LIMIT 1`,
    [organizationId]
  );
  return (rowCount || 0) > 0;
}

export async function updateJobStatus(
  jobId: string,
  status: AuditLogExportJobStatus,
  patch: {
    errorMessage?: string | null;
    rowCount?: number | null;
    storageKey?: string | null;
    fileName?: string | null;
    sizeBytes?: number | null;
    expiresAt?: Date | null;
  } = {}
): Promise<AuditLogExportJob | null> {
  const { rows } = await db.query(
    `UPDATE audit_log_export_jobs
     SET status = $2,
         error_message = $3,
         row_count = COALESCE($4, row_count),
         storage_key = COALESCE($5, storage_key),
         file_name = COALESCE($6, file_name),
         size_bytes = COALESCE($7, size_bytes),
         expires_at = COALESCE($8, expires_at),
         updated_at = NOW()
     WHERE id = $1::UUID
     RETURNING *`,
    [
      jobId,
      status,
      patch.errorMessage ?? null,
      patch.rowCount ?? null,
      patch.storageKey ?? null,
      patch.fileName ?? null,
      patch.sizeBytes ?? null,
      patch.expiresAt ?? null,
    ]
  );
  return rows[0] ? parseJobRow(rows[0]) : null;
}

/**
 * Runs the full (unpaginated, capped at AUDIT_LOG_EXPORT_MAX_ROWS) filtered query and builds
 * the CSV buffer. Shared by the sync path (task 5.1, called directly from the controller)
 * and the async worker (task 5.2, called from processJob below) so both produce byte-
 * identical output for the same filters.
 */
export async function buildExportCsv(
  organizationId: string,
  filters: AuditLogFilters
): Promise<{ buffer: Buffer; rowCount: number; truncated: boolean }> {
  const { whereClause, params, nextParamIndex } = buildAuditEventsWhereClause(organizationId, filters);

  const q = `
    SELECT created_at, actor_name, category, event_type, description, old_value, new_value
    FROM audit_events
    WHERE ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT $${nextParamIndex};
  `;
  const result = await db.query(q, [...params, AUDIT_LOG_EXPORT_MAX_ROWS + 1]);

  const truncated = result.rows.length > AUDIT_LOG_EXPORT_MAX_ROWS;
  const rows = truncated ? result.rows.slice(0, AUDIT_LOG_EXPORT_MAX_ROWS) : result.rows;

  let csv = buildAuditLogCsv(rows);
  if (truncated) {
    csv += `\n\n"Export limited to the first ${AUDIT_LOG_EXPORT_MAX_ROWS.toLocaleString("en-US")} events — narrow the date range or filters to export the rest."`;
  }

  return { buffer: Buffer.from(csv, "utf8"), rowCount: rows.length, truncated };
}

export async function processJob(job: AuditLogExportJob): Promise<void> {
  try {
    const { buffer, rowCount } = await buildExportCsv(job.organization_id, job.filters);

    const storageKey = getAuditLogExportStorageKey(job.organization_id, job.id);
    const uploaded = await uploadBuffer(buffer, "text/csv", storageKey);
    if (!uploaded) {
      throw new Error("Failed to upload audit log export artifact to storage");
    }

    const expiresAt = moment.utc().add(AUDIT_LOG_EXPORT_RETENTION_DAYS, "days").toDate();

    await updateJobStatus(job.id, "ready", {
      rowCount,
      storageKey,
      fileName: getAuditLogExportFileName(),
      sizeBytes: buffer.length,
      expiresAt,
      errorMessage: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Audit log export failed";
    await updateJobStatus(job.id, "failed", { errorMessage: message });
    log_error(error, { scope: "AuditLogExportService.processJob", jobId: job.id });
    throw error;
  }
}

/** True when a job may still be downloaded (status Ready, object present, within window). */
export function isDownloadAvailable(job: Pick<AuditLogExportJob, "status" | "storage_key" | "expires_at">): boolean {
  if (job.status !== "ready") return false;
  if (!job.storage_key) return false;
  if (job.expires_at && moment.utc(job.expires_at).isBefore(moment.utc())) return false;
  return true;
}

export async function getDownloadUrl(
  job: AuditLogExportJob
): Promise<{ url: string; expires_in: number; file_name: string } | null> {
  if (!job.file_name || !isDownloadAvailable(job)) {
    return null;
  }

  const url = await createPresignedUrlWithClient(job.storage_key as string, job.file_name);
  if (!url) return null;

  return { url, expires_in: 3600, file_name: job.file_name };
}

export function toPublicJob(job: AuditLogExportJob) {
  return {
    id: job.id,
    status: job.status,
    row_count: job.row_count,
    file_name: job.file_name,
    size_bytes: job.size_bytes,
    error_message: job.error_message,
    expires_at: job.expires_at,
    created_at: job.created_at,
    can_download: isDownloadAvailable(job),
  };
}
