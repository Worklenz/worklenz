import { CronJob } from "cron";
import { PoolClient } from "pg";

import db from "../config/db";
import { log_error } from "../shared/utils";
import { runCfdDailySnapshotJob } from "../services/reporting-analytics/cfd-snapshot.service";

/** 00:15 UTC daily — captures the previous UTC day's final counts. */
const TIME = process.env.CFD_SNAPSHOT_CRON || "15 0 * * *";
const LOCK_KEY = "worklenz-cfd-daily-snapshot";

const log = (value: string) => console.log("cfd-daily-snapshot-job:", value);

let isRunning = false;

export async function runCfdSnapshotTick(): Promise<void> {
  if (isRunning) {
    log("(cron) Previous CFD snapshot job is still running, skipping tick.");
    return;
  }

  let hasLock = false;
  let lockClient: PoolClient | null = null;
  isRunning = true;

  try {
    lockClient = await db.pool.connect();
    const lockResult = await lockClient.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked;",
      [LOCK_KEY]
    );
    hasLock = !!lockResult.rows[0]?.locked;
    if (!hasLock) {
      log("(cron) Another instance is running CFD snapshot job, skipping tick.");
      return;
    }

    log("(cron) CFD daily snapshot job started.");
    const { captured, pruned } = await runCfdDailySnapshotJob();
    log(`(cron) Captured ${captured} snapshot row(s); pruned ${pruned}.`);
  } catch (error) {
    log_error(error);
  } finally {
    if (hasLock && lockClient) {
      try {
        await lockClient.query("SELECT pg_advisory_unlock(hashtext($1));", [LOCK_KEY]);
      } catch (error) {
        log_error(error);
      }
    }
    lockClient?.release();
    isRunning = false;
  }
}

export function startCfdDailySnapshotJob() {
  log("(cron) CFD daily snapshot job ready (UTC).");
  const job = new CronJob(
    TIME,
    () => void runCfdSnapshotTick(),
    null,
    true,
    "UTC"
  );
  job.start();
}
