import React, { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Card, Spin, Empty } from '@/shared/antd-imports';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  UniqueIdentifier,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { RootState } from '@/app/store';
import {
  fetchEnhancedKanbanGroups,
  reorderEnhancedKanbanTasks,
  reorderEnhancedKanbanGroups,
  setDragState,
  reorderTasks,
  reorderGroups,
  fetchEnhancedKanbanTaskAssignees,
  fetchEnhancedKanbanLabels,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import EnhancedKanbanGroup from './EnhancedKanbanGroup';
import './EnhancedKanbanBoard.css';
import { useSocket } from '@/socket/socketContext';
import { useAppSelector } from '@/hooks/useAppSelector';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { ITaskStatusCreateRequest } from '@/types/tasks/task-status-create-request';
import alertService from '@/services/alerts/alertService';
import { IGroupBy } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import EnhancedKanbanCreateSection from './EnhancedKanbanCreateSection';
import ImprovedTaskFilters from '../task-management/improved-task-filters';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { useFilterDataLoader } from '@/hooks/useFilterDataLoader';
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import { useAuthService } from '@/hooks/useAuth';

// Import the TaskListFilters component
const TaskListFilters = React.lazy(
  () => import('@/pages/projects/projectView/taskList/task-list-filters/task-list-filters')
);
interface EnhancedKanbanBoardProps {
  projectId: string;
  className?: string;
}

const EnhancedKanbanBoard: React.FC<EnhancedKanbanBoardProps> = ({ projectId, className = '' }) => {
  const dispatch = useDispatch();
  const { taskGroups, loadingGroups, error, dragState, performanceMetrics } = useSelector(
    (state: RootState) => state.enhancedKanbanReducer
  );
  const { socket } = useSocket();
  const authService = useAuthService();
  const teamId = authService.getCurrentSession()?.team_id;
  const groupBy = useSelector((state: RootState) => state.enhancedKanbanReducer.groupBy);
  const project = useAppSelector((state: RootState) => state.projectReducer.project);
  const { statusCategories, status: existingStatuses } = useAppSelector(
    state => state.taskStatusReducer
  );
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Load filter data
  useFilterDataLoader();

  // Set up socket event handlers for real-time updates
  useTaskSocketHandlers();

  // Local state for drag overlay
  const [activeTask, setActiveTask] = useState<any>(null);
  const [activeGroup, setActiveGroup] = useState<any>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

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

  // Get all task IDs for sortable context
  const allTaskIds = useMemo(
    () => taskGroups.flatMap(group => group.tasks.map(task => task.id!)),
    [taskGroups]
  );
  const allGroupIds = useMemo(() => taskGroups.map(group => group.id), [taskGroups]);

  // Enhanced collision detection
  const collisionDetectionStrategy = (args: any) => {
    // First, let's see if we're colliding with any droppable areas
    const pointerIntersections = pointerWithin(args);
    const intersections =
      pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);

    let overId = getFirstCollision(intersections, 'id');

    if (overId) {
      // Check if we're over a task or a group
      const overGroup = taskGroups.find(g => g.id === overId);

      if (overGroup) {
        // We're over a group, check if there are tasks in it
        if (overGroup.tasks.length > 0) {
          // Find the closest task within this group
          const taskIntersections = pointerWithin({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (container: any) => container.data.current?.type === 'task'
            ),
          });

          if (taskIntersections.length > 0) {
            overId = taskIntersections[0].id;
          }
        }
      }
    }

    return overId ? [{ id: overId }] : [];
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    const activeData = active.data.current;

    // Check if dragging a group or a task
    if (activeData?.type === 'group') {
      // Dragging a group
      const foundGroup = taskGroups.find(g => g.id === activeId);
      setActiveGroup(foundGroup);
      setActiveTask(null);

      dispatch(
        setDragState({
          activeTaskId: null,
          activeGroupId: activeId,
          isDragging: true,
        })
      );
    } else {
      // Dragging a task
      let foundTask = null;
      let foundGroup = null;

      for (const group of taskGroups) {
        const task = group.tasks.find(t => t.id === activeId);
        if (task) {
          foundTask = task;
          foundGroup = group;
          break;
        }
      }

      setActiveTask(foundTask);
      setActiveGroup(null);

      dispatch(
        setDragState({
          activeTaskId: activeId,
          activeGroupId: foundGroup?.id || null,
          isDragging: true,
        })
      );
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      setOverId(null);
      dispatch(setDragState({ overId: null }));
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    setOverId(overId);

    // Update over ID in Redux
    dispatch(setDragState({ overId }));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeData = active.data.current;

    // Reset local state
    setActiveTask(null);
    setActiveGroup(null);
    setOverId(null);

    // Reset Redux drag state
    dispatch(
      setDragState({
        activeTaskId: null,
        activeGroupId: null,
        overId: null,
        isDragging: false,
      })
    );

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Handle group (column) reordering
    if (activeData?.type === 'group') {
      // Don't allow reordering if groupBy is phases
      if (groupBy === IGroupBy.PHASE) {
        return;
      }

      const fromIndex = taskGroups.findIndex(g => g.id === activeId);
      const toIndex = taskGroups.findIndex(g => g.id === overId);

      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        // Create new array with reordered groups
        const reorderedGroups = [...taskGroups];
        const [movedGroup] = reorderedGroups.splice(fromIndex, 1);
        reorderedGroups.splice(toIndex, 0, movedGroup);

        // Synchronous UI update for immediate feedback
        dispatch(reorderGroups({ fromIndex, toIndex, reorderedGroups }));
        dispatch(reorderEnhancedKanbanGroups({ fromIndex, toIndex, reorderedGroups }) as any);

        // Prepare column order for API
        const columnOrder = reorderedGroups.map(group => group.id);

        // Call API to update status order
        try {
          const requestBody: ITaskStatusCreateRequest = {
            status_order: columnOrder,
          };

          const response = await statusApiService.updateStatusOrder(requestBody, projectId);
          if (!response.done) {
            // Revert the change if API call fails
            const revertedGroups = [...reorderedGroups];
            const [movedBackGroup] = revertedGroups.splice(toIndex, 1);
            revertedGroups.splice(fromIndex, 0, movedBackGroup);
            dispatch(
              reorderGroups({
                fromIndex: toIndex,
                toIndex: fromIndex,
                reorderedGroups: revertedGroups,
              })
            );
            alertService.error('Failed to update column order', 'Please try again');
          }
        } catch (error) {
          // Revert the change if API call fails
          const revertedGroups = [...reorderedGroups];
          const [movedBackGroup] = revertedGroups.splice(toIndex, 1);
          revertedGroups.splice(fromIndex, 0, movedBackGroup);
          dispatch(
            reorderGroups({
              fromIndex: toIndex,
              toIndex: fromIndex,
              reorderedGroups: revertedGroups,
            })
          );
          alertService.error('Failed to update column order', 'Please try again');
          logger.error('Failed to update column order', error);
        }
      }
      return;
    }

    // Handle task reordering (within or between groups)
    let sourceGroup = null;
    let targetGroup = null;
    let sourceIndex = -1;
    let targetIndex = -1;

    // Find source group and index
    for (const group of taskGroups) {
      const taskIndex = group.tasks.findIndex(t => t.id === activeId);
      if (taskIndex !== -1) {
        sourceGroup = group;
        sourceIndex = taskIndex;
        break;
      }
    }

    // Find target group and index
    for (const group of taskGroups) {
      const taskIndex = group.tasks.findIndex(t => t.id === overId);
      if (taskIndex !== -1) {
        targetGroup = group;
        targetIndex = taskIndex;
        break;
      }
    }

    // If dropping on a group (not a task)
    if (!targetGroup) {
      targetGroup = taskGroups.find(g => g.id === overId);
      if (targetGroup) {
        targetIndex = targetGroup.tasks.length; // Add to end of group
      }
    }

    if (!sourceGroup || !targetGroup || sourceIndex === -1) return;

    // Don't do anything if dropping in the same position
    if (sourceGroup.id === targetGroup.id && sourceIndex === targetIndex) return;

    // Create updated task arrays
    const updatedSourceTasks = [...sourceGroup.tasks];
    const [movedTask] = updatedSourceTasks.splice(sourceIndex, 1);

    let updatedTargetTasks: any[];
    if (sourceGroup.id === targetGroup.id) {
      // Moving within the same group
      updatedTargetTasks = updatedSourceTasks;
      updatedTargetTasks.splice(targetIndex, 0, movedTask);
    } else {
      // Moving between different groups
      updatedTargetTasks = [...targetGroup.tasks];
      updatedTargetTasks.splice(targetIndex, 0, movedTask);
    }

    // Synchronous UI update
    dispatch(
      reorderTasks({
        activeGroupId: sourceGroup.id,
        overGroupId: targetGroup.id,
        fromIndex: sourceIndex,
        toIndex: targetIndex,
        task: movedTask,
        updatedSourceTasks,
        updatedTargetTasks,
      })
    );
    dispatch(
      reorderEnhancedKanbanTasks({
        activeGroupId: sourceGroup.id,
        overGroupId: targetGroup.id,
        fromIndex: sourceIndex,
        toIndex: targetIndex,
        task: movedTask,
        updatedSourceTasks,
        updatedTargetTasks,
      }) as any
    );

    // --- Socket emit for task sort order ---
    if (socket && projectId && movedTask) {
      // Find sort_order for from and to
      const fromSortOrder = movedTask.sort_order;
      let toSortOrder = -1;
      let toLastIndex = false;
      if (targetIndex === targetGroup.tasks.length) {
        // Dropping at the end
        toSortOrder = -1;
        toLastIndex = true;
      } else if (targetGroup.tasks[targetIndex]) {
        toSortOrder =
          typeof targetGroup.tasks[targetIndex].sort_order === 'number'
            ? targetGroup.tasks[targetIndex].sort_order!
            : -1;
        toLastIndex = false;
      } else if (targetGroup.tasks.length > 0) {
        const lastSortOrder = targetGroup.tasks[targetGroup.tasks.length - 1].sort_order;
        toSortOrder = typeof lastSortOrder === 'number' ? lastSortOrder! : -1;
        toLastIndex = false;
      }
      const body = {
        project_id: projectId,
        from_index: fromSortOrder,
        to_index: toSortOrder,
        to_last_index: toLastIndex,
        from_group: sourceGroup.id,
        to_group: targetGroup.id,
        group_by: groupBy || 'status',
        task: movedTask,
        team_id: teamId || project?.team_id || '',
      };
      socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), body);
    }
  };

  if (error) {
    return (
      <Card className={className}>
        <Empty description={`Error loading tasks: ${error}`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  return (
    <>
      {/* Task Filters */}
      <div className="mb-4">
        <React.Suspense fallback={<div>Loading filters...</div>}>
          <ImprovedTaskFilters position="board" />
        </React.Suspense>
      </div>
      <div className={`enhanced-kanban-board ${className}`}>
        {/* Performance Monitor - only show for large datasets */}
        {/* {performanceMetrics.totalTasks > 100 && <PerformanceMonitor />} */}

        {loadingGroups ? (
          <Card>
            <div className="flex justify-center items-center py-8">
              <Spin size="large" />
            </div>
          </Card>
        ) : taskGroups.length === 0 ? (
          <Card>
            <Empty description="No tasks found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={allGroupIds} strategy={horizontalListSortingStrategy}>
              <div className="kanban-groups-container">
                {taskGroups.map(group => (
                  <EnhancedKanbanGroup
                    key={group.id}
                    group={group}
                    activeTaskId={dragState.activeTaskId}
                    overId={overId as string | null}
                  />
                ))}
                <EnhancedKanbanCreateSection />
              </div>
            </SortableContext>

            <DragOverlay>
              {activeTask && (
                <div
                  style={{
                    background: themeMode === 'dark' ? '#23272f' : '#fff',
                    borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    padding: '12px 20px',
                    minWidth: 180,
                    maxWidth: 340,
                    opacity: 0.95,
                    fontWeight: 600,
                    fontSize: 16,
                    color: themeMode === 'dark' ? '#fff' : '#23272f',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {activeTask.name}
                </div>
              )}
              {activeGroup && (
                <div
                  style={{
                    background: themeMode === 'dark' ? '#23272f' : '#fff',
                    borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    padding: '16px 24px',
                    minWidth: 220,
                    maxWidth: 320,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    opacity: 0.95,
                  }}
                >
                  <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>{activeGroup.name}</h3>
                  <span style={{ fontSize: 15, color: '#888' }}>({activeGroup.tasks.length})</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </>
  );
};

export default EnhancedKanbanBoard;
