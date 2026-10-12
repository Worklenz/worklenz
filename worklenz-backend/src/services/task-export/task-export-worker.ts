import db from "../../config/db";
import { log_error } from "../../shared/utils";
import TaskExportService from "./task-export.service";
import { TaskExportJob } from "./types";

const STALE_PROCESSING_THRESHOLD_MINUTES = 60;

class TaskExportWorker {
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs = 5000;
  private isTickRunning = false;

  start() {
    if (this.timer) return;
    void this.recoverStaleJobs();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    console.log("[TaskExportWorker] started");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async recoverStaleJobs() {
    try {
      const { rowCount } = await db.query(
        `UPDATE task_export_jobs
         SET status = 'queued', error_message = NULL, updated_at = NOW()
         WHERE status = 'processing'
           AND updated_at < NOW() - ($1 || ' minutes')::INTERVAL`,
        [STALE_PROCESSING_THRESHOLD_MINUTES]
      );
      if (rowCount) {
        console.log(
          `[TaskExportWorker] Recovered ${rowCount} stale processing job(s)`
        );
      }
    } catch (error) {
      console.error("[TaskExportWorker] Failed to recover stale jobs", error);
    }
  }

  private async claimJob(): Promise<TaskExportJob | null> {
    const q = `
      WITH next_job AS (
        SELECT id
        FROM task_export_jobs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE task_export_jobs
      SET status = 'processing', updated_at = NOW()
      FROM next_job
      WHERE task_export_jobs.id = next_job.id
      RETURNING task_export_jobs.*`;
    const { rows } = await db.query(q);
    if (!rows[0]) return null;

    // Re-fetch via service parser for typed options/stats
    return TaskExportService.getJob(rows[0].id);
  }

  private async tick() {
    if (this.isTickRunning) return;
    this.isTickRunning = true;
    try {
      const job = await this.claimJob();
      if (!job) return;

      try {
        await TaskExportService.processJob(job);
      } catch (error) {
        // processJob already marks failed + audits; keep the worker alive
        log_error(error);
      }
    } catch (error) {
      console.error("[TaskExportWorker] tick failed", error);
    } finally {
      this.isTickRunning = false;
    }
  }
}

export default new TaskExportWorker();
