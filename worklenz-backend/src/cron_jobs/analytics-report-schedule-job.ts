import { CronJob } from "cron";
import sanitizeHtmlLib from "sanitize-html";
import db from "../config/db";
import { sendEmail } from "../shared/email";
import { log_error } from "../shared/utils";
import { buildLiveScheduleExport } from "../services/reporting-analytics/analytics-schedule-export.service";
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

function escapeHtml(value: string): string {
  return sanitizeHtmlLib(value, { allowedTags: [], allowedAttributes: {} });
}

function buildEmailHtml(schedule: AnalyticsScheduleRow): string {
  const safeName = escapeHtml(schedule.report_name);
  const custom =
    schedule.message && schedule.message.trim()
      ? `<p style="white-space:pre-wrap;margin:16px 0 0">${escapeHtml(
          schedule.message.trim()
        )}</p>`
      : "";

  return `
    <div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#262626;line-height:1.5">
      <p style="margin:0 0 8px">Your scheduled Worklenz report is attached.</p>
      <p style="margin:0"><strong>${safeName}</strong></p>
      <p style="margin:8px 0 0;color:#595959">
        This file was generated with your saved filters against live data at send time.
      </p>
      ${custom}
    </div>
  `.trim();
}

async function processSchedule(schedule: AnalyticsScheduleRow): Promise<boolean> {
  const exportFile = await buildLiveScheduleExport({
    reportKind: schedule.report_kind,
    reportName: schedule.report_name,
    ownerId: schedule.owner_id,
    teamId: schedule.team_id,
    format: schedule.format,
    filtersJson: schedule.filters_json,
  });

  const result = await sendEmail({
    to: schedule.recipients,
    subject: `Scheduled report: ${schedule.report_name}`,
    html: buildEmailHtml(schedule),
    attachments: [
      {
        filename: exportFile.filename,
        content: exportFile.content,
        contentType: exportFile.contentType,
      },
    ],
  });

  if (!result) {
    throw new Error("Email send returned no message id");
  }

  const updated = await markScheduleSent(schedule, new Date());
  return !!updated;
}

export async function onAnalyticsReportScheduleTick(): Promise<void> {
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

export function startAnalyticsReportScheduleJob(): void {
  log("Analytics report schedule job ready.");
  new CronJob(
    SCHEDULE,
    () => void onAnalyticsReportScheduleTick(),
    () => log("Analytics report schedule tick complete."),
    true
  );
}
