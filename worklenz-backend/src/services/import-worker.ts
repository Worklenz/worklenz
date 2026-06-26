import db from "../config/db";
import ImportsService, { ImportJob } from "./imports-service";
import ImportIngestionService from "./import-ingestion-service";

// Jobs stuck in 'running' for longer than this are assumed orphaned (server
// restart killed the worker mid-flight) and will be re-queued as 'ready'.
const STALE_RUNNING_THRESHOLD_MINUTES = 30;

class ImportWorker {
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs = 5000;

  start() {
    if (this.timer) return;
    // Recover any jobs orphaned by a previous server restart before starting
    // the normal tick loop.
    void this.recoverStaleJobs();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async recoverStaleJobs() {
    try {
      const { rowCount } = await db.query(
        `UPDATE import_jobs
         SET status = 'ready', error_message = NULL, updated_at = NOW()
         WHERE status = 'running'
           AND updated_at < NOW() - ($1 || ' minutes')::INTERVAL`,
        [STALE_RUNNING_THRESHOLD_MINUTES],
      );
      if (rowCount) {
        console.log(`[ImportWorker] Recovered ${rowCount} stale running job(s)`);
      }
    } catch (err) {
      console.error("[ImportWorker] Failed to recover stale jobs", err);
    }
  }

  private async claimJob(): Promise<ImportJob | null> {
    const q = `WITH next_job AS (
      SELECT id FROM import_jobs WHERE status = 'ready' ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE import_jobs SET status = 'running', updated_at = NOW()
    FROM next_job WHERE import_jobs.id = next_job.id
    RETURNING import_jobs.*;`;
    const { rows } = await db.query(q);
    return rows[0] || null;
  }

  private async tick() {
    try {
      const job = await this.claimJob();
      if (!job) return;
      await ImportsService.appendLog(job.id, "info", "Import started by worker");
      try {
        if (job.flow_type === "direct") {
          // Direct integrations: fetch from source API and stage data.
          await ImportIngestionService.ingest(job, {
            sourceReference: job.source_reference,
          });
          await ImportsService.appendLog(job.id, "info", "Ingestion completed by worker");
        } else if (job.flow_type === "csv") {
          // CSV flow: csvText was stored in source_reference by the ingest
          // endpoint. Parse and stage it here so the HTTP handler stays fast.
          const src = job.source_reference as any || {};
          const csvText = src.csvText as string | undefined;
          if (csvText) {
            // Ingest first — auto-detects headers and stages tasks.
            await ImportIngestionService.ingest(job, { csvText });
            // Apply user-configured mappings AFTER auto-detection so they
            // take precedence (ImportIngestionService.ingest overwrites with
            // CSV headers; we restore the user's choices here).
            if (src.fields?.length) await ImportsService.upsertFields(job.id, src.fields);
            if (src.values?.length) await ImportsService.upsertValueMappings(job.id, src.values);
            if (src.users?.length) await ImportsService.upsertUserMappings(job.id, src.users);
            await ImportsService.appendLog(job.id, "info", "CSV ingestion completed by worker");
          }
        }
        await ImportsService.commit(job.id);
        await ImportsService.appendLog(job.id, "info", "Import committed successfully");
      } catch (err: any) {
        const message = err?.message || "Import failed";
        await ImportsService.appendLog(job.id, "error", message, {
          error: err?.stack || err,
        });
        await ImportsService.cancel(job.id, message);
      }
    } catch (err) {
      // Swallow worker errors to avoid crashing interval
      console.error("Import worker tick failed", err);
    }
  }
}

export default new ImportWorker();
