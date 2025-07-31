import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/app/store';
import '../EnhancedKanbanBoard.css';
import '../EnhancedKanbanGroup.css';
import '../EnhancedKanbanTaskCard.css';
import ImprovedTaskFilters from '../../task-management/improved-task-filters';
import Card from 'antd/es/card';
import Spin from 'antd/es/spin';
import Empty from 'antd/es/empty';
import { reorderGroups, reorderEnhancedKanbanGroups, reorderTasks, reorderEnhancedKanbanTasks, fetchEnhancedKanbanLabels, fetchEnhancedKanbanGroups, fetchEnhancedKanbanTaskAssignees } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { useAppSelector } from '@/hooks/useAppSelector';
import KanbanGroup from './KanbanGroup';
import EnhancedKanbanCreateSection from '../EnhancedKanbanCreateSection';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import alertService from '@/services/alerts/alertService';
import logger from '@/utils/errorLogger';
import { checkTaskDependencyStatus } from '@/utils/check-task-dependency-status';
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';

const EnhancedKanbanBoardNativeDnD: React.FC<{ projectId: string }> = ({ projectId }) => {
  const dispatch = useDispatch();
  const authService = useAuthService();
  const { socket } = useSocket();
  const project = useAppSelector((state: RootState) => state.projectReducer.project);
  const groupBy = useSelector((state: RootState) => state.enhancedKanbanReducer.groupBy);
  const teamId = authService.getCurrentSession()?.team_id;
  const {
    taskGroups,
    loadingGroups,
    error,
  } = useSelector((state: RootState) => state.enhancedKanbanReducer);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedTaskGroupId, setDraggedTaskGroupId] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [hoveredTaskIdx, setHoveredTaskIdx] = useState<number | null>(null);
  const [dragType, setDragType] = useState<'group' | 'task' | null>(null);
  const { statusCategories, status: existingStatuses } = useAppSelector((state) => state.taskStatusReducer);

  // Set up socket event handlers for real-time updates
  useTaskSocketHandlers();

  useEffect(() => {
    if (projectId) {
      dispatch(fetchEnhancedKanbanGroups(projectId) as any);
      // Load filter data for enhanced kanban
      dispatch(fetchEnhancedKanbanTaskAssignees(projectId) as any);
      dispatch(fetchEnhancedKanbanLabels(projectId) as any);
    }

    if (!statusCategories.length) {
      dispatch(fetchStatusesCategories() as any);
    }
  }, [dispatch, projectId]);
  // Reset drag state if taskGroups changes (e.g., real-time update)
  useEffect(() => {
    setDraggedGroupId(null);
    setDraggedTaskId(null);
    setDraggedTaskGroupId(null);
    setHoveredGroupId(null);
    setHoveredTaskIdx(null);
    setDragType(null);
  }, [taskGroups]);

  // Group drag handlers
  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    setDraggedGroupId(groupId);
    setDragType('group');
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleGroupDragOver = (e: React.DragEvent) => {
    if (dragType !== 'group') return;
    e.preventDefault();
  };
  const handleGroupDrop = async (e: React.DragEvent, targetGroupId: string) => {
    if (dragType !== 'group') return;
    e.preventDefault();
    if (!draggedGroupId || draggedGroupId === targetGroupId) return;
    // Calculate new order and dispatch
    const fromIdx = taskGroups.findIndex(g => g.id === draggedGroupId);
    const toIdx = taskGroups.findIndex(g => g.id === targetGroupId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reorderedGroups = [...taskGroups];
    const [moved] = reorderedGroups.splice(fromIdx, 1);
    reorderedGroups.splice(toIdx, 0, moved);
    dispatch(reorderGroups({ fromIndex: fromIdx, toIndex: toIdx, reorderedGroups }));
    dispatch(reorderEnhancedKanbanGroups({ fromIndex: fromIdx, toIndex: toIdx, reorderedGroups }) as any);

    // API call for group order
    try {
      const columnOrder = reorderedGroups.map(group => group.id);
      const requestBody = { status_order: columnOrder };
      const response = await statusApiService.updateStatusOrder(requestBody, projectId);
      if (!response.done) {
        // Revert the change if API call fails
        const revertedGroups = [...reorderedGroups];
        const [movedBackGroup] = revertedGroups.splice(toIdx, 1);
        revertedGroups.splice(fromIdx, 0, movedBackGroup);
        dispatch(reorderGroups({ fromIndex: toIdx, toIndex: fromIdx, reorderedGroups: revertedGroups }));
        alertService.error('Failed to update column order', 'Please try again');
      }
    } catch (error) {
      // Revert the change if API call fails
      const revertedGroups = [...reorderedGroups];
      const [movedBackGroup] = revertedGroups.splice(toIdx, 1);
      revertedGroups.splice(fromIdx, 0, movedBackGroup);
      dispatch(reorderGroups({ fromIndex: toIdx, toIndex: fromIdx, reorderedGroups: revertedGroups }));
      alertService.error('Failed to update column order', 'Please try again');
      logger.error('Failed to update column order', error);
    }

    setDraggedGroupId(null);
    setDragType(null);
  };

  // Task drag handlers
  const handleTaskDragStart = (e: React.DragEvent, taskId: string, groupId: string) => {
    setDraggedTaskId(taskId);
    setDraggedTaskGroupId(groupId);
    setDragType('task');
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleTaskDragOver = (e: React.DragEvent, groupId: string, taskIdx: number | null) => {
    if (dragType !== 'task') return;
    e.preventDefault();
    if (draggedTaskId) {
      setHoveredGroupId(groupId);
    }
    if (taskIdx === null) {
      setHoveredTaskIdx(0);
    } else {
      setHoveredTaskIdx(taskIdx);
    };
  };
  const handleTaskDrop = async (e: React.DragEvent, targetGroupId: string, targetTaskIdx: number | null) => {
    if (dragType !== 'task') return;
    e.preventDefault();
    if (!draggedTaskId || !draggedTaskGroupId || hoveredGroupId === null || hoveredTaskIdx === null) return;

    // Calculate new order and dispatch
    const sourceGroup = taskGroups.find(g => g.id === draggedTaskGroupId);
    const targetGroup = taskGroups.find(g => g.id === targetGroupId);
    if (!sourceGroup || !targetGroup) return;

    const taskIdx = sourceGroup.tasks.findIndex(t => t.id === draggedTaskId);
    if (taskIdx === -1) return;

    const movedTask = sourceGroup.tasks[taskIdx];
    let didStatusChange = false;
    if (groupBy === 'status' && movedTask.id) {
      if (sourceGroup.id !== targetGroup.id) {
        const canContinue = await checkTaskDependencyStatus(movedTask.id, targetGroupId);
        if (!canContinue) {
          alertService.error(
            'Task is not completed',
            'Please complete the task dependencies before proceeding'
          );
          return;
        }
        didStatusChange = true;
      }
    }
    let insertIdx = hoveredTaskIdx;

    // Handle same group reordering
    if (sourceGroup.id === targetGroup.id) {
      // Create a single updated array for the same group
      const updatedTasks = [...sourceGroup.tasks];
      updatedTasks.splice(taskIdx, 1); // Remove from original position

      // Adjust insert index if moving forward in the same array
      if (taskIdx < insertIdx) {
        insertIdx--;
      }

      if (insertIdx < 0) insertIdx = 0;
      if (insertIdx > updatedTasks.length) insertIdx = updatedTasks.length;

      updatedTasks.splice(insertIdx, 0, movedTask); // Insert at new position

      dispatch(reorderTasks({
        activeGroupId: sourceGroup.id,
        overGroupId: targetGroup.id,
        fromIndex: taskIdx,
        toIndex: insertIdx,
        task: movedTask,
        updatedSourceTasks: updatedTasks,
        updatedTargetTasks: updatedTasks,
      }));
      dispatch(reorderEnhancedKanbanTasks({
        activeGroupId: sourceGroup.id,
        overGroupId: targetGroup.id,
        fromIndex: taskIdx,
        toIndex: insertIdx,
        task: movedTask,
        updatedSourceTasks: updatedTasks,
        updatedTargetTasks: updatedTasks,
      }) as any);
    } else {
      // Handle cross-group reordering
      const updatedSourceTasks = [...sourceGroup.tasks];
      updatedSourceTasks.splice(taskIdx, 1);

      const updatedTargetTasks = [...targetGroup.tasks];
      if (insertIdx < 0) insertIdx = 0;
      if (insertIdx > updatedTargetTasks.length) insertIdx = updatedTargetTasks.length;
      updatedTargetTasks.splice(insertIdx, 0, movedTask);

      dispatch(reorderTasks({
        activeGroupId: sourceGroup.id,
        overGroupId: targetGroup.id,
        fromIndex: taskIdx,
        toIndex: insertIdx,
        task: movedTask,
        updatedSourceTasks,
        updatedTargetTasks,
      }));
      dispatch(reorderEnhancedKanbanTasks({
        activeGroupId: sourceGroup.id,
        overGroupId: targetGroup.id,
        fromIndex: taskIdx,
        toIndex: insertIdx,
        task: movedTask,
        updatedSourceTasks,
        updatedTargetTasks,
      }) as any);
    }

    // Socket emit for task order
    if (socket && projectId && teamId && movedTask) {
      let toSortOrder = -1;
      let toLastIndex = false;
      if (insertIdx === targetGroup.tasks.length) {
        toSortOrder = -1;
        toLastIndex = true;
      } else if (targetGroup.tasks[insertIdx]) {
        const sortOrder = targetGroup.tasks[insertIdx].sort_order;
        toSortOrder = typeof sortOrder === 'number' ? sortOrder : 0;
        toLastIndex = false;
      } else if (targetGroup.tasks.length > 0) {
        const lastSortOrder = targetGroup.tasks[targetGroup.tasks.length - 1].sort_order;
        toSortOrder = typeof lastSortOrder === 'number' ? lastSortOrder : 0;
        toLastIndex = false;
      }
      socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), {
        project_id: projectId,
        from_index: movedTask.sort_order ?? 0,
        to_index: toSortOrder,
        to_last_index: toLastIndex,
        from_group: sourceGroup.id,
        to_group: targetGroup.id,
        group_by: groupBy || 'status',
        task: movedTask,
        team_id: teamId,
      });

      // Emit progress update if status changed
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
    }

    setDraggedTaskId(null);
    setDraggedTaskGroupId(null);
    setHoveredGroupId(null);
    setHoveredTaskIdx(null);
    setDragType(null);
  };

  const handleDragEnd = () => {
    setHoveredGroupId(null);
    setHoveredTaskIdx(null);
  };

  // Note: Socket event handlers are now managed by useTaskSocketHandlers hook
  // This includes TASK_NAME_CHANGE, QUICK_TASK, and other real-time updates

  if (error) {
    return (
      <Card>
        <Empty description={`Error loading tasks: ${error}`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4">
        <React.Suspense fallback={<div>Loading filters...</div>}>
          <ImprovedTaskFilters position="board" />
        </React.Suspense>
      </div>
      <div className="enhanced-kanban-board">
        {loadingGroups ? (
            <div className="flex flex-row gap-2 h-[600px]">
              <div className="rounded bg-gray-200 dark:bg-gray-700 animate-pulse w-1/4" style={{ height: '60%' }} />
              <div className="rounded bg-gray-200 dark:bg-gray-700 animate-pulse w-1/4" style={{ height: '100%' }} />
              <div className="rounded bg-gray-200 dark:bg-gray-700 animate-pulse w-1/4" style={{ height: '80%' }} />
              <div className="rounded bg-gray-200 dark:bg-gray-700 animate-pulse w-1/4" style={{ height: '40%' }} />
            </div>
        ) : taskGroups.length === 0 ? (
          <Card>
            <Empty description="No tasks found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                hoveredTaskIdx={hoveredGroupId === group.id ? hoveredTaskIdx : null}
                hoveredGroupId={hoveredGroupId}
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