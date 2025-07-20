export interface RecurringTasksConfig {
  enabled: boolean;
  mode: 'cron' | 'queue';
  cronInterval: string;
  redisConfig: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  queueOptions: {
    maxConcurrency: number;
    retryAttempts: number;
    retryDelay: number;
  };
  notifications: {
    enabled: boolean;
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  auditLog: {
    enabled: boolean;
    retentionDays: number;
  };
}

export const recurringTasksConfig: RecurringTasksConfig = {
  enabled: process.env.RECURRING_TASKS_ENABLED !== 'false',
  mode: (process.env.RECURRING_TASKS_MODE as 'cron' | 'queue') || 'cron',
  cronInterval: process.env.RECURRING_JOBS_INTERVAL || '0 * * * *',
  
  redisConfig: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  
  queueOptions: {
    maxConcurrency: parseInt(process.env.RECURRING_TASKS_MAX_CONCURRENCY || '5'),
    retryAttempts: parseInt(process.env.RECURRING_TASKS_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.RECURRING_TASKS_RETRY_DELAY || '2000'),
  },
  
  notifications: {
    enabled: process.env.RECURRING_TASKS_NOTIFICATIONS_ENABLED !== 'false',
    email: process.env.RECURRING_TASKS_EMAIL_NOTIFICATIONS !== 'false',
    push: process.env.RECURRING_TASKS_PUSH_NOTIFICATIONS !== 'false',
    inApp: process.env.RECURRING_TASKS_IN_APP_NOTIFICATIONS !== 'false',
  },
  
  auditLog: {
    enabled: process.env.RECURRING_TASKS_AUDIT_LOG_ENABLED !== 'false',
    retentionDays: parseInt(process.env.RECURRING_TASKS_AUDIT_RETENTION_DAYS || '90'),
  },
};