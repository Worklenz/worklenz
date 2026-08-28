import { CronJob } from "cron";
import moment from "moment-timezone";
import db from "../config/db";
import { log_error } from "../shared/utils";
import {
  resolveUserDigestRoles,
  isAdminInAnyWorkspace,
  isPMInAnyWorkspace,
  getAdminTeamIds,
} from "../services/digest-role-service";
import {
  getAssignedToMeDueToday,
  getAssignedToMeUpcomingTomorrow,
  getAssignedToMeOverdue,
  getAssignedToMeDueThisWeek,
  getAssignedByMeDueToday,
  getAssignedByMeOverdue,
  getAssignedByMeDueThisWeek,
  getAssignedToMeCompletedThisWeek,
  getAssignedToMeStillDueThisWeek,
  getAssignedToMeBecameOverdueThisWeek,
  getAssignedToMeAllTimeOverdueCount,
  getAssignedByMeCompletedThisWeek,
  getAssignedByMeBecameOverdueThisWeek,
  getDailyAdminTeamOverview,
  getWeeklyAdminTeamOverview,
} from "../services/digest-query-service";
import {
  sendDailyTaskReminder,
  sendWeeklyStartSummary,
  sendWeeklyEndSummary,
} from "../shared/email-notifications";
import DigestPreferencesController from "../controllers/digest-preferences-controller";

const SCHEDULE = "* * * * *"; // every minute
const LOCK_KEY = "worklenz-digest-scheduler";
const log = (v: any) => console.log("digest-scheduler:", v);

let isRunning = false;

interface DigestUser {
  id: string;
  email: string;
  name: string;
  tz_name: string;
  timezone_missing: boolean;
  daily_enabled: boolean;
  daily_send_time: string;
  weekly_start_enabled: boolean;
  weekly_start_send_time: string;
  weekly_end_enabled: boolean;
  weekly_end_send_time: string;
}

async function hasSentToday(userId: string, emailType: string, tz: string): Promise<boolean> {
  const result = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM digest_send_log
       WHERE user_id = $1
         AND email_type = $2
         AND skipped = FALSE
         AND DATE(sent_at AT TIME ZONE $3) = DATE(CURRENT_TIMESTAMP AT TIME ZONE $3)
     ) AS found`,
    [userId, emailType, tz]
  );
  return result.rows[0]?.found ?? false;
}

async function logSend(
  userId: string,
  emailType: string,
  workspaceCount: number,
  sectionCount: number,
  skipped: boolean,
  skipReason?: string,
  timezoneMissing = false
): Promise<void> {
  await db.query(
    `INSERT INTO digest_send_log (user_id, email_type, workspace_count, section_count, skipped, skip_reason, timezone_missing)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, emailType, workspaceCount, sectionCount, skipped, skipReason ?? null, timezoneMissing]
  );
}

async function processDaily(user: DigestUser, now: moment.Moment): Promise<void> {
  const tz = user.tz_name;

  if (await hasSentToday(user.id, "daily", tz)) return;

  const roles = await resolveUserDigestRoles(user.id);
  const isAdmin = isAdminInAnyWorkspace(roles);
  const isPM = isPMInAnyWorkspace(roles);
  const adminTeamIds = getAdminTeamIds(roles);
  const workspaceCount = roles.length;

  const [dueToday, upcoming, overdue] = await Promise.all([
    getAssignedToMeDueToday(user.id, tz, workspaceCount),
    getAssignedToMeUpcomingTomorrow(user.id, tz, workspaceCount),
    getAssignedToMeOverdue(user.id, tz, workspaceCount),
  ]);

  const hasPersonalTasks =
    dueToday.totalCount > 0 || upcoming.totalCount > 0 || overdue.totalCount > 0;

  if (!hasPersonalTasks && !isAdmin) {
    await logSend(user.id, "daily", workspaceCount, 0, true, "empty_sections", user.timezone_missing);
    return;
  }

  const [assignedByMeDueToday, assignedByMeOverdue] =
    isPM || isAdmin
      ? await Promise.all([
          getAssignedByMeDueToday(user.id, tz, roles, workspaceCount),
          getAssignedByMeOverdue(user.id, tz, roles, workspaceCount),
        ])
      : [{ tasks: [], totalCount: 0 }, { tasks: [], totalCount: 0 }];

  const adminOverview = isAdmin ? await getDailyAdminTeamOverview(adminTeamIds, tz) : [];

  const unsubToken = await DigestPreferencesController.ensureUnsubscribeToken(user.id);
  let sectionCount = 0;
  if (dueToday.totalCount > 0) sectionCount++;
  if (upcoming.totalCount > 0) sectionCount++;
  if (overdue.totalCount > 0) sectionCount++;
  if (assignedByMeDueToday.totalCount > 0) sectionCount++;
  if (assignedByMeOverdue.totalCount > 0) sectionCount++;
  if (adminOverview.length > 0) sectionCount++;

  await sendDailyTaskReminder(user.email, {
    userName: user.name,
    dueToday,
    upcoming,
    overdue,
    assignedByMeDueToday,
    assignedByMeOverdue,
    adminOverview,
    workspaceCount,
    unsubscribeUrl: DigestPreferencesController.buildUnsubscribeUrl(unsubToken),
    managePreferencesUrl: DigestPreferencesController.buildManagePreferencesUrl(),
  });

  await logSend(user.id, "daily", workspaceCount, sectionCount, false, undefined, user.timezone_missing);
}

