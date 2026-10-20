import { CronJob } from "cron";
import { PoolClient } from "pg";

import db from "../config/db";
import { log_error } from "../shared/utils";
import { deleteObject, getProjectFileStorageKey } from "../shared/storage";

// Run every 15 minutes by default. Overridable for testing.
const TIME = process.env.PROJECT_FILES_CLEANUP_INTERVAL || "*/15 * * * *";

// Pending presign records older than this are considered orphaned. Must be at
// least as long as the presigned URL validity (15 min) plus the confirm grace
// window (PRESIGN_EXPIRY_MS, 20 min in the controller) so we never delete a
// record a slow-but-legitimate upload is still working through.
const STALE_PENDING_MINUTES = 30;

// Cap how many orphans we touch per tick so a large backlog can't block the DB.
const MAX_CLEANUP_PER_TICK = 200;

// Advisory lock ID to prevent concurrent execution across instances.
const ADVISORY_LOCK_ID = 900200;

const log = (value: string) => console.log("project-files-cleanup-job:", value);

async function acquireAdvisoryLock(client: PoolClient): Promise<boolean> {
  const result = await client.query("SELECT pg_try_advisory_lock($1) AS acquired;", [
    ADVISORY_LOCK_ID,
  ]);
  return result.rows[0]?.acquired === true;
}

async function releaseAdvisoryLock(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_unlock($1);", [ADVISORY_LOCK_ID]);
}

/**
 * Client Portal file versions: a "new version" upload that was presigned but never confirmed leaves a
 * pending project_file_versions row and possibly an object. Same rule as pending files. Skipped on a
 * database that has not run the versions migration yet (undefined_table).
 */
async function cleanupStalePendingVersions(client: PoolClient): Promise<void> {
  try {
    const stale = await client.query(
      `SELECT id, storage_key
       FROM project_file_versions
       WHERE status = 'pending'
         AND created_at < (NOW() - ($1 || ' minutes')::interval)
       ORDER BY created_at ASC
       LIMIT $2;`,
      [STALE_PENDING_MINUTES, MAX_CLEANUP_PER_TICK],
    );
    if (!stale.rowCount) return;

    for (const row of stale.rows) void deleteObject(row.storage_key);
    await client.query("DELETE FROM project_file_versions WHERE id = ANY($1::uuid[]);", [
      stale.rows.map((row) => row.id),
    ]);
    log(`Cleaned up ${stale.rowCount} orphaned pending file version record(s).`);
  } catch (error) {
    if ((error as { code?: string })?.code === "42P01") return;
    throw error;
  }
}

/**
 * Client sign-in codes are single use and live 10 minutes, but every request leaves a row (including for
 * addresses with no access) that carries the requesting IP. Purge them a day after they expire or were used.
 * Skipped on a database that has not run the sign-in migration yet (undefined_table).
 */
const SIGN_IN_CODE_RETENTION_HOURS = 24;

async function cleanupSignInCodes(client: PoolClient): Promise<void> {
  try {
    const purged = await client.query(
      `DELETE FROM client_login_codes
        WHERE id IN (
          SELECT id FROM client_login_codes
           WHERE GREATEST(expires_at, COALESCE(consumed_at, expires_at)) < (NOW() - ($1 || ' hours')::interval)
           LIMIT $2)`,
      [SIGN_IN_CODE_RETENTION_HOURS, MAX_CLEANUP_PER_TICK * 10],
    );
    if (purged.rowCount) log(`Purged ${purged.rowCount} expired client sign-in code record(s).`);
  } catch (error) {
    if ((error as { code?: string })?.code === "42P01") return;
    throw error;
  }
}

async function onCleanupTick(): Promise<void> {
  let locked = false;
  let lockClient: PoolClient | null = null;
  try {
    lockClient = await db.pool.connect();
    locked = await acquireAdvisoryLock(lockClient);
    if (!locked) return; // Another instance is already running the cleanup.

    const staleResult = await lockClient.query(
      `SELECT id, team_id, project_id, type
       FROM project_files
       WHERE status = 'pending'
         AND created_at < (NOW() - ($1 || ' minutes')::interval)
       ORDER BY created_at ASC
       LIMIT $2;`,
      [STALE_PENDING_MINUTES, MAX_CLEANUP_PER_TICK],
    );

    if (staleResult.rowCount) {
      const ids: string[] = [];
      for (const row of staleResult.rows) {
        ids.push(row.id);
        // The object may or may not exist (the browser may have uploaded but
        // never confirmed). deleteObject is a no-op/log on a missing key.
        const storageKey = getProjectFileStorageKey(
          row.team_id,
          row.project_id,
          row.id,
          row.type,
        );
        void deleteObject(storageKey);
      }

      await lockClient.query("DELETE FROM project_files WHERE id = ANY($1::uuid[]);", [ids]);

      log(`Cleaned up ${ids.length} orphaned pending upload record(s).`);
    }

    await cleanupStalePendingVersions(lockClient);
    await cleanupSignInCodes(lockClient);
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

export function startProjectFilesCleanupJob() {
  log("(cron) Project files cleanup job ready.");
  const job = new CronJob(TIME, () => void onCleanupTick(), null, true);
  job.start();
}
