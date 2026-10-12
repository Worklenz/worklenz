import moment from "moment";

import db from "../../config/db";
import {
  createPresignedUrlWithClient,
  getTaskExportStorageKey,
  uploadBuffer,
} from "../../shared/storage";
import { log_error } from "../../shared/utils";
import { NotificationsService } from "../notifications/notifications.service";
import { buildTaskExportArtifact } from "./task-export-artifact";
import {
  isTaskExportDownloadAvailable,
  isTaskExportPastRetention,
} from "./task-export-availability";
import { toPublicTaskExportJob } from "./task-export-public";
import { normalizeTaskExportOptions } from "./task-export-options";
import {
  CreateTaskExportJobInput,
  TASK_EXPORT_RETENTION_DAYS,
  TaskExportAuditAction,
  TaskExportJob,
  TaskExportJobStatus,
  TaskExportOptions,
} from "./types";

const normalizeOptions = normalizeTaskExportOptions;

const parseJobRow = (row: Record<string, unknown>): TaskExportJob => {
  const options =
    typeof row.options === "string"
      ? (JSON.parse(row.options) as TaskExportOptions)
      : (row.options as TaskExportOptions);

  const stats =
    typeof row.stats === "string"
      ? (JSON.parse(row.stats) as Record<string, unknown>)
      : ((row.stats as Record<string, unknown>) || {});

  return {
    id: String(row.id),
    team_id: String(row.team_id),
    project_id: String(row.project_id),
    created_by: String(row.created_by),
    status: row.status as TaskExportJobStatus,
    options: normalizeOptions(options || {}),
    stats,
    storage_key: (row.storage_key as string) || null,
    file_name: (row.file_name as string) || null,
    content_type: (row.content_type as string) || null,
    size_bytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    error_message: (row.error_message as string) || null,
    expires_at: (row.expires_at as string) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
};

class TaskExportService {
  normalizeOptions = normalizeOptions;

  async appendAuditLog(input: {
    jobId?: string | null;
    teamId: string;
    projectId: string;
    actorId: string;
    action: TaskExportAuditAction;
    message: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await db.query(
        `INSERT INTO task_export_audit_logs
           (job_id, team_id, project_id, actor_id, action, message, context)
         VALUES ($1::UUID, $2::UUID, $3::UUID, $4::UUID, $5, $6, $7::JSONB)`,
        [
          input.jobId || null,
          input.teamId,
          input.projectId,
          input.actorId,
          input.action,
          input.message,
          JSON.stringify(input.context || {}),
        ]
      );
    } catch (error) {
      log_error(error);
    }
  }

  /** True when a unique-index race blocked a second active job for the project. */
  isActiveJobConflict(error: unknown): boolean {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    return code === "23505";
  }

  async createJob(input: CreateTaskExportJobInput): Promise<TaskExportJob> {
    // TE-32: persist options only (include_*, scope, task_ids). Never snapshot
    // custom-field values, comments, or attachments here — those are read when
    // the worker calls buildExportArtifact / processJob.
    // Concurrent inserts for the same project are rejected by
    // idx_task_export_jobs_one_active_per_project (unique, queued/processing).
    const options = normalizeOptions(input.options);
    const { rows } = await db.query(
      `INSERT INTO task_export_jobs
         (team_id, project_id, created_by, status, options)
       VALUES ($1::UUID, $2::UUID, $3::UUID, 'queued', $4::JSONB)
       RETURNING *`,
      [
        input.teamId,
        input.projectId,
        input.createdBy,
        JSON.stringify(options),
      ]
    );
    const job = parseJobRow(rows[0]);
    await this.appendAuditLog({
      jobId: job.id,
      teamId: job.team_id,
      projectId: job.project_id,
      actorId: job.created_by,
      action: "created",
      message: "Task export job created",
      context: { options },
    });
    return job;
  }

  async getJob(jobId: string): Promise<TaskExportJob | null> {
    const { rows } = await db.query(
      `SELECT * FROM task_export_jobs WHERE id = $1::UUID LIMIT 1`,
      [jobId]
    );
    return rows[0] ? parseJobRow(rows[0]) : null;
  }

  async listJobsForProject(
    projectId: string,
    limit = 20
  ): Promise<TaskExportJob[]> {
    const { rows } = await db.query(
      `SELECT * FROM task_export_jobs
       WHERE project_id = $1::UUID
         AND status IN ('queued', 'processing', 'ready', 'failed')
       ORDER BY created_at DESC
       LIMIT $2`,
      [projectId, limit]
    );
    return rows.map(parseJobRow);
  }

  /**
   * Per-project concurrency gate (any user). Matches the 409 copy and the
   * partial unique index on (project_id) WHERE status IN ('queued','processing').
   */
  async hasActiveAsyncJob(projectId: string): Promise<boolean> {
    const { rowCount } = await db.query(
      `SELECT 1 FROM task_export_jobs
       WHERE project_id = $1::UUID
         AND status IN ('queued', 'processing')
       LIMIT 1`,
      [projectId]
    );
    return (rowCount || 0) > 0;
  }

  async updateJobStatus(
    jobId: string,
    status: TaskExportJobStatus,
    patch: {
      errorMessage?: string | null;
      stats?: Record<string, unknown>;
      storageKey?: string | null;
      fileName?: string | null;
      contentType?: string | null;
      sizeBytes?: number | null;
      expiresAt?: Date | null;
    } = {}
  ): Promise<TaskExportJob | null> {
    const { rows } = await db.query(
      `UPDATE task_export_jobs
       SET status = $2,
           error_message = $3,
           stats = CASE WHEN $4::JSONB IS NULL THEN stats ELSE $4::JSONB END,
           storage_key = COALESCE($5, storage_key),
           file_name = COALESCE($6, file_name),
           content_type = COALESCE($7, content_type),
           size_bytes = COALESCE($8, size_bytes),
           expires_at = COALESCE($9, expires_at),
           updated_at = NOW()
       WHERE id = $1::UUID
       RETURNING *`,
      [
        jobId,
        status,
        patch.errorMessage ?? null,
        patch.stats ? JSON.stringify(patch.stats) : null,
        patch.storageKey ?? null,
        patch.fileName ?? null,
        patch.contentType ?? null,
        patch.sizeBytes ?? null,
        patch.expiresAt ?? null,
      ]
    );
    return rows[0] ? parseJobRow(rows[0]) : null;
  }

  /**
   * Builds CSV/ZIP payload in memory.
   * TE-32: reads tasks / custom fields / comments / attachments at call time
   * (generation time for async jobs), not at job enqueue time.
   * TE-29: custom field columns come from live project definitions (empty → none).
   * TE-30: comments query returns only existing comments (no blank task rows).
   * TE-31: attachment entries are file-backed only (no empty per-task folders).
   */
  async buildExportArtifact(
    projectId: string,
    options: TaskExportOptions
  ): Promise<{
    buffer: Buffer;
    fileName: string;
    contentType: string;
    stats: Record<string, unknown>;
  }> {
    return buildTaskExportArtifact(projectId, options);
  }

  async processJob(job: TaskExportJob): Promise<void> {
    await this.appendAuditLog({
      jobId: job.id,
      teamId: job.team_id,
      projectId: job.project_id,
      actorId: job.created_by,
      action: "started",
      message: "Task export processing started",
    });

    try {
      // TE-32: snapshot field values / files here (generation), using options
      // queued earlier — not values captured at enqueue.
      const artifact = await this.buildExportArtifact(
        job.project_id,
        job.options
      );

      const extension = artifact.fileName.endsWith(".csv") ? "csv" : "zip";
      const storageKey = getTaskExportStorageKey(
        job.team_id,
        job.project_id,
        job.id,
        extension
      );

      const uploaded = await uploadBuffer(
        artifact.buffer,
        artifact.contentType,
        storageKey
      );
      if (!uploaded) {
        throw new Error("Failed to upload export artifact to storage");
      }

      const expiresAt = moment
        .utc()
        .add(TASK_EXPORT_RETENTION_DAYS, "days")
        .toDate();

      await this.updateJobStatus(job.id, "ready", {
        stats: artifact.stats,
        storageKey,
        fileName: artifact.fileName,
        contentType: artifact.contentType,
        sizeBytes: artifact.buffer.length,
        expiresAt,
        errorMessage: null,
      });

      await this.appendAuditLog({
        jobId: job.id,
        teamId: job.team_id,
        projectId: job.project_id,
        actorId: job.created_by,
        action: "completed",
        message: "Task export ready for download",
        context: { ...artifact.stats, size_bytes: artifact.buffer.length },
      });

      await this.notifyExportReady(job);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Task export failed";
      await this.updateJobStatus(job.id, "failed", {
        errorMessage: message,
      });
      await this.appendAuditLog({
        jobId: job.id,
        teamId: job.team_id,
        projectId: job.project_id,
        actorId: job.created_by,
        action: "failed",
        message,
      });
      throw error;
    }
  }

  private async notifyExportReady(job: TaskExportJob): Promise<void> {
    try {
      const { rows } = await db.query(
        `SELECT socket_id FROM users WHERE id = $1::UUID LIMIT 1`,
        [job.created_by]
      );
      const socketId = rows[0]?.socket_id || "";
      await NotificationsService.createNotification({
        userId: job.created_by,
        teamId: job.team_id,
        socketId,
        message:
          "Your export is ready. Open Project Settings → Task Export to download it.",
        taskId: null,
        projectId: job.project_id,
      });
    } catch (error) {
      log_error(error);
    }
  }

  async getDownloadUrl(
    job: TaskExportJob,
    actorId: string
  ): Promise<{ url: string; expires_in: number; file_name: string } | null> {
    // TE-36: refuse after retention window (and for non-ready / missing object).
    if (!job.file_name || !isTaskExportDownloadAvailable(job)) {
      return null;
    }
    // Past-retention ready jobs may still briefly look "ready" before cleanup —
    // double-check so download links stop working immediately after the window.
    if (isTaskExportPastRetention(job.expires_at)) {
      return null;
    }

    const url = await createPresignedUrlWithClient(
      job.storage_key as string,
      job.file_name
    );
    if (!url) return null;

    await this.appendAuditLog({
      jobId: job.id,
      teamId: job.team_id,
      projectId: job.project_id,
      actorId,
      action: "downloaded",
      message: "Task export downloaded",
    });

    return { url, expires_in: 3600, file_name: job.file_name };
  }

  toPublicJob(job: TaskExportJob) {
    return toPublicTaskExportJob(job);
  }
}

export default new TaskExportService();
