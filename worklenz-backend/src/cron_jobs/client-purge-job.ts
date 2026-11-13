import { CronJob } from "cron";
import { PoolClient } from "pg";

import db from "../config/db";
import { PurgeSummary, runClientPurge } from "../services/client-portal-v2/organization-purge.service";
import { log_error } from "../shared/utils";

/**
 * Retention purge of deleted Client Portal clients: removes what is left of a client organization once its
 * 30-day restore window has ended (see organization-purge.service.ts for exactly what is removed and what
 * is kept).
 *
 * It only reports what it would do until CLIENT_PURGE_ENABLED=true, so enabling the purge is a decision
 * for each deployment (it deletes data), never a side effect of upgrading. Advisory-locked so only one
 * server instance runs a sweep per tick.
 */
const TIME = process.env.CLIENT_PURGE_INTERVAL || "30 3 * * *";
const ADVISORY_LOCK_ID = 900213;

const log = (value: string) => console.log("client-purge-job:", value);

const isExecuteEnabled = (): boolean => process.env.CLIENT_PURGE_ENABLED === "true";

/** Runs one sweep. Returns null when another instance holds the lock or the sweep failed. */
export async function runClientPurgeSweep(): Promise<PurgeSummary | null> {
  let lockClient: PoolClient | null = null;
  let locked = false;

  try {
    lockClient = await db.pool.connect();
    const lock = await lockClient.query("SELECT pg_try_advisory_lock($1) AS acquired;", [ADVISORY_LOCK_ID]);
    locked = lock.rows[0]?.acquired === true;
    if (!locked) return null;

    const execute = isExecuteEnabled();
    const summary = await runClientPurge({ execute });
    if (summary.candidates > 0) {
      log(
        execute
          ? `Purged ${summary.deleted} deleted, ${summary.tombstoned} kept as records (invoices), ${summary.skipped} skipped, ${summary.failed} failed of ${summary.candidates}.`
          : `${summary.candidates} deleted client(s) are past retention. Set CLIENT_PURGE_ENABLED=true to purge them.`
      );
    }
    return summary;
  } catch (error) {
    log_error(error);
    return null;
  } finally {
    if (locked && lockClient) {
      try {
        await lockClient.query("SELECT pg_advisory_unlock($1);", [ADVISORY_LOCK_ID]);
      } catch (error) {
        log_error(error);
      }
    }
    lockClient?.release();
  }
}

export function startClientPurgeJob() {
  log(`(cron) Client purge job ready (${isExecuteEnabled() ? "enabled" : "report only"}).`);
  const job = new CronJob(TIME, () => void runClientPurgeSweep(), null, true);
  job.start();
}
