import { CronJob } from "cron";
import { PoolClient } from "pg";

import db from "../config/db";
import { log_error } from "../shared/utils";
import { completeSprintRecord, startSprintRecord } from "../shared/sprint-lifecycle";

// Every 5 minutes by default. Overridable for testing.
const TIME = process.env.SPRINT_AUTO_SCHEDULE_INTERVAL || "*/5 * * * *";

// Advisory lock ID to prevent concurrent execution across instances.
const ADVISORY_LOCK_ID = 900300;

const log = (value: string) => console.log("sprint-auto-schedule-job:", value);

/**
 * Active sprints whose end date has passed in projects that opted in. Unfinished work
 * carries over to the next planned sprint (earliest start), or the backlog if none.
 */
async function completeEndedSprints(client: PoolClient): Promise<number> {
  const due = await client.query(
    `SELECT pp.id, pp.project_id,
            (SELECT next.id
             FROM project_phases next
             WHERE next.project_id = pp.project_id
               AND next.sprint_status = 'planned'
             ORDER BY next.start_date ASC NULLS LAST, next.sort_index ASC
             LIMIT 1) AS next_sprint_id
     FROM project_phases pp
     INNER JOIN projects p ON p.id = pp.project_id
     WHERE p.project_type = 'software'
       AND p.auto_start_complete_sprints IS TRUE
       AND pp.sprint_status = 'active'
       AND pp.end_date IS NOT NULL
       AND pp.end_date <= NOW();`
  );

  let completed = 0;
  for (const sprint of due.rows) {
    try {
      const result = await completeSprintRecord(sprint.project_id, sprint.id, sprint.next_sprint_id ?? null);
      if (result.ok) completed += 1;
      else log(`Skipped completing sprint ${sprint.id}: ${result.error}`);
    } catch (error) {
      log_error(error);
    }
  }
  return completed;
}

/**
 * In opted-in projects with no active sprint, starts the earliest planned sprint whose
 * start date has arrived. Sprints whose end date already passed are left for manual review.
 */
async function startDueSprints(client: PoolClient): Promise<number> {
  const due = await client.query(
    `SELECT DISTINCT ON (pp.project_id) pp.id, pp.project_id
     FROM project_phases pp
     INNER JOIN projects p ON p.id = pp.project_id
     WHERE p.project_type = 'software'
       AND p.auto_start_complete_sprints IS TRUE
       AND pp.sprint_status = 'planned'
       AND pp.start_date IS NOT NULL
       AND pp.start_date <= NOW()
       AND (pp.end_date IS NULL OR pp.end_date > NOW())
       AND NOT EXISTS (
         SELECT 1 FROM project_phases active
         WHERE active.project_id = pp.project_id AND active.sprint_status = 'active'
       )
     ORDER BY pp.project_id, pp.start_date ASC, pp.sort_index ASC;`
  );

  let started = 0;
  for (const sprint of due.rows) {
    try {
      const result = await startSprintRecord(sprint.project_id, sprint.id);
      if (result.ok) started += 1;
      else log(`Skipped starting sprint ${sprint.id}: ${result.error}`);
    } catch (error) {
      log_error(error);
    }
  }
  return started;
}

async function onTick(): Promise<void> {
  let locked = false;
  let lockClient: PoolClient | null = null;
  try {
    lockClient = await db.pool.connect();
    const lock = await lockClient.query("SELECT pg_try_advisory_lock($1) AS acquired;", [ADVISORY_LOCK_ID]);
    locked = lock.rows[0]?.acquired === true;
    if (!locked) return;

    // Complete first so the next sprint can start in the same tick.
    const completed = await completeEndedSprints(lockClient);
    const started = await startDueSprints(lockClient);
    if (completed || started) log(`Completed ${completed} and started ${started} sprint(s).`);
  } catch (error) {
    log_error(error);
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

export function startSprintAutoScheduleJob() {
  log("(cron) Sprint auto start/complete job ready.");
  const job = new CronJob(TIME, () => void onTick(), null, true);
  job.start();
}
