import {startDailyDigestJob} from "./daily-digest-job";
import {startNotificationsJob} from "./notifications-job";
import {startProjectDigestJob} from "./project-digest-job";
import {startPlanTrialExpirationJob} from "../jobs/plan-trial-expiration-job";
import {startDigestScheduler} from "./digest-scheduler";
import {startClientPurgeJob} from "./client-purge-job";
import {startAnalyticsReportScheduleJob} from "./analytics-report-schedule-job";

export function startCronJobs() {
  startNotificationsJob();
  startDailyDigestJob();
  startProjectDigestJob();
  startDigestScheduler();
  startAnalyticsReportScheduleJob();

  // Initialize plan trial expiration job
  startPlanTrialExpirationJob();

  // Retention purge of deleted Client Portal clients (report-only unless CLIENT_PURGE_ENABLED=true)
  startClientPurgeJob();
}
