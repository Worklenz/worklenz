import { CronJob } from "cron";
import db from "../config/db";
import { GoogleCalendarService } from "../services/google-calendar.service";

const TIME = process.env.GOOGLE_CALENDAR_SYNC_INTERVAL || "*/5 * * * *";
let running = false;

export function startGoogleCalendarSyncJob() {
  if (process.env.ENABLE_GOOGLE_CALENDAR_SYNC !== "true") return;

  const job = new CronJob(TIME, async () => {
    if (running) return;
    running = true;
    try {
      let users: { id: string; team_id: string | null }[] = [];
      try {
        const result = await db.query(`
          SELECT u.id, COALESCE(u.active_team, (SELECT id FROM teams WHERE user_id = u.id LIMIT 1)) AS team_id
          FROM users u
          WHERE u.google_calendar_refresh_token IS NOT NULL
        `);
        users = result.rows;
      } catch (error: any) {
        console.error("[Google Calendar Sync] failed to load connected users:", error?.message || error);
        return;
      }
      const changedSince = new Date(Date.now() - 10 * 60 * 1000);
      for (const user of users) {
        if (!user.team_id) continue;
        try {
          // Import Google Calendar changes automatically. The service selects the
          // first project the user can access when no explicit project is supplied.
          // Do not publish all tasks as part of this import pass; the second call
          // publishes only recently changed Worklenz tasks.
          await GoogleCalendarService.sync(user.id, user.team_id, undefined, false);
        } catch (error: any) {
          console.error(`[Google Calendar Sync] import for user ${user.id}:`, error?.message || error);
        }
        try {
          await GoogleCalendarService.pushDueDates(user.id, changedSince);
        } catch (error: any) {
          console.error(`[Google Calendar Sync] push for user ${user.id}:`, error?.message || error);
        }
      }
    } finally {
      running = false;
    }
  });

  job.start();
  console.info(`Google Calendar sync job ready (${TIME}).`);
}
