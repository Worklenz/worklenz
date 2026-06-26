import {startDailyDigestJob} from "./daily-digest-job";
import {startNotificationsJob} from "./notifications-job";
import {startProjectDigestJob} from "./project-digest-job";
import business from "../business";

export function startCronJobs() {
  startNotificationsJob();
  startDailyDigestJob();
  startProjectDigestJob();

  // Business-plan-only background jobs (plan-trial expiration, etc.); CE: no-op
  business.startBackgroundJobs();
}
