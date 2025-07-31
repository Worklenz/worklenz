import { tasksApiService } from '@/api/tasks/tasks.api.service';
import logger from './errorLogger';

export const checkTaskDependencyStatus = async (taskId: string, statusId: string) => {
  if (!taskId || !statusId) return false;
  try {
    const res = await tasksApiService.getTaskDependencyStatus(taskId, statusId);
    return res.done ? res.body.can_continue : false;
  } catch (error) {
    logger.error('Error checking task dependency status:', error);
    return false;
  }
};
