// https://www.npmjs.com/package/cron
// https://crontab.guru/#0_22_*/1_*_*

import {CronJob} from "cron";
import db from "../config/db";
import {ITaskAssignmentsModel} from "../interfaces/task-assignments-model";
import {sendAssignmentUpdate} from "../shared/email-notifications";
import {log_error} from "../shared/utils";
import {getBaseUrl, mapProjects} from "./helpers";

const TIME = "*/10 * * * *";

const log = (value: any) => console.log("notifications-cron-job:", value);
let isRunning = false;

function getModel(model: ITaskAssignmentsModel): ITaskAssignmentsModel {
  const mappedModel: ITaskAssignmentsModel = {...model};

  mappedModel.name = mappedModel.name?.split(" ")[0] || "";
  mappedModel.url = `${getBaseUrl()}/worklenz/team/member/${mappedModel.team_member_id}`;
  mappedModel.settings_url = `${getBaseUrl()}/worklenz/settings/notifications`;

  const teams = [];
  for (const team of model.teams || []) {
    team.projects = mapProjects([team]);
    if (team.projects.length)
      teams.push(team);
  }

  mappedModel.teams = teams;
  return mappedModel;
}

function collectUpdateIds(model: ITaskAssignmentsModel): string[] {
  const updateIds: string[] = [];

  for (const team of model.teams || []) {
    for (const project of team.projects || []) {
      for (const task of project.tasks || []) {
        if (task.update_id) {
          updateIds.push(task.update_id);
        }
      }
    }
  }

  return updateIds;
}

function getMaxAttempts(model: ITaskAssignmentsModel): number {
  let maxAttempts = 0;

  for (const team of model.teams || []) {
    for (const project of team.projects || []) {
      for (const task of project.tasks || []) {
        if (task.attempts !== undefined && task.attempts > maxAttempts) {
          maxAttempts = task.attempts;
        }
      }
    }
  }

  return maxAttempts;
}

async function onNotificationJobTick() {
  if (isRunning) {
    log("(cron) Previous notifications job is still running, skipping tick.");
    return;
  }

  let hasLock = false;
  isRunning = true;
  try {
    const lockResult = await db.query("SELECT pg_try_advisory_lock(hashtext($1)) AS locked;", ["worklenz-email-notifications"]);
    hasLock = !!lockResult.rows[0]?.locked;
    if (!hasLock) {
      log("(cron) Another instance is running notifications job, skipping tick.");
      return;
    }

    log("(cron) Notifications job started.");
    const q = "SELECT get_task_updates() AS updates;";
    const result = await db.query(q, []);
    const [data] = result.rows;
    const updates = (data.updates || []) as ITaskAssignmentsModel[];

    let sentCount = 0;
    let failedCount = 0;
    let maxAttemptsReached = 0;

    for (const item of updates) {
      if (item.email) {
        const model = getModel(item);
        if (model.teams?.length) {
          const updateIds = collectUpdateIds(item);
          if (!updateIds.length) {
            failedCount++;
            log(`(cron) Skipping notification for ${item.email}: no update IDs found to acknowledge.`);
            continue;
          }
          const attempts = getMaxAttempts(item);
          const isSent = await sendAssignmentUpdate(item.email, model, updateIds);
          if (isSent) {
            sentCount++;
          } else {
            failedCount++;
            // Check if this was the last attempt
            if (attempts >= 2) {
              maxAttemptsReached++;
            }
          }
        }
      }
    }

    const logMessage = maxAttemptsReached > 0
      ? `(cron) Notifications job ended with ${sentCount} emails sent, ${failedCount} failed (${maxAttemptsReached} reached max attempts).`
      : `(cron) Notifications job ended with ${sentCount} emails sent, ${failedCount} failed.`;

    log(logMessage);
  } catch (error) {
    log_error(error);
    log("(cron) Notifications job ended with errors.");
  } finally {
    if (hasLock) {
      try {
        await db.query("SELECT pg_advisory_unlock(hashtext($1));", ["worklenz-email-notifications"]);
      } catch (error) {
        log_error(error);
      }
    }
    isRunning = false;
  }
}

export function startNotificationsJob() {
  log("(cron) Email notifications job ready.");
  const job = new CronJob(
    TIME,
    () => void onNotificationJobTick(),
    () => log("(cron) Notifications job successfully executed."),
    true
  );
  job.start();
}
