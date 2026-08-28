import { CronJob } from "cron";
import { PlanTrialService } from "../services/plan-trial-service";
import { log_error } from "../../shared/utils";

// Run daily at 9:00 AM UTC
const TIME = "0 9 * * *";

const log = (value: any) => console.log("plan-trial-expiration-job:", value);

let isRunning = false;

async function onPlanTrialExpirationTick(): Promise<void> {
  if (isRunning) {
    log('Job is already running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    log('Starting plan trial expiration job...');

    // 1. Expire overdue trials
    const expiredCount = await PlanTrialService.expireOverdueTrials();
    log(`Expired ${expiredCount} overdue plan trials`);

    // 2. Send reminder emails for trials expiring in 24 hours
    await sendTrialExpirationReminders(24);

    // 3. Send final reminder emails for trials expiring in 6 hours
    await sendTrialExpirationReminders(6);

    const duration = Date.now() - startTime;
    log(`Plan trial expiration job completed in ${duration}ms`);
  } catch (error) {
    log_error(error);
    log(`Plan trial expiration job failed: ${error}`);
  } finally {
    isRunning = false;
  }
}

/**
 * Send reminder emails for trials expiring soon
 */
async function sendTrialExpirationReminders(hoursBeforeExpiry: number): Promise<void> {
  try {
    const expiringTrials = await PlanTrialService.getTrialsExpiringSoon(hoursBeforeExpiry);

    for (const trial of expiringTrials) {
      await sendTrialReminderEmail(trial, hoursBeforeExpiry);
    }

    log(`Sent ${expiringTrials.length} trial reminder emails (${hoursBeforeExpiry}h before expiry)`);
  } catch (error) {
    log_error(error);
    log(`Failed to send trial reminder emails (${hoursBeforeExpiry}h): ${error}`);
  }
}

/**
 * Send individual trial reminder email
 */
async function sendTrialReminderEmail(trial: any, hoursBeforeExpiry: number): Promise<void> {
  try {
    const isLastDay = hoursBeforeExpiry <= 24;
    const isFinalReminder = hoursBeforeExpiry <= 6;

    let subject: string;
    let template: string;

    if (isFinalReminder) {
      subject = `Your ${trial.plan_name} trial expires in ${Math.round(trial.hours_remaining)} hours`;
      template = 'trial-final-reminder';
    } else if (isLastDay) {
      subject = `Your ${trial.plan_name} trial expires tomorrow`;
      template = 'trial-day-reminder';
    } else {
      subject = `Your ${trial.plan_name} trial expires soon`;
      template = 'trial-reminder';
    }

    const emailData = {
      to: trial.email,
      subject,
      template,
      data: {
        userName: trial.user_name,
        planName: trial.plan_name,
        hoursRemaining: Math.round(trial.hours_remaining),
        expirationDate: new Date(trial.trial_end_date).toLocaleDateString(),
        upgradeUrl: `${process.env.CLIENT_URL}/admin-center/billing?upgrade=true`,
        businessFeatures: [
          'Client Portal Access',
          'Project Finance Management',
          'Advanced Analytics & Reports',
          'Resource Management Tools',
          'Full Gantt Charts',
          'Project Health Monitoring'
        ]
      }
    };

    // Note: Replace with your actual email service
    await sendTrialEmail(emailData);

  } catch (error) {
    log_error(error);
    log(`Failed to send trial reminder email to ${trial.email}: ${error}`);
  }
}

/**
 * Send trial-related email (placeholder - implement with your email service)
 */
async function sendTrialEmail(emailData: any): Promise<void> {
  // TODO: Replace with your actual email service implementation
  // Examples: SendGrid, AWS SES, Nodemailer, etc.

  log(`[EMAIL] ${emailData.subject} to ${emailData.to}`);

  // Example implementation:
  // await sendEmail({
  //   to: emailData.to,
  //   subject: emailData.subject,
  //   html: await renderEmailTemplate(emailData.template, emailData.data)
  // });
}

/**
 * Export function to start the plan trial expiration job
 */
export function startPlanTrialExpirationJob() {
  log('(cron) Plan trial expiration job ready.');
  const job = new CronJob(
    TIME,
    () => void onPlanTrialExpirationTick(),
    () => log('(cron) Plan trial expiration job successfully executed.'),
    true
  );
  job.start();
}

/**
 * Manual execution for testing
 */
export async function runPlanTrialExpirationJob(): Promise<void> {
  await onPlanTrialExpirationTick();
}

/**
 * Get job status
 */
export function getPlanTrialJobStatus(): { isRunning: boolean } {
  return { isRunning };
}

// Email templates (simplified - you should store these in separate files)
export const TrialEmailTemplates = {
  'trial-reminder': `
    <h2>Your {{planName}} trial expires soon</h2>
    <p>Hi {{userName}},</p>
    <p>Your {{planName}} trial will expire in {{hoursRemaining}} hours on {{expirationDate}}.</p>
    <p>During your trial, you've had access to premium features including:</p>
    <ul>
      {{#each businessFeatures}}
      <li>{{this}}</li>
      {{/each}}
    </ul>
    <p>Don't lose access to these powerful features!</p>
    <a href="{{upgradeUrl}}" style="background: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
      Upgrade Now
    </a>
  `,

  'trial-day-reminder': `
    <h2>Your {{planName}} trial expires tomorrow</h2>
    <p>Hi {{userName}},</p>
    <p>This is a friendly reminder that your {{planName}} trial expires tomorrow ({{expirationDate}}).</p>
    <p>To continue using premium features, upgrade now:</p>
    <a href="{{upgradeUrl}}" style="background: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
      Upgrade to {{planName}}
    </a>
  `,

  'trial-final-reminder': `
    <h2>⏰ Your {{planName}} trial expires in {{hoursRemaining}} hours</h2>
    <p>Hi {{userName}},</p>
    <p><strong>This is your final reminder</strong> - your {{planName}} trial expires today!</p>
    <p>Upgrade now to keep your premium features:</p>
    <a href="{{upgradeUrl}}" style="background: #ff4d4f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
      Upgrade Before Expiration
    </a>
  `
};