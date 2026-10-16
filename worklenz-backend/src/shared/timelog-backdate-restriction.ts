import momentTime from "moment-timezone";

import db from "../config/db";

/**
 * Server-side enforcement for the `timelog_backdate_limit_days` organization setting.
 *
 * The limit caps how far back a manual time log may be dated. `0` means unlimited,
 * which is the default for every organization, so this is a no-op until an owner or
 * admin opts in from Settings → Configuration.
 *
 * The comparison is done on calendar days in the *logging user's* timezone, not on an
 * exact 168-hour window, so "7 days" reads the way people expect: a log dated exactly
 * 7 calendar days ago is accepted, 8 days ago is not, regardless of the time of day.
 *
 * These helpers mirror the frontend `DatePicker` bounds in `time-log-form.tsx` so the
 * UI-disabled dates cannot be bypassed via direct API calls.
 */

interface BackdateContext {
  limitDays: number;
  timezone: string;
  existingCreatedAt: string | null;
}

async function getBackdateContext(
  userId: string,
  teamId: string,
  workLogId?: string | null,
  canEditOthersLogs = false
): Promise<BackdateContext | null> {
  const q = `
    SELECT
      COALESCE((SELECT o.timelog_backdate_limit_days
                FROM organizations o
                WHERE o.user_id = (SELECT user_id FROM teams WHERE id = $2 LIMIT 1)
                LIMIT 1), 0)                                            AS limit_days,
      COALESCE((SELECT tz.name FROM timezones tz WHERE tz.id = u.timezone_id), 'UTC') AS timezone,
      (SELECT twl.created_at
       FROM task_work_log twl
       WHERE twl.id = $3::uuid
         AND (twl.user_id = $1
              OR ($4::boolean AND EXISTS (
                    SELECT 1
                    FROM tasks t
                    INNER JOIN projects p ON p.id = t.project_id
                    WHERE t.id = twl.task_id AND p.team_id = $2::uuid))))  AS existing_created_at
    FROM users u
    WHERE u.id = $1
    LIMIT 1;
  `;
  const result = await db.query(q, [userId, teamId, workLogId || null, canEditOthersLogs]);
  const [row] = result.rows;
  if (!row) return null;

  return {
    limitDays: Number(row.limit_days) || 0,
    timezone: row.timezone || "UTC",
    existingCreatedAt: row.existing_created_at || null,
  };
}

/**
 * Returns a rejection message when `startDate` is dated further back than the
 * organization allows, or `null` when the log is acceptable.
 *
 * When `workLogId` is supplied (an edit), a log whose date is unchanged is always
 * allowed through — otherwise an entry that ages past the limit would become
 * impossible to correct, even for its description or duration. That exemption covers
 * the caller's own logs and, only when `canEditOthersLogs` is true (used solely by the
 * Time Entries page's owner/admin edit route, decided server-side), any log in their team,
 * so an admin can fix a member's old entry. With the flag off (the default, and what the
 * task drawer's route uses) behaviour is exactly the original: the caller's own logs only.
 *
 * Fails open (returns `null`) on any error so a transient DB issue never blocks
 * legitimate time logging.
 */
export async function getBackdateViolation(
  startDate?: string | null,
  userId?: string | null,
  teamId?: string | null,
  workLogId?: string | null,
  canEditOthersLogs = false
): Promise<string | null> {
  if (!startDate || !userId || !teamId) return null;

  try {
    const context = await getBackdateContext(userId, teamId, workLogId, canEditOthersLogs);
    if (!context || context.limitDays <= 0) return null;

    const { limitDays, timezone, existingCreatedAt } = context;

    const logDay = momentTime.tz(startDate, timezone).startOf("day");
    if (!logDay.isValid()) return null;

    const cutoff = momentTime.tz(timezone).startOf("day").subtract(limitDays, "days");
    if (!logDay.isBefore(cutoff)) return null;

    // Editing an existing old log without moving its date stays allowed.
    if (existingCreatedAt) {
      const existingDay = momentTime.tz(existingCreatedAt, timezone).startOf("day");
      if (existingDay.isSame(logDay)) return null;
    }

    const unit = limitDays === 1 ? "day" : "days";
    return `Time logs cannot be backdated more than ${limitDays} ${unit}. The earliest date you can log against is ${cutoff.format("MMM DD, YYYY")}.`;
  } catch (error) {
    return null;
  }
}
