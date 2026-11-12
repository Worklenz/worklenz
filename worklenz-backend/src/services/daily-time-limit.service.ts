import { PoolClient } from "pg";
import moment from "moment-timezone";
import { allocateDailyTime, DailyTimeEntry, MAX_CHECKED_TIMER_SECONDS } from "../shared/daily-time-limit";

interface StoredEntry {
  id: string;
  created_at: Date;
  time_spent: string;
  logged_by_timer: boolean;
}

export interface DailyTimeLimitCheckResult {
  allowed: boolean;
  timezone?: string;
  organizationId?: string;
  enforceDailyTimeLimit?: boolean;
  exceededDay?: string;
  previousTotalSeconds?: number;
  newTotalSeconds?: number;
  remainingSeconds?: number;
}

export async function checkDailyTimeLimit(
  client: PoolClient,
  teamId: string,
  userId: string,
  additions: DailyTimeEntry[],
  replacedIds: string[] = []
): Promise<DailyTimeLimitCheckResult> {
  const context = await client.query(
    `SELECT o.id AS organization_id, o.enforce_daily_time_limit,
            COALESCE(tz.name, 'UTC') AS timezone
       FROM teams team
       JOIN organizations o ON o.id = team.organization_id
       JOIN users u ON u.id = $2
       LEFT JOIN timezones tz ON tz.id = u.timezone_id
      WHERE team.id = $1
      LIMIT 1`,
    [teamId, userId]
  );
  const row = context.rows[0];
  if (!row) throw new Error("Unable to resolve time log organization or member");
  if (!row.enforce_daily_time_limit) {
    return {
      allowed: true,
      timezone: row.timezone,
      organizationId: row.organization_id,
      enforceDailyTimeLimit: false,
    };
  }

  const oversizedTimer = additions.find(entry => entry.isTimedSession && entry.seconds > MAX_CHECKED_TIMER_SECONDS);
  if (oversizedTimer) {
    return {
      allowed: false,
      timezone: row.timezone,
      organizationId: row.organization_id,
      enforceDailyTimeLimit: true,
      exceededDay: moment.tz(oversizedTimer.start, row.timezone).format("YYYY-MM-DD"),
      remainingSeconds: 0,
    };
  }

  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `daily-time-limit:${row.organization_id}:${userId}`,
  ]);

  // Removing an entry cannot increase a day's total. Only days touched by the
  // proposed entries need checking, even when an edit moves an existing log.
  const affectedDays = additions.flatMap(entry => Array.from(allocateDailyTime(entry, row.timezone).keys())).sort();
  const relevantDays = new Set(affectedDays);
  if (affectedDays.length === 0) {
    return {
      allowed: true,
      timezone: row.timezone,
      organizationId: row.organization_id,
      enforceDailyTimeLimit: true,
    };
  }
  const rangeStart = moment.tz(affectedDays[0], "YYYY-MM-DD", row.timezone).startOf("day").toDate();
  const rangeEnd = moment.tz(affectedDays[affectedDays.length - 1], "YYYY-MM-DD", row.timezone)
    .add(1, "day").startOf("day").toDate();

  const result = await client.query<StoredEntry>(
    `SELECT wl.id, wl.created_at, wl.time_spent, wl.logged_by_timer
       FROM task_work_log wl
       JOIN tasks t ON t.id = wl.task_id
       JOIN projects p ON p.id = t.project_id
       JOIN teams team ON team.id = p.team_id
      WHERE team.organization_id = $1 AND wl.user_id = $2
        AND wl.created_at < $4
        AND (wl.created_at >= $3 OR
          (wl.logged_by_timer AND wl.created_at + wl.time_spent * INTERVAL '1 second' > $3))`,
    [row.organization_id, userId, rangeStart, rangeEnd]
  );

  const before = new Map<string, number>();
  const after = new Map<string, number>();
  const replaced = new Set(replacedIds);
  const add = (totals: Map<string, number>, entry: DailyTimeEntry) => {
    for (const [date, seconds] of allocateDailyTime(entry, row.timezone, relevantDays)) {
      totals.set(date, (totals.get(date) || 0) + seconds);
    }
  };
  for (const log of result.rows) {
    const entry: DailyTimeEntry = {
      start: log.created_at,
      seconds: Number(log.time_spent),
      isTimedSession: log.logged_by_timer,
    };
    add(before, entry);
    if (!replaced.has(log.id)) add(after, entry);
  }
  for (const entry of additions) add(after, entry);

  for (const [day, next] of after) {
    const prev = before.get(day) || 0;
    if (next > 86400 && next > prev) {
      const remainingSeconds = Math.max(0, 86400 - prev);
      return {
        allowed: false,
        timezone: row.timezone,
        organizationId: row.organization_id,
        enforceDailyTimeLimit: true,
        exceededDay: day,
        previousTotalSeconds: prev,
        newTotalSeconds: next,
        remainingSeconds,
      };
    }
  }

  return {
    allowed: true,
    timezone: row.timezone,
    organizationId: row.organization_id,
    enforceDailyTimeLimit: true,
  };
}

