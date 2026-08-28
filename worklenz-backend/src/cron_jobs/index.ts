import {startDailyDigestJob} from "./daily-digest-job";
import {startNotificationsJob} from "./notifications-job";
import {startProjectDigestJob} from "./project-digest-job";
import {startPlanTrialExpirationJob} from "../ee/jobs/plan-trial-expiration-job";
import {startDigestScheduler} from "./digest-scheduler";

export function startCronJobs() {
  startNotificationsJob();
  startDailyDigestJob();
  startProjectDigestJob();
  startDigestScheduler();

  // Initialize plan trial expiration job
  startPlanTrialExpirationJob();
}
