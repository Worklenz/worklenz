import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Empty } from '@/shared/antd-imports';
import { useSelector, useDispatch } from 'react-redux';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { RootState } from '@/app/store';
import '../EnhancedKanbanBoard.css';
import '../EnhancedKanbanGroup.css';
import '../EnhancedKanbanTaskCard.css';
import ImprovedTaskFilters from '../../task-management/improved-task-filters';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import alertService from '@/services/alerts/alertService';
import logger from '@/utils/errorLogger';
import {
  reorderGroups,
  reorderEnhancedKanbanGroups,
  reorderTasks,
  reorderEnhancedKanbanTasks,
  fetchEnhancedKanbanLabels,
  fetchEnhancedKanbanGroups,
  fetchEnhancedKanbanTaskAssignees,
  updateEnhancedKanbanTaskPriority,
  selectKanbanLoadedProjectId,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { checkTaskDependencyStatus } from '@/utils/check-task-dependency-status';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import {
  fetchPhasesByProjectId,
  updatePhaseListOrder,
} from '@/features/projects/singleProject/phase/phases.slice';
import { useTranslation } from 'react-i18next';
import { ITaskListPriorityChangeResponse } from '@/types/tasks/task-list-priority.types';
import { SocketEvents } from '@/shared/socket-events';
import KanbanGroup from './KanbanGroup';
import EnhancedKanbanCreateSection from '../EnhancedKanbanCreateSection';

interface DragStateRef {
  draggedGroupId: string | null;
  draggedTaskId: string | null;
  draggedTaskGroupId: string | null;
  hoveredGroupId: string | null;
  hoveredTaskIdx: number | null;
  dragType: 'group' | 'task' | null;
}

const initialDragState: DragStateRef = {
  draggedGroupId: null,
  draggedTaskId: null,
  draggedTaskGroupId: null,
  hoveredGroupId: null,
  hoveredTaskIdx: null,
  dragType: null,
};

const EnhancedKanbanBoardNativeDnD: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { t } = useTranslation('kanban-board');
  const dispatch = useDispatch();
  const authService = useAuthService();
  const { socket } = useSocket();
  const groupBy = useSelector((state: RootState) => state.enhancedKanbanReducer.groupBy);
  const teamId = authService.getCurrentSession()?.team_id;
  const { taskGroups, loadingGroups, error } = useSelector(
    (state: RootState) => state.enhancedKanbanReducer
  );
  const loadedProjectId = useAppSelector(selectKanbanLoadedProjectId);
  const { phaseList } = useAppSelector(state => state.phaseReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { statusCategories } = useAppSelector(state => state.taskStatusReducer);

  // Use ref for drag state to minimize re-renders
  const dragStateRef = useRef<DragStateRef>(initialDragState);
  // State only for hover indicators that need visual updates
  const [hoverState, setHoverState] = useState<{ groupId: string | null; taskIdx: number | null }>({
    groupId: null,
    taskIdx: null,
  });
  // RAF throttling
  const rafRef = useRef<number | null>(null);

  useTaskSocketHandlers();

  useEffect(() => {
    if (projectId && loadedProjectId !== projectId) {
      dispatch(fetchEnhancedKanbanGroups(projectId) as any);
      dispatch(fetchEnhancedKanbanTaskAssignees(projectId) as any);
      dispatch(fetchEnhancedKanbanLabels(projectId) as any);
    }
    if (!statusCategories.length) {
      dispatch(fetchStatusesCategories() as any);
    }
    if (groupBy === 'phase' && !phaseList.length) {
      dispatch(fetchPhasesByProjectId(projectId) as any);
    }
  }, [dispatch, projectId, loadedProjectId]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const getAllTaskUpdates = useCallback((allGroups: ITaskListGroup[], currentGroupBy: string) => {
    const taskUpdates: Array<{
      task_id: string | undefined;
      sort_order: number;
      status_id?: string;
      priority_id?: string;
      phase_id?: string;
    }> = [];
    let currentSortOrder = 0;
    for (const group of allGroups) {
      for (const task of group.tasks) {
        const update: {
          task_id: string | undefined;
          sort_order: number;
          status_id?: string;
          priority_id?: string;
          phase_id?: string;
        } = { task_id: task.id, sort_order: currentSortOrder };
        if (currentGroupBy === 'status') update.status_id = group.id;
        else if (currentGroupBy === 'priority') update.priority_id = group.id;
        else if (currentGroupBy === 'phase' && group.name !== 'Unmapped')
          update.phase_id = group.id;
        taskUpdates.push(update);
        currentSortOrder++;
      }
    }
    return taskUpdates;
  }, []);

  const handleGroupDragStart = useCallback((e: React.DragEvent, groupId: string) => {
    dragStateRef.current = { ...dragStateRef.current, draggedGroupId: groupId, dragType: 'group' };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', groupId);
  }, []);

  const handleGroupDragOver = useCallback((e: React.DragEvent) => {
    if (dragStateRef.current.dragType !== 'group') return;
    e.preventDefault();
  }, []);

  const handleGroupDrop = useCallback(
    async (e: React.DragEvent, targetGroupId: string) => {
      if (dragStateRef.current.dragType !== 'group') return;
      e.preventDefault();

      const { draggedGroupId } = dragStateRef.current;
      if (!draggedGroupId || draggedGroupId === targetGroupId) {
        dragStateRef.current = initialDragState;
        return;
      }

      const fromIdx = taskGroups.findIndex(g => g.id === draggedGroupId);
      const toIdx = taskGroups.findIndex(g => g.id === targetGroupId);
      if (fromIdx === -1 || toIdx === -1) {
        dragStateRef.current = initialDragState;
        return;
      }

      const reorderedGroups = [...taskGroups];
      const [moved] = reorderedGroups.splice(fromIdx, 1);
      reorderedGroups.splice(toIdx, 0, moved);

      dispatch(reorderGroups({ fromIndex: fromIdx, toIndex: toIdx, reorderedGroups }));
      dispatch(
        reorderEnhancedKanbanGroups({ fromIndex: fromIdx, toIndex: toIdx, reorderedGroups }) as any
      );
      dragStateRef.current = initialDragState;

      try {
        if (groupBy === 'status') {
          const response = await statusApiService.updateStatusOrder(
            { status_order: reorderedGroups.map(g => g.id) },
            projectId
          );
          if (!response.done) {
            const revertedGroups = [...reorderedGroups];
            const [movedBack] = revertedGroups.splice(toIdx, 1);
            revertedGroups.splice(fromIdx, 0, movedBack);
            dispatch(
              reorderGroups({ fromIndex: toIdx, toIndex: fromIdx, reorderedGroups: revertedGroups })
            );
            alertService.error(t('failedToUpdateColumnOrder'), t('pleaseTryAgain'));
          }
        } else if (groupBy === 'phase') {
          const newPhaseList = [...phaseList];
          const [movedItem] = newPhaseList.splice(fromIdx, 1);
          newPhaseList.splice(toIdx, 0, movedItem);
          dispatch(updatePhaseListOrder(newPhaseList));
          await phasesApiService.updatePhaseOrder(projectId, {
            from_index: fromIdx,
            to_index: toIdx,
            phases: newPhaseList,
            project_id: projectId,
          });
        }
      } catch (err) {
        logger.error('Failed to update column order', err);
      }
    },
    [taskGroups, groupBy, phaseList, projectId, dispatch, t]
  );

  const handleTaskDragStart = useCallback((e: React.DragEvent, taskId: string, groupId: string) => {
    dragStateRef.current = {
      ...dragStateRef.current,
      draggedTaskId: taskId,
      draggedTaskGroupId: groupId,
      dragType: 'task',
    };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }, []);

  const handleTaskDragOver = useCallback(
    (e: React.DragEvent, groupId: string, taskIdx: number | null) => {
      if (dragStateRef.current.dragType !== 'task') return;
      e.preventDefault();

      const newIdx = taskIdx ?? 0;
      dragStateRef.current.hoveredGroupId = groupId;
      dragStateRef.current.hoveredTaskIdx = newIdx;

      // Throttle visual updates with RAF
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          setHoverState({ groupId, taskIdx: newIdx });
          rafRef.current = null;
        });
      }
    },
    []
  );

  const handleTaskDrop = useCallback(
    async (e: React.DragEvent, targetGroupId: string, _targetTaskIdx: number | null) => {
      if (dragStateRef.current.dragType !== 'task') return;
      e.preventDefault();

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const { draggedTaskId, draggedTaskGroupId, hoveredGroupId, hoveredTaskIdx } =
        dragStateRef.current;

      if (
        !draggedTaskId ||
        !draggedTaskGroupId ||
        hoveredGroupId === null ||
        hoveredTaskIdx === null
      ) {
        dragStateRef.current = initialDragState;
        setHoverState({ groupId: null, taskIdx: null });
        return;
      }

      const sourceGroup = taskGroups.find(g => g.id === draggedTaskGroupId);
      const targetGroup = taskGroups.find(g => g.id === targetGroupId);
      if (!sourceGroup || !targetGroup) {
        dragStateRef.current = initialDragState;
        setHoverState({ groupId: null, taskIdx: null });
        return;
      }

      const taskIdx = sourceGroup.tasks.findIndex(t => t.id === draggedTaskId);
      if (taskIdx === -1) {
        dragStateRef.current = initialDragState;
        setHoverState({ groupId: null, taskIdx: null });
        return;
      }

      const movedTask = sourceGroup.tasks[taskIdx];
      let didStatusChange = false;

      if (groupBy === 'status' && movedTask.id && sourceGroup.id !== targetGroup.id) {
        const canContinue = await checkTaskDependencyStatus(movedTask.id, targetGroupId);
        if (!canContinue) {
          alertService.error(t('taskNotCompleted'), t('completeTaskDependencies'));
          dragStateRef.current = initialDragState;
          setHoverState({ groupId: null, taskIdx: null });
          return;
        }
        didStatusChange = true;
      }

      let insertIdx = hoveredTaskIdx;
      let newTaskGroups = [...taskGroups];

      if (sourceGroup.id === targetGroup.id) {
        const updatedTasks = [...sourceGroup.tasks];
        updatedTasks.splice(taskIdx, 1);
        if (taskIdx < insertIdx) insertIdx--;
        insertIdx = Math.max(0, Math.min(insertIdx, updatedTasks.length));
        updatedTasks.splice(insertIdx, 0, movedTask);

        dispatch(
          reorderTasks({
            activeGroupId: sourceGroup.id,
            overGroupId: targetGroup.id,
            fromIndex: taskIdx,
            toIndex: insertIdx,
            task: movedTask,
            updatedSourceTasks: updatedTasks,
            updatedTargetTasks: updatedTasks,
          })
        );
        dispatch(
          reorderEnhancedKanbanTasks({
            activeGroupId: sourceGroup.id,
            overGroupId: targetGroup.id,
            fromIndex: taskIdx,
            toIndex: insertIdx,
            task: movedTask,
            updatedSourceTasks: updatedTasks,
            updatedTargetTasks: updatedTasks,
          }) as any
        );

        newTaskGroups = newTaskGroups.map(g =>
          g.id === sourceGroup.id ? { ...g, tasks: updatedTasks } : g
        );
      } else {
        const updatedSourceTasks = [...sourceGroup.tasks];
        updatedSourceTasks.splice(taskIdx, 1);
        const updatedTargetTasks = [...targetGroup.tasks];
        insertIdx = Math.max(0, Math.min(insertIdx, updatedTargetTasks.length));
        updatedTargetTasks.splice(insertIdx, 0, movedTask);

        dispatch(
          reorderTasks({
            activeGroupId: sourceGroup.id,
            overGroupId: targetGroup.id,
            fromIndex: taskIdx,
            toIndex: insertIdx,
            task: movedTask,
            updatedSourceTasks,
            updatedTargetTasks,
          })
        );
        dispatch(
          reorderEnhancedKanbanTasks({
            activeGroupId: sourceGroup.id,
            overGroupId: targetGroup.id,
            fromIndex: taskIdx,
            toIndex: insertIdx,
            task: movedTask,
            updatedSourceTasks,
            updatedTargetTasks,
          }) as any
        );

        newTaskGroups = newTaskGroups.map(g => {
          if (g.id === sourceGroup.id) return { ...g, tasks: updatedSourceTasks };
          if (g.id === targetGroup.id) return { ...g, tasks: updatedTargetTasks };
          return g;
        });
      }

      dragStateRef.current = initialDragState;
      setHoverState({ groupId: null, taskIdx: null });

      if (socket && projectId && teamId && movedTask) {
        const taskUpdates = getAllTaskUpdates(newTaskGroups, groupBy);
        socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), {
          project_id: projectId,
          group_by: groupBy || 'status',
          task_updates: taskUpdates,
          from_group: sourceGroup.id,
          to_group: targetGroup.id,
          team_id: teamId,
          from_index: taskIdx,
          to_index: insertIdx,
          to_last_index:
            insertIdx === (newTaskGroups.find(g => g.id === targetGroup.id)?.tasks.length || 0) - 1,
          task: {
            id: movedTask.id,
            project_id: movedTask.project_id || projectId,
            status: movedTask.status || '',
            priority: movedTask.priority || '',
          },
        });

        if (didStatusChange) {
          socket.emit(
            SocketEvents.TASK_STATUS_CHANGE.toString(),
            JSON.stringify({
              task_id: movedTask.id,
              status_id: targetGroupId,
              parent_task: movedTask.parent_task_id || null,
              team_id: teamId,
            })
          );
        }

        if (groupBy === 'priority' && movedTask.id) {
          socket.emit(
            SocketEvents.TASK_PRIORITY_CHANGE.toString(),
            JSON.stringify({
              task_id: movedTask.id,
              priority_id: targetGroupId,
              team_id: teamId,
            })
          );
          socket.once(
            SocketEvents.TASK_PRIORITY_CHANGE.toString(),
            (data: ITaskListPriorityChangeResponse) => {
              dispatch(updateEnhancedKanbanTaskPriority(data));
            }
          );
        }
      }
    },
    [taskGroups, groupBy, projectId, teamId, socket, dispatch, t, getAllTaskUpdates]
  );

  const handleDragEnd = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    dragStateRef.current = initialDragState;
    setHoverState({ groupId: null, taskIdx: null });
  }, []);

  if (error) {
    return (
      <Card>
        <Empty
          description={`${t('errorLoadingTasks')}: ${error}`}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4">
        <React.Suspense fallback={<div>{t('loadingFilters')}</div>}>
          <ImprovedTaskFilters position="board" />
        </React.Suspense>
      </div>
      <div className="enhanced-kanban-board">
        {loadingGroups ? (
          <div className="flex flex-row gap-2 h-[600px]">
            <div
              className="rounded animate-pulse w-1/6"
              style={{
                height: '60%',
                backgroundColor: themeWiseColor('#e5e7eb', '#1e1e1e', themeMode),
              }}
            />
            <div
              className="rounded animate-pulse w-1/6"
              style={{
                height: '100%',
                backgroundColor: themeWiseColor('#e5e7eb', '#1e1e1e', themeMode),
              }}
            />
            <div
              className="rounded animate-pulse w-1/6"
              style={{
                height: '80%',
                backgroundColor: themeWiseColor('#e5e7eb', '#1e1e1e', themeMode),
              }}
            />
            <div
              className="rounded animate-pulse w-1/6"
              style={{
                height: '40%',
                backgroundColor: themeWiseColor('#e5e7eb', '#1e1e1e', themeMode),
              }}
            />
          </div>
        ) : taskGroups.length === 0 ? (
          <Card>
            <Empty description={t('noTasksFound')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
        ) : (
          <div className="kanban-groups-container">
            {taskGroups.map(group => (
              <KanbanGroup
                key={group.id}
                group={group}
                onGroupDragStart={handleGroupDragStart}
                onGroupDragOver={handleGroupDragOver}
                onGroupDrop={handleGroupDrop}
                onTaskDragStart={handleTaskDragStart}
                onTaskDragOver={handleTaskDragOver}
                onTaskDrop={handleTaskDrop}
                onDragEnd={handleDragEnd}
                hoveredTaskIdx={hoverState.groupId === group.id ? hoverState.taskIdx : null}
                hoveredGroupId={hoverState.groupId}
              />
            ))}
            <EnhancedKanbanCreateSection />
          </div>
        )}
      </div>
    </>
  );
};

export default EnhancedKanbanBoardNativeDnD;
