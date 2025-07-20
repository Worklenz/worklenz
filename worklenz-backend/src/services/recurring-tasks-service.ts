import { recurringTasksConfig } from '../config/recurring-tasks-config';
import { startRecurringTasksJob } from '../cron_jobs/recurring-tasks';
import { RecurringTasksJobScheduler } from '../jobs/recurring-tasks-queue';
import { log_error } from '../shared/utils';

export class RecurringTasksService {
  private static isStarted = false;

  /**
   * Start the recurring tasks service based on configuration
   */
  static async start(): Promise<void> {
    if (this.isStarted) {
      console.log('Recurring tasks service already started');
      return;
    }

    if (!recurringTasksConfig.enabled) {
      console.log('Recurring tasks service disabled');
      return;
    }

    try {
      console.log(`Starting recurring tasks service in ${recurringTasksConfig.mode} mode...`);

      switch (recurringTasksConfig.mode) {
        case 'cron':
          startRecurringTasksJob();
          break;
          
        case 'queue':
          await RecurringTasksJobScheduler.start();
          break;
          
        default:
          throw new Error(`Unknown recurring tasks mode: ${recurringTasksConfig.mode}`);
      }

      this.isStarted = true;
      console.log(`Recurring tasks service started successfully in ${recurringTasksConfig.mode} mode`);
      
    } catch (error) {
      log_error('Failed to start recurring tasks service:', error);
      throw error;
    }
  }

  /**
   * Stop the recurring tasks service
   */
  static async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    try {
      console.log('Stopping recurring tasks service...');
      
      if (recurringTasksConfig.mode === 'queue') {
        // Close queue connections
        const { recurringTasksQueue, taskCreationQueue } = await import('../jobs/recurring-tasks-queue');
        await recurringTasksQueue.close();
        await taskCreationQueue.close();
      }
      
      this.isStarted = false;
      console.log('Recurring tasks service stopped');
      
    } catch (error) {
      log_error('Error stopping recurring tasks service:', error);
    }
  }

  /**
   * Get service status and statistics
   */
  static async getStatus(): Promise<any> {
    const status = {
      enabled: recurringTasksConfig.enabled,
      mode: recurringTasksConfig.mode,
      started: this.isStarted,
      config: recurringTasksConfig
    };

    if (this.isStarted && recurringTasksConfig.mode === 'queue') {
      try {
        const stats = await RecurringTasksJobScheduler.getStats();
        return { ...status, queueStats: stats };
      } catch (error) {
        return { ...status, queueStatsError: error.message };
      }
    }

    return status;
  }

  /**
   * Manually trigger recurring tasks processing
   */
  static async triggerManual(): Promise<void> {
    if (!this.isStarted) {
      throw new Error('Recurring tasks service is not started');
    }

    try {
      if (recurringTasksConfig.mode === 'queue') {
        await RecurringTasksJobScheduler.scheduleRecurringTasks();
      } else {
        // For cron mode, we can't manually trigger easily
        // Could implement a manual trigger function in the cron job file
        throw new Error('Manual trigger not supported in cron mode');
      }
    } catch (error) {
      log_error('Error manually triggering recurring tasks:', error);
      throw error;
    }
  }

  /**
   * Health check for the service
   */
  static async healthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    try {
      if (!recurringTasksConfig.enabled) {
        return {
          healthy: true,
          message: 'Recurring tasks service is disabled'
        };
      }

      if (!this.isStarted) {
        return {
          healthy: false,
          message: 'Recurring tasks service is not started'
        };
      }

      if (recurringTasksConfig.mode === 'queue') {
        const stats = await RecurringTasksJobScheduler.getStats();
        const hasFailures = stats.recurringTasks.failed > 0 || stats.taskCreation.failed > 0;
        
        return {
          healthy: !hasFailures,
          message: hasFailures ? 'Some jobs are failing' : 'All systems operational',
          details: stats
        };
      }

      return {
        healthy: true,
        message: `Running in ${recurringTasksConfig.mode} mode`
      };

    } catch (error) {
      return {
        healthy: false,
        message: 'Health check failed',
        details: { error: error.message }
      };
    }
  }
}