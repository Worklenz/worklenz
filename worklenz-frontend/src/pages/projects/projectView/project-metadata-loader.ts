import type { AppDispatch } from '@/app/store';
import { getProject } from '@/features/project/project.slice';
import { fetchStatuses, fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import {
  fetchTaskAssignees,
  fetchLabelsByProject,
  getFiltersFromLocalStorage,
} from '@/features/tasks/tasks.slice';
import {
  fetchTaskListColumns,
  fetchTasksV3,
} from '@/features/task-management/task-management.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';

/** Wait only for metadata that determines access, grouping, columns and saved filters. */
export const loadProjectMetadata = (
  dispatch: AppDispatch,
  projectId: string,
  isTaskList: boolean,
  requiresPhases = false
) => {
  const savedFilters = isTaskList ? getFiltersFromLocalStorage(projectId) : null;
  // Malformed saved selections keep the conservative dependency. A valid
  // empty selection needs no entities to restore, so it can load in parallel.
  const needsAssignees =
    savedFilters !== null &&
    (!Array.isArray(savedFilters.members) || savedFilters.members.length > 0);
  const needsLabels =
    savedFilters !== null &&
    (!Array.isArray(savedFilters.labels) || savedFilters.labels.length > 0);
  // Start project access first, preserving the existing request order.
  const criticalMetadata = Promise.allSettled([
    dispatch(getProject(projectId)),
    dispatch(fetchStatuses(projectId)),
    ...(isTaskList
      ? [
          dispatch(fetchTaskListColumns(projectId)),
          ...(needsAssignees ? [dispatch(fetchTaskAssignees(projectId))] : []),
          ...(needsLabels ? [dispatch(fetchLabelsByProject(projectId))] : []),
          // Backlog uses phase data to determine its pinned sprint filter.
          ...(requiresPhases ? [dispatch(fetchPhasesByProjectId(projectId))] : []),
        ]
      : []),
  ]);

  // These lookups decorate the UI; their existing loading/error state remains in Redux.
  void dispatch(fetchLabels());
  if (isTaskList) {
    if (!needsAssignees) void dispatch(fetchTaskAssignees(projectId));
    if (!needsLabels) void dispatch(fetchLabelsByProject(projectId));
    if (!requiresPhases) void dispatch(fetchPhasesByProjectId(projectId));
    void dispatch(fetchStatusesCategories());
  }
  return criticalMetadata;
};

interface InitialTaskListOptions {
  projectId: string;
  tab: string;
  hasTaskDeepLink: boolean;
  onShellReady: () => void;
}

/** Mount the ordinary list shell during I/O, after the pending action owns the request. */
export const startInitialTaskListLoad = (
  dispatch: AppDispatch,
  { projectId, tab, hasTaskDeepLink, onShellReady }: InitialTaskListOptions
) => {
  const request = dispatch(fetchTasksV3(projectId));
  // Other tabs and direct task links retain their existing initialization order.
  if (tab === 'tasks-list' && !hasTaskDeepLink) onShellReady();
  return request;
};
