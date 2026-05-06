import {CronJob} from "cron";
import moment from "moment";
import db from "../config/db";
import {IDailyDigest} from "../interfaces/daily-digest";
import {sendDailyDigest} from "../shared/email-notifications";
import {log_error} from "../shared/utils";
import {getBaseUrl, mapTeams} from "./helpers";

// At 11:00+00 (4.30pm+530) on every day-of-month if it's on every day-of-week from Monday through Friday.
const TIME = "0 11 */1 * 1-5";
// const TIME = "0/30 * * * *";
// const TIME = "* * * * *";

const log = (value: any) => console.log("daily-digest-cron-job:", value);
let isRunning = false;

async function onDailyDigestJobTick() {
  if (isRunning) {
    log("(cron) Previous daily digest job is still running, skipping tick.");
    return;
  }

  let hasLock = false;
  isRunning = true;
  try {
    const lockResult = await db.query("SELECT pg_try_advisory_lock(hashtext($1)) AS locked;", ["worklenz-daily-digest"]);
    hasLock = !!lockResult.rows[0]?.locked;
    if (!hasLock) {
      log("(cron) Another instance is running daily digest job, skipping tick.");
      return;
    }

    log("(cron) Daily digest job started.");
    const q = "SELECT get_daily_digest() AS digest;";
    const result = await db.query(q, []);
    const [fn] = result.rows;

    const dataset: IDailyDigest[] = fn.digest || [];

    let sentCount = 0;

    for (const digest of dataset) {
      digest.greeting = `Hi ${digest.name},`;
      digest.note = `Here's your ${moment().format("dddd")} update!`;
      digest.base_url = `${getBaseUrl()}/worklenz`;
      digest.settings_url = `${getBaseUrl()}/worklenz/settings/notifications`;

      digest.recently_assigned = mapTeams(digest.recently_assigned);
      digest.overdue = mapTeams(digest.overdue);
      digest.recently_completed = mapTeams(digest.recently_completed);

      if (digest.recently_assigned?.length || digest.overdue?.length || digest.recently_completed?.length) {
        sentCount++;
        await sendDailyDigest(digest.email as string, digest);
      }
    }
    log(`(cron) Daily digest job ended with ${sentCount} emails.`);
  } catch (error) {
    log_error(error);
    log("(cron) Daily digest job ended with errors.");
  } finally {
    if (hasLock) {
      try {
        await db.query("SELECT pg_advisory_unlock(hashtext($1));", ["worklenz-daily-digest"]);
      } catch (error) {
        log_error(error);
      }
    }
    isRunning = false;
  }
}

export function startDailyDigestJob() {
  log("(cron) Daily digest job ready.");
  const job = new CronJob(
    TIME,
    () => void onDailyDigestJobTick(),
    () => log("(cron) Daily Digest job successfully executed."),
    true
  );
  job.start();
}
