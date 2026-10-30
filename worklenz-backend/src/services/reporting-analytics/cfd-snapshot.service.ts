import db from "../../config/db";
import { STATUS_HISTORY_RETENTION_MONTHS } from "../../shared/reporting-analytics.constants";

function toDateString(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcYesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function eachDateInclusive(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Upsert EOD-style counts from live task statuses for a snapshot date
 * (archived tasks excluded). Deletes existing rows for the targeted projects
 * on that date first so statuses with zero current tasks cannot retain stale counts.
 */
export async function captureSnapshotsForDate(
  snapshotDate: string,
  projectIds?: string[]
): Promise<number> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const params: unknown[] = [snapshotDate];
    let projectFilter = "";
    let deleteFilter = "snapshot_date = $1::DATE";
    if (projectIds && projectIds.length > 0) {
      params.push(projectIds);
      projectFilter = `AND t.project_id = ANY($${params.length}::UUID[])`;
      deleteFilter += ` AND project_id = ANY($2::UUID[])`;
    }

    await client.query(
      `DELETE FROM cfd_daily_snapshots WHERE ${deleteFilter}`,
      params
    );

    const result = await client.query(
      `
      INSERT INTO cfd_daily_snapshots (project_id, snapshot_date, status_id, issue_count)
      SELECT t.project_id,
             $1::DATE,
             t.status_id,
             COUNT(*)::INT
      FROM tasks t
      WHERE t.archived IS FALSE
        AND t.status_id IS NOT NULL
        AND t.parent_task_id IS NULL
        ${projectFilter}
      GROUP BY t.project_id, t.status_id
      ON CONFLICT (project_id, snapshot_date, status_id)
      DO UPDATE SET
        issue_count = EXCLUDED.issue_count,
        created_at = CURRENT_TIMESTAMP
      RETURNING id
      `,
      params
    );

    await client.query("COMMIT");
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Upsert today's EOD-style counts from live task statuses (archived tasks excluded).
 */
export async function captureTodaySnapshots(
  projectIds?: string[]
): Promise<number> {
  return captureSnapshotsForDate(utcToday(), projectIds);
}

/** Capture the previous UTC day's final counts (used by the 00:15 UTC cron). */
export async function captureYesterdaySnapshots(
  projectIds?: string[]
): Promise<number> {
  return captureSnapshotsForDate(utcYesterday(), projectIds);
}

/**
 * Reconstruct EOD counts for missing dates from task_status_history in one query.
 * Gap detection is per (project_id, date) so a date covered by one project does
 * not suppress backfill for another.
 */
export async function backfillRange(
  projectIds: string[],
  from: string,
  to: string
): Promise<number> {
  if (projectIds.length === 0) return 0;

  const fromDate = toDateString(from);
  const toDate = toDateString(to);
  if (fromDate > toDate) return 0;

  const existing = await db.query(
    `
    SELECT project_id::TEXT AS project_id, snapshot_date::TEXT AS snapshot_date
    FROM cfd_daily_snapshots
    WHERE project_id = ANY($1::UUID[])
      AND snapshot_date >= $2::DATE
      AND snapshot_date <= $3::DATE
    `,
    [projectIds, fromDate, toDate]
  );

  const have = new Set(
    (existing.rows as Array<{ project_id: string; snapshot_date: string }>).map(
      r => `${r.project_id}|${toDateString(r.snapshot_date)}`
    )
  );

  const allDates = eachDateInclusive(fromDate, toDate);
  const missingPairs: Array<{ project_id: string; day: string }> = [];
  for (const projectId of projectIds) {
    for (const day of allDates) {
      if (!have.has(`${projectId}|${day}`)) {
        missingPairs.push({ project_id: projectId, day });
      }
    }
  }
  if (missingPairs.length === 0) return 0;

  const missingProjectIds = [...new Set(missingPairs.map(p => p.project_id))];
  const missingDates = [...new Set(missingPairs.map(p => p.day))];

  // Fast path: if nothing in history for these projects, skip heavy reconstruct.
  const historyCheck = await db.query(
    `
    SELECT 1
    FROM task_status_history h
    WHERE h.project_id = ANY($1::UUID[])
    LIMIT 1
    `,
    [missingProjectIds]
  );
  if ((historyCheck.rowCount ?? 0) === 0) {
    return 0;
  }

  const result = await db.query(
    `
    WITH days AS (
      SELECT unnest($2::DATE[]) AS day
    ),
    projects AS (
      SELECT unnest($1::UUID[]) AS project_id
    ),
    needed AS (
      SELECT p.project_id, d.day
      FROM projects p
      CROSS JOIN days d
    )
    INSERT INTO cfd_daily_snapshots (project_id, snapshot_date, status_id, issue_count)
    SELECT h.project_id,
           n.day,
           h.status_id,
           COUNT(DISTINCT h.task_id)::INT
    FROM needed n
    INNER JOIN task_status_history h
      ON h.project_id = n.project_id
     AND h.entered_at <= (n.day + INTERVAL '1 day' - INTERVAL '1 millisecond')
     AND (h.exited_at IS NULL OR h.exited_at > (n.day + INTERVAL '1 day' - INTERVAL '1 millisecond'))
    INNER JOIN tasks t ON t.id = h.task_id
    WHERE t.archived IS FALSE
      AND t.parent_task_id IS NULL
    GROUP BY h.project_id, n.day, h.status_id
    ON CONFLICT (project_id, snapshot_date, status_id)
    DO UPDATE SET
      issue_count = EXCLUDED.issue_count,
      created_at = CURRENT_TIMESTAMP
    RETURNING id
    `,
    [missingProjectIds, missingDates]
  );

  return result.rowCount ?? 0;
}

/** Drop snapshot rows older than retention window. */
export async function pruneOldSnapshots(): Promise<number> {
  const result = await db.query(
    `
    DELETE FROM cfd_daily_snapshots
    WHERE snapshot_date < (CURRENT_DATE - ($1::INT || ' months')::INTERVAL)
    `,
    [STATUS_HISTORY_RETENTION_MONTHS]
  );
  return result.rowCount ?? 0;
}

export async function runCfdDailySnapshotJob(): Promise<{
  captured: number;
  pruned: number;
}> {
  // At 00:15 UTC, capture yesterday's final counts.
  const captured = await captureYesterdaySnapshots();
  const pruned = await pruneOldSnapshots();
  return { captured, pruned };
}
