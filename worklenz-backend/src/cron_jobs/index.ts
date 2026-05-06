import {startDailyDigestJob} from "./daily-digest-job";
import {startNotificationsJob} from "./notifications-job";
import {startProjectDigestJob} from "./project-digest-job";
import {startPlanTrialExpirationJob} from "../jobs/plan-trial-expiration-job";

export function startCronJobs() {
  startNotificationsJob();
  startDailyDigestJob();
  startProjectDigestJob();

  // Initialize plan trial expiration job
  startPlanTrialExpirationJob();
}
