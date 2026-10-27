import db from "../../config/db";
import { STATUS_HISTORY_RETENTION_MONTHS } from "../../shared/reporting-analytics.constants";

function toDateString(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
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
 * Upsert today's EOD-style counts from live task statuses (archived tasks excluded).
 */
export async function captureTodaySnapshots(
  projectIds?: string[]
): Promise<number> {
  const snapshotDate = utcToday();
  const params: unknown[] = [snapshotDate];
  let projectFilter = "";
  if (projectIds && projectIds.length > 0) {
    params.push(projectIds);
    projectFilter = `AND t.project_id = ANY($${params.length}::UUID[])`;
  }

  const result = await db.query(
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

  return result.rowCount ?? 0;
}

/**
 * Reconstruct EOD counts for missing dates from task_status_history in one query.
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
    SELECT DISTINCT snapshot_date::TEXT AS snapshot_date
    FROM cfd_daily_snapshots
    WHERE project_id = ANY($1::UUID[])
      AND snapshot_date >= $2::DATE
      AND snapshot_date <= $3::DATE
    `,
    [projectIds, fromDate, toDate]
  );

  const have = new Set(
    (existing.rows as Array<{ snapshot_date: string }>).map(r =>
      toDateString(r.snapshot_date)
    )
  );

  const missing = eachDateInclusive(fromDate, toDate).filter(d => !have.has(d));
  if (missing.length === 0) return 0;

  // Fast path: if nothing in history for these projects, skip heavy reconstruct.
  const historyCheck = await db.query(
    `
    SELECT 1
    FROM task_status_history h
    WHERE h.project_id = ANY($1::UUID[])
    LIMIT 1
    `,
    [projectIds]
  );
  if ((historyCheck.rowCount ?? 0) === 0) {
    return 0;
  }

  const result = await db.query(
    `
    WITH days AS (
      SELECT unnest($2::DATE[]) AS day
    )
    INSERT INTO cfd_daily_snapshots (project_id, snapshot_date, status_id, issue_count)
    SELECT h.project_id,
           d.day,
           h.status_id,
           COUNT(DISTINCT h.task_id)::INT
    FROM days d
    INNER JOIN task_status_history h
      ON h.project_id = ANY($1::UUID[])
     AND h.entered_at <= (d.day + INTERVAL '1 day' - INTERVAL '1 millisecond')
     AND (h.exited_at IS NULL OR h.exited_at > (d.day + INTERVAL '1 day' - INTERVAL '1 millisecond'))
    INNER JOIN tasks t ON t.id = h.task_id
    WHERE t.archived IS FALSE
      AND t.parent_task_id IS NULL
    GROUP BY h.project_id, d.day, h.status_id
    ON CONFLICT (project_id, snapshot_date, status_id)
    DO UPDATE SET
      issue_count = EXCLUDED.issue_count,
      created_at = CURRENT_TIMESTAMP
    RETURNING id
    `,
    [projectIds, missing]
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
  const captured = await captureTodaySnapshots();
  const pruned = await pruneOldSnapshots();
  return { captured, pruned };
}
