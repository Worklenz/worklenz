import { CronJob } from "cron";
import { PoolClient } from "pg";

import db from "../config/db";
import { log_error } from "../shared/utils";
import { deleteObject } from "../shared/storage";
import TaskExportService from "../services/task-export/task-export.service";

const TIME = process.env.TASK_EXPORT_CLEANUP_INTERVAL || "0 */6 * * *";
const MAX_CLEANUP_PER_TICK = 100;
const ADVISORY_LOCK_ID = 900210;

const log = (value: string) => console.log("task-export-cleanup-job:", value);

async function acquireAdvisoryLock(client: PoolClient): Promise<boolean> {
  const result = await client.query(
    "SELECT pg_try_advisory_lock($1) AS acquired;",
    [ADVISORY_LOCK_ID]
  );
  return result.rows[0]?.acquired === true;
}

async function releaseAdvisoryLock(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_unlock($1);", [ADVISORY_LOCK_ID]);
}

async function onCleanupTick(): Promise<void> {
  let locked = false;
  let lockClient: PoolClient | null = null;

  try {
    lockClient = await db.pool.connect();
    locked = await acquireAdvisoryLock(lockClient);
    if (!locked) return;

    const expiredResult = await lockClient.query(
      `SELECT id, team_id, project_id, created_by, storage_key
       FROM task_export_jobs
       WHERE status = 'ready'
         AND expires_at IS NOT NULL
         AND expires_at < NOW()
       ORDER BY expires_at ASC
       LIMIT $1`,
      [MAX_CLEANUP_PER_TICK]
    );

    if (!expiredResult.rowCount) return;

    let expiredCount = 0;

    for (const row of expiredResult.rows) {
      if (row.storage_key) {
        // deleteObject swallows provider errors and returns null — do not clear
        // the DB row on failure so a later tick can retry the orphaned object.
        const deleted = await deleteObject(row.storage_key);
        if (!deleted) {
          log_error(
            new Error(
              `Failed to delete task export storage object ${row.storage_key} for job ${row.id}`
            )
          );
          continue;
        }
      }

      await lockClient.query(
        `UPDATE task_export_jobs
         SET status = 'expired',
             storage_key = NULL,
             updated_at = NOW()
         WHERE id = $1::UUID`,
        [row.id]
      );

      await TaskExportService.appendAuditLog({
        jobId: row.id,
        teamId: row.team_id,
        projectId: row.project_id,
        actorId: row.created_by,
        action: "expired",
        message: "Task export expired and storage object deleted",
      });
      expiredCount += 1;
    }

    if (expiredCount > 0) {
      log(`Expired ${expiredCount} task export artifact(s).`);
    }
  } catch (error) {
    log_error(error);
  } finally {
    if (locked && lockClient) {
      try {
        await releaseAdvisoryLock(lockClient);
      } catch (error) {
        log_error(error);
      }
    }
    lockClient?.release();
  }
}

export function startTaskExportCleanupJob() {
  log("(cron) Task export cleanup job ready.");
  const job = new CronJob(TIME, () => void onCleanupTick(), null, true);
  job.start();
}
