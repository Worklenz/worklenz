import axios from "axios";
import { randomBytes } from "crypto";
import db from "../config/db";
import { EncryptionService } from "./encryption.service";
import moment from "moment-timezone";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_URL = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_ID = "primary";

interface GoogleTokenResponse { access_token: string; refresh_token?: string; expires_in: number; }
interface GoogleEvent { id: string; summary?: string; description?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; status?: string; }
interface GoogleEventsResponse { items?: GoogleEvent[]; nextPageToken?: string; }

const getConfig = () => {
  const { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_CALLBACK_URL } = process.env;
  if (!GOOGLE_CALENDAR_CLIENT_ID || !GOOGLE_CALENDAR_CLIENT_SECRET || !GOOGLE_CALENDAR_CALLBACK_URL) {
    throw new Error("Google Calendar integration is not configured. Set GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET and GOOGLE_CALENDAR_CALLBACK_URL.");
  }
  return { clientId: GOOGLE_CALENDAR_CLIENT_ID, clientSecret: GOOGLE_CALENDAR_CLIENT_SECRET, callbackUrl: GOOGLE_CALENDAR_CALLBACK_URL };
};

const toDateTime = (value?: { dateTime?: string; date?: string }, timeZone?: string) => {
  if (!value) return null;
  if (value.dateTime) return value.dateTime;
  if (!value.date) return null;
  // All-day events have no time component. Anchor them at 9am in the calendar's
  // own time zone (rather than a hardcoded UTC offset) so the imported task's
  // date doesn't shift for users outside UTC.
  return moment.tz(value.date, timeZone || "UTC").hour(9).minute(0).second(0).millisecond(0).toISOString();
};

export const buildAllDayCalendarEvent = (task: { name: string; description?: string | null; end_date: string | Date }, timeZone = "UTC") => {
  const dueDate = moment(task.end_date).tz(timeZone).format("YYYY-MM-DD");
  const endDate = moment(task.end_date).tz(timeZone).add(1, "day").format("YYYY-MM-DD");
  return {
    summary: task.name,
    description: task.description || "Worklenz task",
    start: { date: dueDate },
    end: { date: endDate },
  };
};

export class GoogleCalendarService {
  public static createAuthorizationUrl(userId: string, stateStore: Record<string, unknown>) {
    const config = getConfig();
    const state = randomBytes(32).toString("hex");
    stateStore.googleCalendarOAuthState = state;
    stateStore.googleCalendarOAuthUserId = userId;
    return `${GOOGLE_AUTH_URL}?${new URLSearchParams({
      client_id: config.clientId, redirect_uri: config.callbackUrl, response_type: "code",
      access_type: "offline", prompt: "consent", scope: CALENDAR_SCOPE, state,
    }).toString()}`;
  }

