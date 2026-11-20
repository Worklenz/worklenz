import { CronJob } from "cron";
import type { PoolClient } from "pg";
import db from "../config/db";
import { sendEmail } from "../shared/email";
import { log_error } from "../shared/utils";
import { formatScheduleTimeRangeNote } from "../services/reporting-analytics/analytics-schedule-date-bounds";
import { canOwnerSendSchedule } from "../services/reporting-analytics/analytics-schedule-access";
import { buildLiveScheduleExports } from "../services/reporting-analytics/analytics-schedule-export.service";
import {
  AnalyticsScheduleRow,
  bumpScheduleNextSend,
  listDueSchedules,
  markScheduleSent,
} from "../services/reporting-analytics/analytics-schedules.service";

const SCHEDULE = process.env.ANALYTICS_REPORT_SCHEDULE_CRON || "* * * * *";
const LOCK_KEY = "worklenz-analytics-report-schedules";
const MAX_PER_TICK = Math.max(
  1,
  Math.min(50, Number(process.env.ANALYTICS_REPORT_SCHEDULE_MAX_PER_TICK || 10))
);

const log = (value: string) => console.log("analytics-report-schedule-job:", value);

let isRunning = false;

/** Escape text for safe insertion into HTML email bodies. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Best-effort display name from an email local-part when no user match exists. */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() || "";
  if (!local) return "there";
  const spaced = local.replace(/[._+-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return "there";
  return spaced
    .split(" ")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Resolves recipient emails to display names (users table first, else email local-part).
 */
export async function resolveRecipientNames(
  emails: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const normalized = emails
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

  for (const email of normalized) {
    names.set(email, displayNameFromEmail(email));
  }

  if (!normalized.length) return names;

  try {
    const result = await db.query(
      `SELECT LOWER(TRIM(email)) AS email, NULLIF(TRIM(name), '') AS name
       FROM users
       WHERE is_deleted IS FALSE
         AND LOWER(TRIM(email)) = ANY($1::TEXT[])`,
      [normalized]
    );
    for (const row of result.rows as Array<{ email: string; name: string | null }>) {
      if (row.email && row.name) {
        names.set(row.email, row.name);
      }
    }
  } catch (error) {
    log_error(error);
  }

  return names;
}

/**
 * Builds schedule email HTML.
 * - Always greets with "Hi {recipientName},"
 * - Uses the optional custom message when present
 * - Otherwise uses the auto-generated report summary
 */
export function buildEmailHtml(
  schedule: AnalyticsScheduleRow,
  recipientName: string,
  sentAt: Date = new Date()
): string {
  const greeting = `<p style="margin:0 0 12px">Hi ${escapeHtml(recipientName)},</p>`;
  const customMessage = schedule.message?.trim() || "";

  if (customMessage) {
    return `
    <div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#262626;line-height:1.5">
      ${greeting}
      <p style="white-space:pre-wrap;margin:0">${escapeHtml(customMessage)}</p>
    </div>
  `.trim();
  }

  const safeName = escapeHtml(schedule.report_name);
  const timeRange = formatScheduleTimeRangeNote(
    schedule.filters_json,
    schedule.timezone,
    sentAt
  );
  const timeRangeHtml = timeRange
    ? `<p style="margin:8px 0 0;color:#595959"><strong>Time range:</strong> ${escapeHtml(
        timeRange
      )}</p>`
    : "";

  return `
    <div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#262626;line-height:1.5">
      ${greeting}
      <p style="margin:0 0 8px">This is your scheduled Worklenz report. The file is attached.</p>
      <p style="margin:0"><strong>${safeName}</strong></p>
      ${timeRangeHtml}
      <p style="margin:8px 0 0;color:#595959">
        This file was generated with your saved filters against live data at send time.
      </p>
    </div>
  `.trim();
}

async function processSchedule(schedule: AnalyticsScheduleRow): Promise<boolean> {
  // Revalidate create-time gates: View reports + advanced_reporting, and finance
  // gates for Project Health / Budget Tracking, so revoked access cannot keep sending.
  const allowed = await canOwnerSendSchedule(
    schedule.owner_id,
    schedule.team_id,
    schedule.report_kind
  );
  if (!allowed) {
    throw new Error(
      `Authorization missing for schedule ${schedule.id} (${schedule.report_kind})`
    );
  }

  const exportFiles = await buildLiveScheduleExports({
    reportKind: schedule.report_kind,
    reportName: schedule.report_name,
    ownerId: schedule.owner_id,
    teamId: schedule.team_id,
    formats: schedule.formats?.length ? schedule.formats : ["PDF"],
    filtersJson: schedule.filters_json,
    timezone: schedule.timezone,
  });

  const attachments = exportFiles.map(exportFile => ({
    filename: exportFile.filename,
    content: exportFile.content,
    contentType: exportFile.contentType,
  }));

  const recipients = (schedule.recipients || [])
    .map(email => email.trim())
    .filter(Boolean);

  if (!recipients.length) {
    throw new Error("Schedule has no recipients");
  }

  const recipientNames = await resolveRecipientNames(recipients);
  const sentAt = new Date();
  const subject = `Scheduled report: ${schedule.report_name}`;

  // Send per recipient so each email can greet them by name.
  for (const email of recipients) {
    const name =
      recipientNames.get(email.toLowerCase()) || displayNameFromEmail(email);
    const result = await sendEmail({
      to: [email],
      subject,
      html: buildEmailHtml(schedule, name, sentAt),
      attachments,
    });

    if (!result) {
      throw new Error(`Email send returned no message id for ${email}`);
    }
  }

  const updated = await markScheduleSent(schedule, sentAt);
  return !!updated;
}

export async function onAnalyticsReportScheduleTick(): Promise<void> {
  if (isRunning) {
    log("Previous tick still running, skipping.");
    return;
  }

  // Session advisory locks must stay on one pooled client for acquire + release.
  // Using db.query() for both can unlock on a different connection and leave the
  // lock stuck — every later tick then logs "Another instance holds the lock".
  let hasLock = false;
  let lockClient: PoolClient | null = null;
  isRunning = true;

  try {
    lockClient = await db.connect();
    const lockResult = await lockClient.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked;",
      [LOCK_KEY]
    );
    hasLock = !!lockResult.rows[0]?.locked;
    if (!hasLock) {
      log("Another instance holds the lock, skipping tick.");
      return;
    }

    const due = await listDueSchedules(MAX_PER_TICK);
    if (!due.length) return;

    let sent = 0;
    for (const schedule of due) {
      try {
        const ok = await processSchedule(schedule);
        if (ok) sent += 1;
      } catch (error) {
        log_error(error);
        log(`Failed schedule ${schedule.id} (${schedule.report_kind})`);
        try {
          // Avoid tight retry loops on persistent failures.
          await bumpScheduleNextSend(schedule, new Date());
        } catch (bumpError) {
          log_error(bumpError);
        }
      }
    }

    if (sent > 0) {
      log(`Tick complete — sent ${sent} scheduled report(s).`);
    }
  } catch (error) {
    log_error(error);
  } finally {
    if (hasLock && lockClient) {
      try {
        await lockClient.query("SELECT pg_advisory_unlock(hashtext($1));", [LOCK_KEY]);
      } catch (err) {
        log_error(err);
      }
    }
    lockClient?.release();
    isRunning = false;
  }
}

export function startAnalyticsReportScheduleJob(): void {
  log("Analytics report schedule job ready.");
  new CronJob(
    SCHEDULE,
    () => void onAnalyticsReportScheduleTick(),
    () => log("Analytics report schedule tick complete."),
    true
  );
}
