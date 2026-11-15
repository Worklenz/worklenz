import { useCallback, useState, useMemo } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { Task, TaskGroup } from '@/types/task-management.types';
import { reorderTasks, updateTask } from '@/features/task-management/task-management.slice';
import {
  fetchTask as fetchTaskDrawer,
  setNavigationContext,
  setSelectedTaskId,
  setShowTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';
import { SocketEvents } from '@/shared/socket-events';

export interface InsertAnchor {
  groupId: string;
  afterTaskId: string | null;
}

export interface UseTaskInlineOperationsParams {
  projectId?: string;
  groups: TaskGroup[];
  allTasks: Task[];
  currentGrouping?: string | null;
  socket: any;
  connected: boolean;
  currentSession: { team_id?: string } | null;
  showTaskDrawer: boolean;
  selectedTaskId?: string | null;
}

export interface UseTaskInlineOperationsReturn {
  activeAddRowsByGroup: Record<string, boolean>;
  setActiveAddRowsByGroup: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  insertAnchor: InsertAnchor | null;
  setInsertAnchor: React.Dispatch<React.SetStateAction<InsertAnchor | null>>;
  handleActivateAddRow: (groupId: string) => void;
  handleDeactivateAddRow: (groupId: string) => void;
  handleTaskCreated: (
    task: Task,
    groupId: string,
    openDrawer: boolean,
    insertedAfterTaskId?: string | null
  ) => void;
  updateTaskCustomColumnValue: (
    taskId: string,
    columnKey: string,
    value: string | number | boolean | string[] | null
  ) => void;
  openDrawerForTask: (taskId: string) => void;
}

export const useTaskInlineOperations = ({
  projectId,
  groups,
  allTasks,
  currentGrouping,
  socket,
  connected,
  currentSession,
  showTaskDrawer,
  selectedTaskId,
}: UseTaskInlineOperationsParams): UseTaskInlineOperationsReturn => {
  const dispatch = useAppDispatch();
  const [activeAddRowsByGroup, setActiveAddRowsByGroup] = useState<Record<string, boolean>>({});
  const [insertAnchor, setInsertAnchor] = useState<InsertAnchor | null>(null);

  const navigationTaskIds = useMemo(() => {
    return groups.flatMap(group => group.taskIds);
  }, [groups]);

  const openDrawerForTask = useCallback(
    (taskId: string) => {
      if (!projectId || !taskId) return;
      if (showTaskDrawer && selectedTaskId === taskId) return;

      const currentIndex = navigationTaskIds.indexOf(taskId);

      dispatch(
        setNavigationContext({
          taskIds: navigationTaskIds,
          currentIndex: currentIndex >= 0 ? currentIndex : 0,
          sourceView: 'task-list',
          projectId,
        })
      );
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTaskDrawer({ taskId, projectId }));
    },
    [dispatch, navigationTaskIds, selectedTaskId, showTaskDrawer, projectId]
  );

  const handleActivateAddRow = useCallback((groupId: string) => {
    setActiveAddRowsByGroup(prev => ({ ...prev, [groupId]: true }));
  }, []);

  const handleDeactivateAddRow = useCallback((groupId: string) => {
    setActiveAddRowsByGroup(prev => ({ ...prev, [groupId]: false }));
    setInsertAnchor(current => (current?.groupId === groupId ? null : current));
  }, []);

  const emitSortOrderUpdate = useCallback(
    (groupId: string, orderedGroupTaskIds: string[], createdTask: Task) => {
      if (!socket || !connected || !projectId) return;

      const updatedGroups = groups.map(group => ({
        ...group,
        taskIds: group.id === groupId ? orderedGroupTaskIds : [...group.taskIds],
      }));

      const taskUpdates: Array<{ task_id: string; sort_order: number }> = [];
      let currentSortOrder = 0;

      updatedGroups.forEach(group => {
        group.taskIds.forEach(taskId => {
          taskUpdates.push({ task_id: taskId, sort_order: currentSortOrder });
          currentSortOrder += 1;
        });
      });

      socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), {
        project_id: projectId,
        group_by: currentGrouping || 'status',
        task_updates: taskUpdates,
        from_group: groupId,
        to_group: groupId,
        task: {
          id: createdTask.id,
          project_id: projectId,
          status: createdTask.status || '',
          priority: createdTask.priority || '',
        },
        team_id: currentSession?.team_id || '',
      });
    },
    [connected, socket, projectId, groups, currentGrouping, currentSession?.team_id]
  );

  const handleTaskCreated = useCallback(
    (task: Task, groupId: string, openDrawer: boolean, insertedAfterTaskId?: string | null) => {
      if (!task?.id) return;

      setActiveAddRowsByGroup(prev => ({ ...prev, [groupId]: true }));

      if (insertedAfterTaskId) {
        setInsertAnchor({ groupId, afterTaskId: task.id });
        const targetGroup = groups.find(group => group.id === groupId);
        if (!targetGroup) return;

        const taskIds = targetGroup.taskIds.includes(task.id)
          ? [...targetGroup.taskIds]
          : [...targetGroup.taskIds, task.id];

        const filteredIds = taskIds.filter(id => id !== task.id);
        const anchorIndex = filteredIds.indexOf(insertedAfterTaskId);
        const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : filteredIds.length;
        filteredIds.splice(insertIndex, 0, task.id);

        // Keep realtime UI consistent immediately (before backend/socket round-trip finishes).
        dispatch(reorderTasks({ groupId, taskIds: filteredIds }));
        emitSortOrderUpdate(groupId, filteredIds, task);

        // Insert-mode is one-shot: close the inline input to avoid visible re-anchoring jumps.
        setActiveAddRowsByGroup(prev => ({ ...prev, [groupId]: false }));
        setInsertAnchor(current => (current?.groupId === groupId ? null : current));
      } else {
        setInsertAnchor(current => (current?.groupId === groupId ? null : current));
      }

      if (showTaskDrawer || openDrawer) {
        openDrawerForTask(task.id);
      }
    },
    [dispatch, emitSortOrderUpdate, groups, openDrawerForTask, showTaskDrawer]
  );

  const updateTaskCustomColumnValue = useCallback(
    (taskId: string, columnKey: string, value: string | number | boolean | string[] | null) => {
      try {
        if (!projectId) {
          console.error('Project ID is missing');
          return;
        }

        const body = {
          task_id: taskId,
          column_key: columnKey,
          value,
          project_id: projectId,
        };

        // Update the Redux store immediately for optimistic updates
        const currentTask = allTasks.find(task => task.id === taskId);
        if (currentTask) {
          const updatedTaskRecord = {
            ...currentTask,
            custom_column_values: {
              ...currentTask.custom_column_values,
              [columnKey]: value,
            },
            updated_at: new Date().toISOString(),
          };

          dispatch(updateTask(updatedTaskRecord));
        }

        if (socket && connected) {
          socket.emit(SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(), JSON.stringify(body));
        } else {
          console.warn('Socket not connected, unable to emit TASK_CUSTOM_COLUMN_UPDATE event');
        }
      } catch (error) {
        console.error('Error updating custom column value:', error);
      }
    },
    [projectId, socket, connected, allTasks, dispatch]
  );

  return {
    activeAddRowsByGroup,
    setActiveAddRowsByGroup,
    insertAnchor,
    setInsertAnchor,
    handleActivateAddRow,
    handleDeactivateAddRow,
    handleTaskCreated,
    updateTaskCustomColumnValue,
    openDrawerForTask,
  };
};
