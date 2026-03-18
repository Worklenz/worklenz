import db from "../config/db";
import ImportsService, { ImportJob } from "./imports-service";
import ImportIngestionService from "./import-ingestion-service";

class ImportWorker {
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs = 5000;

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
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
      await ImportsService.appendLog(
        job.id,
        "info",
        "Import started by worker"
      );
      try {
        // If the job is direct and source_reference contains data, run ingestion automatically
        if (job.flow_type === "direct") {
          await ImportIngestionService.ingest(job, {
            sourceReference: job.source_reference,
          });
          await ImportsService.appendLog(
            job.id,
            "info",
            "Ingestion completed by worker"
          );
        }
        await ImportsService.commit(job.id);
        await ImportsService.appendLog(
          job.id,
          "info",
          "Import committed successfully"
        );
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
