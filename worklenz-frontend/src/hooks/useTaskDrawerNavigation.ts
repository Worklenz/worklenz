import { useEffect } from 'react';
import { useAppSelector } from './useAppSelector';
import { useAppDispatch } from './useAppDispatch';
import { setNavigationContext } from '@/features/task-drawer/task-drawer.slice';
import { getTaskIdsFromGroups, getTaskIdsFromArray } from '@/utils/task-navigation-helper';

/**
 * Hook to automatically set navigation context when task drawer opens
 * This ensures navigation works regardless of how the task drawer was opened
 */
const EMPTY_TASKS: never[] = [];

const useTaskDrawerNavigation = () => {
  const dispatch = useAppDispatch();
  const showTaskDrawer = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);
  const selectedTaskId = useAppSelector(state => state.taskDrawerReducer.selectedTaskId);
  const navigationContext = useAppSelector(state => state.taskDrawerReducer.navigationContext);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const needsNavigation = showTaskDrawer && !navigationContext;

  // Closed drawers and already initialized navigation do not need list updates.
  const taskManagementGroups = useAppSelector(state =>
    needsNavigation ? state.taskManagement.groups : EMPTY_TASKS
  );
  const taskGroups = useAppSelector(state =>
    needsNavigation ? state.taskReducer.taskGroups : EMPTY_TASKS
  );
  const boardGroups = useAppSelector(state =>
    needsNavigation ? state.boardReducer.taskGroups : EMPTY_TASKS
  );
  const kanbanGroups = useAppSelector(state =>
    needsNavigation ? state.enhancedKanbanReducer.taskGroups : EMPTY_TASKS
  );
  const homeTasks = useAppSelector(state =>
    needsNavigation ? state.homePageReducer.model?.tasks || EMPTY_TASKS : EMPTY_TASKS
  );

  useEffect(() => {
    // Only set navigation context if:
    // 1. Drawer is open
    // 2. We have a selected task
    // 3. Navigation context is not already set
    if (showTaskDrawer && selectedTaskId && !navigationContext) {
      let taskIds: string[] = [];
      let sourceView: 'task-list' | 'kanban' | 'board' | 'home' | 'gantt' | 'workload' =
        'task-list';

      // Determine which view we're in and extract task IDs
      if (taskManagementGroups.length > 0) {
        taskIds = taskManagementGroups.flatMap(group => group.taskIds);
        sourceView = 'task-list';
      } else if (taskGroups.length > 0) {
        taskIds = getTaskIdsFromGroups(taskGroups, false);
        sourceView = 'task-list';
      } else if (kanbanGroups.length > 0) {
        taskIds = getTaskIdsFromGroups(kanbanGroups, false);
        sourceView = 'kanban';
      } else if (boardGroups.length > 0) {
        taskIds = getTaskIdsFromGroups(boardGroups, false);
        sourceView = 'board';
      } else if (homeTasks.length > 0) {
        taskIds = getTaskIdsFromArray(homeTasks, false);
        sourceView = 'home';
      }

      // Only set navigation context if we found tasks
      if (taskIds.length > 0) {
        const currentIndex = taskIds.indexOf(selectedTaskId);

        dispatch(
          setNavigationContext({
            taskIds,
            currentIndex: currentIndex >= 0 ? currentIndex : 0,
            sourceView,
            projectId: projectId || null,
          })
        );
      }
    }
  }, [
    showTaskDrawer,
    selectedTaskId,
    navigationContext,
    taskManagementGroups,
    taskGroups,
    boardGroups,
    kanbanGroups,
    homeTasks,
    projectId,
    dispatch,
  ]);
};

export default useTaskDrawerNavigation;