/**
 * Check a proposed replacement while holding an organization/member transaction lock.
 * The caller must perform the write and commit using the same client. Every writer of
 * task_work_log must acquire the same lock for the check to prevent concurrent overruns.
 */
export async function canWriteDailyTime(
  client: PoolClient,
  teamId: string,
  userId: string,
  additions: DailyTimeEntry[],
  replacedIds: string[] = []
): Promise<boolean> {
  const result = await checkDailyTimeLimit(client, teamId, userId, additions, replacedIds);
  return result.allowed;
}

export async function getDailyTimeAllowance(
  client: PoolClient,
  teamId: string,
  userId: string,
  dateOrTimestamp?: string | Date
): Promise<{
  enforce_daily_time_limit: boolean;
  date?: string;
  limit_seconds?: number;
  logged_seconds?: number;
  remaining_seconds?: number | null;
}> {
  const context = await client.query(
    `SELECT o.id AS organization_id, o.enforce_daily_time_limit,
            COALESCE(tz.name, 'UTC') AS timezone
       FROM teams team
       JOIN organizations o ON o.id = team.organization_id
       JOIN users u ON u.id = $2
       LEFT JOIN timezones tz ON tz.id = u.timezone_id
      WHERE team.id = $1
      LIMIT 1`,
    [teamId, userId]
  );
  const row = context.rows[0];
  if (!row) throw new Error("Unable to resolve time log organization or member");
  if (!row.enforce_daily_time_limit) {
    return { enforce_daily_time_limit: false, remaining_seconds: null };
  }

  const targetDay = moment.tz(dateOrTimestamp || new Date(), row.timezone).format("YYYY-MM-DD");
  const rangeStart = moment.tz(targetDay, "YYYY-MM-DD", row.timezone).startOf("day").toDate();
  const rangeEnd = moment.tz(targetDay, "YYYY-MM-DD", row.timezone).add(1, "day").startOf("day").toDate();

  const result = await client.query<StoredEntry>(
    `SELECT wl.id, wl.created_at, wl.time_spent, wl.logged_by_timer
       FROM task_work_log wl
       JOIN tasks t ON t.id = wl.task_id
       JOIN projects p ON p.id = t.project_id
       JOIN teams team ON team.id = p.team_id
      WHERE team.organization_id = $1 AND wl.user_id = $2
        AND wl.created_at < $4
        AND (wl.created_at >= $3 OR
          (wl.logged_by_timer AND wl.created_at + wl.time_spent * INTERVAL '1 second' > $3))`,
    [row.organization_id, userId, rangeStart, rangeEnd]
  );

  let logged_seconds = 0;
  for (const log of result.rows) {
    const entry: DailyTimeEntry = {
      start: log.created_at,
      seconds: Number(log.time_spent),
      isTimedSession: log.logged_by_timer,
    };
    for (const [day, secs] of allocateDailyTime(entry, row.timezone, new Set([targetDay]))) {
      if (day === targetDay) {
        logged_seconds += secs;
      }
    }
  }

  const remaining_seconds = Math.max(0, 86400 - logged_seconds);
  return {
    enforce_daily_time_limit: true,
    date: targetDay,
    limit_seconds: 86400,
    logged_seconds,
    remaining_seconds,
  };
}
