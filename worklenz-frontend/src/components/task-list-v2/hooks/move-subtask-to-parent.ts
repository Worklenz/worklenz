import type { AppDispatch } from '@/app/store';
import {
  convertTaskToSubtask,
  fetchSubTasks,
  fetchTasksV3,
} from '@/features/task-management/task-management.slice';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import logger from '@/utils/errorLogger';
import { message } from '@/shared/antd-imports';
import type { TFunction } from 'i18next';
import type { IServerResponse } from '@/types/common.types';

export interface MoveSubtaskToParentDeps {
  subtaskId: string;
  newParentId: string;
  projectId: string;
  /** Parent before the optimistic move; used to restore both lists on failure. */
  oldParentId: string | null | undefined;
  dispatch: AppDispatch;
  t?: TFunction;
  moveSubtaskApi?: (
    taskId: string,
    projectId: string,
    parentTaskId: string
  ) => Promise<IServerResponse<unknown>>;
}

const failedMessage = (t?: TFunction, fallback?: string) =>
  fallback ||
  t?.('contextMenu.moveSubtaskFailed', { defaultValue: 'Failed to move subtask' }) ||
  'Failed to move subtask';

/**
 * Optimistically reparents a subtask, awaits the mutation, then refreshes the
 * destination (and source) parent lists. A destination GET must not run before
 * the move commits — a stale response would replace sub_tasks and drop the
 * newly attached item.
 */
export async function moveSubtaskToParent(deps: MoveSubtaskToParentDeps): Promise<boolean> {
  const {
    subtaskId,
    newParentId,
    projectId,
    oldParentId,
    dispatch,
    t,
    moveSubtaskApi = tasksApiService.moveSubtask,
  } = deps;

  dispatch(convertTaskToSubtask({ taskId: subtaskId, parentTaskId: newParentId }));

  const restoreBothParentLists = async () => {
    // Full list reload restores entities + both parents' sub_tasks after a failed optimistic move.
    await dispatch(fetchTasksV3(projectId));
  };

  try {
    const res = await moveSubtaskApi(subtaskId, projectId, newParentId);
    if (!res.done) {
      await restoreBothParentLists();
      message.error(failedMessage(t, res.message || undefined));
      return false;
    }

    // Authoritative refresh only after the mutation succeeds.
    await dispatch(fetchSubTasks({ taskId: newParentId, projectId }));
    if (oldParentId && oldParentId !== newParentId) {
      await dispatch(fetchSubTasks({ taskId: oldParentId, projectId }));
    }

    message.success(
      t?.('contextMenu.moveSubtaskSuccess', { defaultValue: 'Subtask moved successfully' }) ||
        'Subtask moved successfully'
    );
    return true;
  } catch (error) {
    logger.error('Error moving subtask via drag and drop:', error);
    await restoreBothParentLists();
    message.error(failedMessage(t));
    return false;
  }
}