  public static async connect(code: string) {
    const config = getConfig();
    const response = await axios.post<GoogleTokenResponse>(GOOGLE_TOKEN_URL, new URLSearchParams({
      code, client_id: config.clientId, client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl, grant_type: "authorization_code",
    }).toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    if (!response.data.refresh_token) throw new Error("Google did not return a refresh token. Revoke the existing Worklenz permission and reconnect.");
    return response.data.refresh_token;
  }

  private static async getAccessToken(userId: string) {
    const result = await db.query("SELECT google_calendar_refresh_token FROM users WHERE id = $1", [userId]);
    const encryptedToken = result.rows[0]?.google_calendar_refresh_token;
    if (!encryptedToken) throw new Error("Google Calendar is not connected");
    const config = getConfig();
    const refreshToken = EncryptionService.decrypt(encryptedToken);
    try {
      const response = await axios.post<GoogleTokenResponse>(GOOGLE_TOKEN_URL, new URLSearchParams({
        client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token",
      }).toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      return response.data.access_token;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 400 || status === 401) {
        await db.query("UPDATE users SET google_calendar_refresh_token = NULL, google_calendar_connected_at = NULL WHERE id = $1", [userId]);
        throw new Error("Google Calendar authorization has expired or been revoked. Please reconnect your Google account.");
      }
      throw error;
    }
  }

  private static async request<T>(userId: string, method: "get" | "post" | "patch" | "delete", path: string, data?: unknown, params?: Record<string, string>) {
    const accessToken = await this.getAccessToken(userId);
    const response = await axios.request<T>({ method, url: `${GOOGLE_CALENDAR_URL}${path}`, headers: { Authorization: `Bearer ${accessToken}` }, data, params });
    return response.data;
  }

  private static async getCalendarTimeZone(userId: string): Promise<string> {
    try {
      const calendar = await this.request<{ timeZone?: string }>(userId, "get", `/calendars/${CALENDAR_ID}`);
      return calendar.timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }

  public static async sync(userId: string, teamId: string, projectId?: string, publishWorklenzTasks = true) {
    const timeZone = await this.getCalendarTimeZone(userId);
    const events: GoogleEvent[] = [];
    let pageToken: string | undefined;
    do {
      const response = await this.request<GoogleEventsResponse>(userId, "get", `/calendars/${CALENDAR_ID}/events`, undefined, {
        timeMin: new Date(Date.now() - 30 * 86400000).toISOString(), timeMax: new Date(Date.now() + 365 * 86400000).toISOString(),
        singleEvents: "true", orderBy: "startTime", maxResults: "2500", showDeleted: "true", ...(pageToken ? { pageToken } : {}),
      });
      events.push(...(response.items || [])); pageToken = response.nextPageToken;
    } while (pageToken);

    const projectResult = await db.query(`SELECT p.id, p.name,
      (SELECT id FROM task_statuses WHERE project_id = p.id ORDER BY sort_order LIMIT 1) AS status_id
      FROM projects p LEFT JOIN project_members pm ON pm.project_id = p.id LEFT JOIN team_members tm ON tm.id = pm.team_member_id
      WHERE p.team_id = $1 AND (p.owner_id = $2 OR tm.user_id = $2) AND ($3::UUID IS NULL OR p.id = $3::UUID)
      ORDER BY p.created_at LIMIT 1`, [teamId, userId, projectId || null]);
    const project = projectResult.rows[0];
    if (!project) throw new Error("You need access to a project before importing calendar meetings");

    let imported = 0, updated = 0, removed = 0;
    for (const event of events) {
      if (!event.id) continue;
      const existing = await db.query(`SELECT task_id, sync_direction FROM google_calendar_task_links WHERE user_id = $1 AND google_event_id = $2`, [userId, event.id]);
      if (existing.rowCount) {
        const link = existing.rows[0];
        if (link.sync_direction === "google_to_worklenz") {
          if (event.status === "cancelled" || !event.summary) {
            await db.query("DELETE FROM tasks WHERE id = $1", [link.task_id]);
            removed++;
          } else {
            const start = toDateTime(event.start, timeZone);
            const end = toDateTime(event.end, timeZone) || start;
            await db.query(`UPDATE tasks SET name = $1, description = $2, start_date = $3, end_date = $4, updated_at = NOW() WHERE id = $5`,
              [event.summary.slice(0, 255), event.description || "Imported from Google Calendar", start, end, link.task_id]);
            await db.query("UPDATE google_calendar_task_links SET last_synced_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND task_id = $2", [userId, link.task_id]);
            updated++;
          }
        }
        continue;
      }
      if (event.status === "cancelled" || !event.summary) continue;
      const start = toDateTime(event.start, timeZone); const end = toDateTime(event.end, timeZone) || start;
      if (!start) continue;
      const taskResult = await db.query("SELECT create_task($1) AS task", [JSON.stringify({
        name: event.summary.slice(0, 255), description: event.description || "Imported from Google Calendar", project_id: project.id,
        team_id: teamId, reporter_id: userId, status_id: project.status_id, start, end, assignees: [], attachments: [], labels: [],
      })]);
      const taskId = taskResult.rows[0]?.task?.id; if (!taskId) continue;
      await db.query(`INSERT INTO google_calendar_task_links (user_id, task_id, google_event_id, calendar_id, sync_direction)
        VALUES ($1, $2, $3, $4, 'google_to_worklenz') ON CONFLICT DO NOTHING`, [userId, taskId, event.id, CALENDAR_ID]);
      imported++;
    }
    const pushed = publishWorklenzTasks ? await this.pushDueDates(userId) : 0;
    return { imported, updated, removed, pushed };
  }

  /**
   * Publish only Worklenz-originated tasks. Imported Google meetings are never overwritten.
   *
   * The LEFT JOIN below intentionally does NOT filter by sync_direction: a task can have at
   * most one google_calendar_task_links row (unique on user_id, task_id), so we need to see
   * that row regardless of direction in order to tell the two cases apart. The WHERE clause
   * then excludes any task whose existing link is 'google_to_worklenz' (i.e. it originated as
   * an imported meeting) — those must never be re-published as a new/duplicate calendar event.
   * Tasks with no link at all, or with an existing 'worklenz_to_google' link, are eligible.
   */
  public static async pushDueDates(userId: string, onlyChangedSince?: Date) {
    const timeZone = await this.getCalendarTimeZone(userId);
    const tasks = await db.query(`SELECT t.id, t.name, t.description, t.end_date, t.updated_at, l.google_event_id
      FROM tasks t INNER JOIN projects p ON p.id = t.project_id
      LEFT JOIN google_calendar_task_links l ON l.task_id = t.id AND l.user_id = $1
      WHERE t.end_date IS NOT NULL AND ($2::TIMESTAMPTZ IS NULL OR t.updated_at > $2)
      AND (l.sync_direction IS NULL OR l.sync_direction = 'worklenz_to_google')
      AND (t.reporter_id = $1 OR p.owner_id = $1 OR EXISTS (SELECT 1 FROM tasks_assignees ta INNER JOIN team_members assigned_tm ON assigned_tm.id = ta.team_member_id WHERE ta.task_id = t.id AND assigned_tm.user_id = $1))
      LIMIT 1000`, [userId, onlyChangedSince || null]);
    let pushed = 0;
    for (const task of tasks.rows) {
      const body = buildAllDayCalendarEvent(task, timeZone);
      let eventId = task.google_event_id;
      if (eventId) {
        await this.request(userId, "patch", `/calendars/${CALENDAR_ID}/events/${encodeURIComponent(eventId)}`, body);
      } else {
        const event = await this.request<GoogleEvent>(userId, "post", `/calendars/${CALENDAR_ID}/events`, body);
        eventId = event.id;
        await db.query(`INSERT INTO google_calendar_task_links (user_id, task_id, google_event_id, calendar_id, sync_direction)
          VALUES ($1, $2, $3, $4, 'worklenz_to_google') ON CONFLICT (user_id, task_id) DO UPDATE SET google_event_id = EXCLUDED.google_event_id, sync_direction = 'worklenz_to_google'`, [userId, task.id, eventId, CALENDAR_ID]);
      }
      await db.query("UPDATE google_calendar_task_links SET last_synced_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND task_id = $2", [userId, task.id]);
      pushed++;
    }
    return pushed;
  }

  /**
   * Delete a Google Calendar event linked to a Worklenz-originated task.
   * Imported Google meetings are intentionally left untouched.
   */
  public static async deleteLinkedEvent(userId: string, taskId: string): Promise<boolean> {
    const result = await db.query(
      `SELECT google_event_id, sync_direction
       FROM google_calendar_task_links
       WHERE user_id = $1 AND task_id = $2
       LIMIT 1`,
      [userId, taskId],
    );
    const link = result.rows[0];
    if (!link?.google_event_id || link.sync_direction !== "worklenz_to_google") return false;

    // If the account is no longer connected, there is no remote event we can
    // safely delete. The local task deletion should still be allowed.
    const connected = await db.query(
      `SELECT google_calendar_refresh_token FROM users WHERE id = $1`,
      [userId],
    );
    if (!connected.rows[0]?.google_calendar_refresh_token) return false;

    try {
      await this.request(
        userId,
        "delete",
        `/calendars/${CALENDAR_ID}/events/${encodeURIComponent(link.google_event_id)}`,
      );
    } catch (error: any) {
      const status = error?.response?.status;
      // A missing event is already in the desired remote state.
      if (status !== 404) {
        console.error(`[Google Calendar] failed to delete event for task ${taskId}:`, error?.message || error);
        throw error;
      }
    }

    await db.query(
      `DELETE FROM google_calendar_task_links WHERE user_id = $1 AND task_id = $2`,
      [userId, taskId],
    );
    return true;
  }
}
