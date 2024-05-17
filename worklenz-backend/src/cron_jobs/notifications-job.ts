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

async function onNotificationJobTick() {
  try {
    log("(cron) Notifications job started.");
    const q = "SELECT get_task_updates() AS updates;";
    const result = await db.query(q, []);
    const [data] = result.rows;
    const updates = (data.updates || []) as ITaskAssignmentsModel[];

    let sentCount = 0;

    for (const item of updates) {
      if (item.email) {
        const model = getModel(item);
        if (model.teams?.length) {
          sentCount++;
          void sendAssignmentUpdate(item.email, model);
        }
      }
    }
    log(`(cron) Notifications job ended with ${sentCount} emails.`);
  } catch (error) {
    log_error(error);
    log("(cron) Notifications job ended with errors.");
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
