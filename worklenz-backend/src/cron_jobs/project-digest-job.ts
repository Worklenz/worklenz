import {CronJob} from "cron";
import db from "../config/db";
import {log_error} from "../shared/utils";
import {getBaseUrl} from "./helpers";
import {IProjectDigest, IProjectDigestTask} from "../interfaces/project-digest";
import {sendProjectDailyDigest} from "../shared/email-notifications";

// At 11:00+00 (4.30pm+530) on every day-of-month if it's on every day-of-week from Monday through Friday.
const TIME = "0 11 */1 * 1-5";
// const TIME = "0/10 * * * *";

// const TIME = "* * * * *";

const log = (value: any) => console.log("project-digest-cron-job:", value);
let isRunning = false;

function updateTaskUrls(projectId: string, tasks: IProjectDigestTask[]) {
  const baseUrl = getBaseUrl();
  for (const task of tasks) {
    task.url = `${baseUrl}/worklenz/projects/${projectId}?tab=tasks-list&task=${task.id}`;
  }
}

function updateMetadata(project: IProjectDigest, subscriberName: string) {
  project.greeting = `Hi ${subscriberName},`;
  project.summary = `Here's the "${project.name}" summary | ${project.team_name}`;
  project.settings_url = `${getBaseUrl()}/worklenz/settings/notifications`;
  project.project_url = `${getBaseUrl()}/worklenz/projects/${project.id}?tab=tasks-list`;
}

async function onProjectDigestJobTick() {
  if (isRunning) {
    log("(cron) Previous project digest job is still running, skipping tick.");
    return;
  }

  let hasLock = false;
  isRunning = true;
  try {
    const lockResult = await db.query("SELECT pg_try_advisory_lock(hashtext($1)) AS locked;", ["worklenz-project-digest"]);
    hasLock = !!lockResult.rows[0]?.locked;
    if (!hasLock) {
      log("(cron) Another instance is running project digest job, skipping tick.");
      return;
    }

    log("(cron) Daily digest job started.");
    const q = "SELECT get_project_daily_digest() AS digest;";
    const result = await db.query(q, []);
    const [fn] = result.rows;

    const dataset: IProjectDigest[] = fn.digest || [];

    let sentCount = 0;

    for (const project of dataset) {
      if (!project.today_completed?.length && !project.today_new?.length && !project.due_tomorrow?.length) continue;

      for (const subscriber of project.subscribers) {
        updateMetadata(project, subscriber.name);

        updateTaskUrls(project.id, project.today_completed);
        updateTaskUrls(project.id, project.today_new);
        updateTaskUrls(project.id, project.due_tomorrow);

        if (subscriber.email) {
          sentCount++;
          await sendProjectDailyDigest(subscriber.email, project);
        }
      }
    }

    log(`(cron) Project digest job ended with ${sentCount} emails.`);
  } catch (error) {
    log_error(error);
    log("(cron) Project digest job ended with errors.");
  } finally {
    if (hasLock) {
      try {
        await db.query("SELECT pg_advisory_unlock(hashtext($1));", ["worklenz-project-digest"]);
      } catch (error) {
        log_error(error);
      }
    }
    isRunning = false;
  }
}

export function startProjectDigestJob() {
  log("(cron) Project digest job ready.");
  const job = new CronJob(
    TIME,
    () => void onProjectDigestJobTick(),
    () => log("(cron) Project Digest job successfully executed."),
    true
  );
  job.start();
}