async function processWeeklyStart(user: DigestUser, now: moment.Moment): Promise<void> {
  const tz = user.tz_name;
  if (now.day() !== 1) return; // Only Mondays

  if (await hasSentToday(user.id, "weekly_start", tz)) return;

  const roles = await resolveUserDigestRoles(user.id);
  const isAdmin = isAdminInAnyWorkspace(roles);
  const isPM = isPMInAnyWorkspace(roles);
  const adminTeamIds = getAdminTeamIds(roles);
  const workspaceCount = roles.length;

  const [dueToday, dueThisWeek, overdue] = await Promise.all([
    getAssignedToMeDueToday(user.id, tz, workspaceCount, 10),
    getAssignedToMeDueThisWeek(user.id, tz, workspaceCount, 10),
    getAssignedToMeOverdue(user.id, tz, workspaceCount, 10),
  ]);

  const hasPersonalTasks =
    dueToday.totalCount > 0 || dueThisWeek.totalCount > 0 || overdue.totalCount > 0;

  if (!hasPersonalTasks && !isAdmin) {
    await logSend(user.id, "weekly_start", workspaceCount, 0, true, "empty_sections", user.timezone_missing);
    return;
  }

  const [assignedByMeDueToday, assignedByMeDueThisWeek, assignedByMeOverdue] =
    isPM || isAdmin
      ? await Promise.all([
          getAssignedByMeDueToday(user.id, tz, roles, workspaceCount, 10),
          getAssignedByMeDueThisWeek(user.id, tz, roles, workspaceCount, 10),
          getAssignedByMeOverdue(user.id, tz, roles, workspaceCount, 10),
        ])
      : [
          { tasks: [], totalCount: 0 },
          { tasks: [], totalCount: 0 },
          { tasks: [], totalCount: 0 },
        ];

  const adminOverview = isAdmin ? await getWeeklyAdminTeamOverview(adminTeamIds, tz) : [];

  const unsubToken = await DigestPreferencesController.ensureUnsubscribeToken(user.id);
  let sectionCount = 0;
  if (dueToday.totalCount > 0) sectionCount++;
  if (dueThisWeek.totalCount > 0) sectionCount++;
  if (overdue.totalCount > 0) sectionCount++;
  if (assignedByMeDueToday.totalCount > 0) sectionCount++;
  if (assignedByMeDueThisWeek.totalCount > 0) sectionCount++;
  if (assignedByMeOverdue.totalCount > 0) sectionCount++;
  if (adminOverview.length > 0) sectionCount++;

  await sendWeeklyStartSummary(user.email, {
    userName: user.name,
    dueToday,
    dueThisWeek,
    overdue,
    assignedByMeDueToday,
    assignedByMeDueThisWeek,
    assignedByMeOverdue,
    adminOverview,
    workspaceCount,
    unsubscribeUrl: DigestPreferencesController.buildUnsubscribeUrl(unsubToken),
    managePreferencesUrl: DigestPreferencesController.buildManagePreferencesUrl(),
  });

  await logSend(user.id, "weekly_start", workspaceCount, sectionCount, false, undefined, user.timezone_missing);
}

