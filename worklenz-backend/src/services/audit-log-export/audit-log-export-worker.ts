import db from "../../config/db";
import { log_error } from "../../shared/utils";
import * as AuditLogExportService from "./audit-log-export.service";
import { AuditLogExportJob } from "./types";

/**
 * In-process polling worker for Audit Log export jobs (Audit log spec, task 5.2).
 * Deliberately mirrors services/task-export/task-export-worker.ts's design exactly: this
 * codebase has no external queue (no Bull/BullMQ/etc.), so a `FOR UPDATE SKIP LOCKED` claim
 * over a plain Postgres table is the existing, proven pattern for a lightweight background
 * job - introducing a second, different mechanism for this feature would be inconsistent
 * for no real benefit.
 */
const STALE_PROCESSING_THRESHOLD_MINUTES = 60;

class AuditLogExportWorker {
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs = 5000;
  private isTickRunning = false;

  start() {
    if (this.timer) return;
    void this.recoverStaleJobs();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    console.log("[AuditLogExportWorker] started");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async recoverStaleJobs() {
    try {
      const { rowCount } = await db.query(
        `UPDATE audit_log_export_jobs
         SET status = 'queued', error_message = NULL, updated_at = NOW()
         WHERE status = 'processing'
           AND updated_at < NOW() - ($1 || ' minutes')::INTERVAL`,
        [STALE_PROCESSING_THRESHOLD_MINUTES]
      );
      if (rowCount) {
        console.log(`[AuditLogExportWorker] Recovered ${rowCount} stale processing job(s)`);
      }
    } catch (error) {
      console.error("[AuditLogExportWorker] Failed to recover stale jobs", error);
    }
  }

  private async claimJob(): Promise<AuditLogExportJob | null> {
    const q = `
      WITH next_job AS (
        SELECT id
        FROM audit_log_export_jobs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE audit_log_export_jobs
      SET status = 'processing', updated_at = NOW()
      FROM next_job
      WHERE audit_log_export_jobs.id = next_job.id
      RETURNING audit_log_export_jobs.*`;
    const { rows } = await db.query(q);
    if (!rows[0]) return null;

    return AuditLogExportService.getJob(rows[0].id);
  }

  private async tick() {
    if (this.isTickRunning) return;
    this.isTickRunning = true;
    try {
      const job = await this.claimJob();
      if (!job) return;

      try {
        await AuditLogExportService.processJob(job);
      } catch (error) {
        // processJob already marks the job failed; keep the worker alive for the next tick.
        log_error(error);
      }
    } catch (error) {
      console.error("[AuditLogExportWorker] tick failed", error);
    } finally {
      this.isTickRunning = false;
    }
  }
}

export default new AuditLogExportWorker();
