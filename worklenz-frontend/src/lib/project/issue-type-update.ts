import type { Store } from '@reduxjs/toolkit';

import { softwareIssuesApiService } from '@/api/software-issues/software-issues.api.service';
import { setTaskIssueType } from '@/features/task-drawer/task-drawer.slice';
import { updateEnhancedKanbanTaskIssueType } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { updateTask } from '@/features/task-management/task-management.slice';
import type { AppDispatch, RootState } from '@/app/store';
import type { IssueType } from '@/types/project/softwareIssue.types';

interface IssueTypeSaveState {
  /** Monotonic generation so a stale failure cannot roll back a newer selection. */
  generation: number;
  /** Serialized save chain for this task. */
  queue: Promise<void>;
  /** Last type known to match the server (or the baseline before pending saves). */
  lastServerType: IssueType | null;
}

const saveStateByTaskId = new Map<string, IssueTypeSaveState>();

/** Clears in-flight save tracking (for unit tests). */
export const resetIssueTypeSaveStateForTests = () => {
  saveStateByTaskId.clear();
};

const getSaveState = (taskId: string): IssueTypeSaveState => {
  const existing = saveStateByTaskId.get(taskId);
  if (existing) return existing;
  const created: IssueTypeSaveState = {
    generation: 0,
    queue: Promise.resolve(),
    lastServerType: null,
  };
  saveStateByTaskId.set(taskId, created);
  return created;
};

export interface SaveIssueTypeParams {
  taskId: string;
  projectId: string;
  nextType: IssueType;
  previousType: IssueType;
  dispatch: AppDispatch;
  store: Store<RootState>;
}

/**
 * Optimistically updates issue type across list, drawer, and board, then persists
 * through a per-task queue so concurrent changes cannot finish out of order.
 * A failed save only rolls back when it is still the latest generation.
 */
export const saveIssueTypeForTask = async ({
  taskId,
  projectId,
  nextType,
  previousType,
  dispatch,
  store,
}: SaveIssueTypeParams): Promise<boolean> => {
  if (nextType === previousType) return true;

  const state = getSaveState(taskId);
  if (state.lastServerType === null) state.lastServerType = previousType;

  const generation = state.generation + 1;
  state.generation = generation;
  const typeToSave = nextType;

  applyIssueTypeEverywhere(dispatch, store, taskId, nextType);

  const run = async (): Promise<boolean> => {
    try {
      const response = await softwareIssuesApiService.updateType(projectId, taskId, typeToSave);
      if (!response.done) throw new Error(response.message);
      state.lastServerType = typeToSave;
      return true;
    } catch {
      if (getSaveState(taskId).generation !== generation) return false;
      const rollbackType = state.lastServerType ?? previousType;
      applyIssueTypeEverywhere(dispatch, store, taskId, rollbackType);
      return false;
    }
  };

  const resultPromise = state.queue.then(run, run);
  state.queue = resultPromise.then(
    () => undefined,
    () => undefined
  );
  return resultPromise;
};

const applyIssueTypeEverywhere = (
  dispatch: AppDispatch,
  store: Store<RootState>,
  taskId: string,
  issueType: IssueType
) => {
  dispatch(setTaskIssueType({ id: taskId, issue_type: issueType }));
  dispatch(updateEnhancedKanbanTaskIssueType({ taskId, issueType }));
  const listTask = store.getState().taskManagement.entities[taskId];
  if (listTask) dispatch(updateTask({ ...listTask, issue_type: issueType }));
};