async function processWeeklyEnd(user: DigestUser, now: moment.Moment): Promise<void> {
  const tz = user.tz_name;
  if (now.day() !== 5) return; // Only Fridays

  if (await hasSentToday(user.id, "weekly_end", tz)) return;

  const roles = await resolveUserDigestRoles(user.id);
  const isAdmin = isAdminInAnyWorkspace(roles);
  const isPM = isPMInAnyWorkspace(roles);
  const adminTeamIds = getAdminTeamIds(roles);
  const workspaceCount = roles.length;

  const [completed, stillDue, becameOverdue, allTimeOverdueCount] = await Promise.all([
    getAssignedToMeCompletedThisWeek(user.id, tz, workspaceCount),
    getAssignedToMeStillDueThisWeek(user.id, tz, workspaceCount),
    getAssignedToMeBecameOverdueThisWeek(user.id, tz, workspaceCount),
    getAssignedToMeAllTimeOverdueCount(user.id, tz),
  ]);

  const hasPersonalData =
    completed.totalCount > 0 ||
    stillDue.totalCount > 0 ||
    becameOverdue.totalCount > 0 ||
    allTimeOverdueCount > 0;

  if (!hasPersonalData && !isAdmin) {
    await logSend(user.id, "weekly_end", workspaceCount, 0, true, "empty_sections", user.timezone_missing);
    return;
  }

  const [assignedByMeCompleted, assignedByMeBecameOverdue] =
    isPM || isAdmin
      ? await Promise.all([
          getAssignedByMeCompletedThisWeek(user.id, tz, roles, workspaceCount),
          getAssignedByMeBecameOverdueThisWeek(user.id, tz, roles, workspaceCount),
        ])
      : [{ tasks: [], totalCount: 0 }, { tasks: [], totalCount: 0 }];

  const adminOverview = isAdmin
    ? await getWeeklyAdminTeamOverview(adminTeamIds, tz, true)
    : [];

  const unsubToken = await DigestPreferencesController.ensureUnsubscribeToken(user.id);
  let sectionCount = 0;
  if (completed.totalCount > 0) sectionCount++;
  if (stillDue.totalCount > 0) sectionCount++;
  if (becameOverdue.totalCount > 0) sectionCount++;
  if (allTimeOverdueCount > 0) sectionCount++;
  if (assignedByMeCompleted.totalCount > 0) sectionCount++;
  if (assignedByMeBecameOverdue.totalCount > 0) sectionCount++;
  if (adminOverview.length > 0) sectionCount++;

  await sendWeeklyEndSummary(user.email, {
    userName: user.name,
    completed,
    stillDue,
    becameOverdue,
    allTimeOverdueCount,
    assignedByMeCompleted,
    assignedByMeBecameOverdue,
    adminOverview,
    workspaceCount,
    unsubscribeUrl: DigestPreferencesController.buildUnsubscribeUrl(unsubToken),
    managePreferencesUrl: DigestPreferencesController.buildManagePreferencesUrl(),
  });

  await logSend(user.id, "weekly_end", workspaceCount, sectionCount, false, undefined, user.timezone_missing);
}

export async function onDigestSchedulerTick(): Promise<void> {
  if (isRunning) {
    log("Previous tick still running, skipping.");
    return;
  }

  let hasLock = false;
  isRunning = true;

  try {
    const lockResult = await db.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked;",
      [LOCK_KEY]
    );
    hasLock = !!lockResult.rows[0]?.locked;
    if (!hasLock) {
      log("Another instance holds the lock, skipping tick.");
      return;
    }

    const usersResult = await db.query(
      `SELECT
         u.id, u.email, u.name,
         COALESCE(tz.name, 'UTC') AS tz_name,
         (u.timezone_id IS NULL) AS timezone_missing,
         dp.daily_enabled,          TO_CHAR(dp.daily_send_time, 'HH24:MI') AS daily_send_time,
         dp.weekly_start_enabled,   TO_CHAR(dp.weekly_start_send_time, 'HH24:MI') AS weekly_start_send_time,
         dp.weekly_end_enabled,     TO_CHAR(dp.weekly_end_send_time, 'HH24:MI') AS weekly_end_send_time
       FROM user_digest_preferences dp
       JOIN users u  ON u.id  = dp.user_id
       LEFT JOIN timezones tz ON tz.id = u.timezone_id
       WHERE u.is_deleted = FALSE
         AND (dp.daily_enabled OR dp.weekly_start_enabled OR dp.weekly_end_enabled)`,
      []
    );

    const users = usersResult.rows;
    if (users.length === 0) return;

    let processed = 0;
    for (const user of users) {
      try {
        const now = moment.tz(user.tz_name);
        const currentTime = now.format("HH:mm");

        if (user.weekly_start_enabled && currentTime === user.weekly_start_send_time) {
          await processWeeklyStart(user, now);
          processed++;
        }

        if (user.weekly_end_enabled && currentTime === user.weekly_end_send_time) {
          await processWeeklyEnd(user, now);
          processed++;
        }

        const skipDailyForMondayConflict =
          now.day() === 1 &&
          user.weekly_start_enabled &&
          user.weekly_start_send_time === user.daily_send_time;
        if (user.daily_enabled && currentTime === user.daily_send_time && !skipDailyForMondayConflict) {
          await processDaily(user, now);
          processed++;
        }
      } catch (err) {
        log_error(err);
        log(`Error processing digest for user ${user.id}`);
      }
    }

    if (processed > 0) {
      log(`Tick complete — processed ${processed} digest(s).`);
    }
  } catch (error) {
    log_error(error);
  } finally {
    if (hasLock) {
      try {
        await db.query("SELECT pg_advisory_unlock(hashtext($1));", [LOCK_KEY]);
      } catch (err) {
        log_error(err);
      }
    }
    isRunning = false;
  }
}

export function startDigestScheduler(): void {
  log("Digest scheduler ready.");
  new CronJob(
    SCHEDULE,
    () => void onDigestSchedulerTick(),
    () => log("Digest scheduler tick complete."),
    true
  );
}
