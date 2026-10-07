import { CronJob } from "cron";
import { PoolClient } from "pg";

import db from "../config/db";
import { log_error } from "../shared/utils";

/**
 * Audit Log retention purge (Audit log spec, task 6.2) — the only code path that removes
 * audit_events rows. All deletion logic lives in the SECURITY DEFINER function
 * purge_expired_audit_events() (see
 * database/pg-migrations/1791193625588_add-audit-log-retention-to-organizations.js), which
 * deletes rows older than each organization's audit_log_retention_months and is the only
 * delete the append-only trigger allows. The app role has no DELETE grant on the table.
 *
 * Advisory-locked so only one server instance runs the sweep per tick.
 */
const TIME = process.env.AUDIT_LOG_RETENTION_INTERVAL || "15 3 * * *";
const ADVISORY_LOCK_ID = 900212;

const log = (value: string) => console.log("audit-log-retention-job:", value);

export const PURGE_EXPIRED_AUDIT_EVENTS_SQL = "SELECT purge_expired_audit_events() AS deleted_count;";

async function acquireAdvisoryLock(client: PoolClient): Promise<boolean> {
  const result = await client.query("SELECT pg_try_advisory_lock($1) AS acquired;", [ADVISORY_LOCK_ID]);
  return result.rows[0]?.acquired === true;
}

async function releaseAdvisoryLock(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_unlock($1);", [ADVISORY_LOCK_ID]);
}

/** Runs one retention sweep. Returns the number of purged rows, or null if skipped/failed. */
export async function runAuditLogRetentionPurge(): Promise<number | null> {
  let locked = false;
  let lockClient: PoolClient | null = null;

  try {
    lockClient = await db.pool.connect();
    locked = await acquireAdvisoryLock(lockClient);
    if (!locked) return null;

    const result = await lockClient.query(PURGE_EXPIRED_AUDIT_EVENTS_SQL);
    const deletedCount = Number(result.rows[0]?.deleted_count ?? 0);

    if (deletedCount > 0) {
      log(`Purged ${deletedCount} audit log entr${deletedCount === 1 ? "y" : "ies"} past retention.`);
    }
    return deletedCount;
  } catch (error) {
    log_error(error);
    return null;
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

export function startAuditLogRetentionJob() {
  log("(cron) Audit log retention job ready.");
  const job = new CronJob(TIME, () => void runAuditLogRetentionPurge(), null, true);
  job.start();
}
