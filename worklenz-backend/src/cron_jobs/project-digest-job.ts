import {CronJob} from "cron";
import db from "../config/db";
import {log_error} from "../shared/utils";
import {getBaseUrl} from "./helpers";
import {IProjectDigest, IProjectDigestTask} from "../interfaces/project-digest";
import {sendProjectDailyDigest} from "../shared/email-notifications";

// At 11:00+00 (4.30pm+530) on every day-of-month if it's on every day-of-week from Monday through Friday.
const TIME = "0 11 */1 * 1-5";
// const TIME = "* * * * *";

const log = (value: any) => console.log("project-digest-cron-job:", value);

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
  try {
    log("(cron) Daily digest job started.");
    const q = "SELECT get_project_daily_digest() AS digest;";
    const result = await db.query(q, []);
    const [fn] = result.rows;

    const dataset: IProjectDigest[] = fn.digest || [];

    let sentCount = 0;

    for (const project of dataset) {
      for (const subscriber of project.subscribers) {
        updateMetadata(project, subscriber.name);

        updateTaskUrls(project.id, project.today_completed);
        updateTaskUrls(project.id, project.today_new);
        updateTaskUrls(project.id, project.due_tomorrow);

        if (subscriber.email) {
          sentCount++;
          void sendProjectDailyDigest(subscriber.email, project);
        }
      }
    }

    log(`(cron) Project digest job ended with ${sentCount} emails.`);
  } catch (error) {
    log_error(error);
    log("(cron) Project digest job ended with errors.");
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
