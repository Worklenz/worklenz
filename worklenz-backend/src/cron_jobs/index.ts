import {startDailyDigestJob} from "./daily-digest-job";
import {startNotificationsJob} from "./notifications-job";
import {startProjectDigestJob} from "./project-digest-job";
import {startRecurringTasksJob} from "./recurring-tasks";

export function startCronJobs() {
  startNotificationsJob();
  startDailyDigestJob();
  startProjectDigestJob();
  if (process.env.ENABLE_RECURRING_JOBS === "true") startRecurringTasksJob();
}
