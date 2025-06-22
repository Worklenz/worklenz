import React, { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Card, Spin, Empty } from 'antd';
import { RootState } from '@/app/store';
import { 
  taskManagementSelectors,
  reorderTasks,
  moveTaskToGroup,
  setLoading,
  fetchTasks
} from '@/features/task-management/task-management.slice';
import { 
  selectTaskGroups,
  selectCurrentGrouping,
  setCurrentGrouping
} from '@/features/task-management/grouping.slice';
import {
  selectSelectedTaskIds,
  toggleTaskSelection,
  clearSelection
} from '@/features/task-management/selection.slice';
import { Task } from '@/types/task-management.types';
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import TaskGroup from './task-group';
import TaskRow from './task-row';
import BulkActionBar from './bulk-action-bar';
import { AppDispatch } from '@/app/store';

// Import the TaskListFilters component
const TaskListFilters = React.lazy(() => import('@/pages/projects/projectView/taskList/task-list-filters/task-list-filters'));

interface TaskListBoardProps {
  projectId: string;
  className?: string;
}

interface DragState {
  activeTask: Task | null;
  activeGroupId: string | null;
}

const TaskListBoard: React.FC<TaskListBoardProps> = ({ projectId, className = '' }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [dragState, setDragState] = useState<DragState>({
    activeTask: null,
    activeGroupId: null,
  });

  // Enable real-time socket updates for task changes
  useTaskSocketHandlers();

  // Redux selectors using new task management slices
  const tasks = useSelector(taskManagementSelectors.selectAll);
  const taskGroups = useSelector(selectTaskGroups);
  const currentGrouping = useSelector(selectCurrentGrouping);
  const selectedTaskIds = useSelector(selectSelectedTaskIds);
  const loading = useSelector((state: RootState) => state.taskManagement.loading);
  const error = useSelector((state: RootState) => state.taskManagement.error);

  // Drag and Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch task groups when component mounts or dependencies change
  useEffect(() => {
    if (projectId) {
      // Fetch real tasks from API
      dispatch(fetchTasks(projectId));
    }
  }, [dispatch, projectId, currentGrouping]);

  // Memoized calculations
  const allTaskIds = useMemo(() => {
    return tasks.map(task => task.id);
  }, [tasks]);

  const totalTasksCount = useMemo(() => {
    return tasks.length;
  }, [tasks]);

  const hasSelection = selectedTaskIds.length > 0;

  // Handlers
  const handleGroupingChange = (newGroupBy: typeof currentGrouping) => {
    dispatch(setCurrentGrouping(newGroupBy));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = active.id as string;
    
    // Find the task and its group
    const activeTask = tasks.find(t => t.id === taskId) || null;
    let activeGroupId: string | null = null;

    if (activeTask) {
      // Determine group ID based on current grouping
      if (currentGrouping === 'status') {
        activeGroupId = `status-${activeTask.status}`;
      } else if (currentGrouping === 'priority') {
        activeGroupId = `priority-${activeTask.priority}`;
      } else if (currentGrouping === 'phase') {
        activeGroupId = `phase-${activeTask.phase}`;
      }
    }

    setDragState({
      activeTask,
      activeGroupId,
    });
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over logic if needed for visual feedback
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setDragState({
      activeTask: null,
      activeGroupId: null,
    });

    if (!over || !dragState.activeTask || !dragState.activeGroupId) {
      return;
    }

    const activeTaskId = active.id as string;
    const overContainer = over.id as string;
    
    // Parse the group ID to get group type and value
    const parseGroupId = (groupId: string) => {
      const [groupType, ...groupValueParts] = groupId.split('-');
      return {
        groupType: groupType as 'status' | 'priority' | 'phase',
        groupValue: groupValueParts.join('-')
      };
    };

    // Determine target group
    let targetGroupId = overContainer;
    let targetIndex = -1;

    // Check if dropping on a task or a group
    const targetTask = tasks.find(t => t.id === overContainer);
    if (targetTask) {
      // Dropping on a task, determine its group
      if (currentGrouping === 'status') {
        targetGroupId = `status-${targetTask.status}`;
      } else if (currentGrouping === 'priority') {
        targetGroupId = `priority-${targetTask.priority}`;
      } else if (currentGrouping === 'phase') {
        targetGroupId = `phase-${targetTask.phase}`;
      }
      
      // Find the index of the target task within its group
      const targetGroup = taskGroups.find(g => g.id === targetGroupId);
      if (targetGroup) {
        targetIndex = targetGroup.taskIds.indexOf(targetTask.id);
      }
    }

    const sourceGroupInfo = parseGroupId(dragState.activeGroupId);
    const targetGroupInfo = parseGroupId(targetGroupId);

    // If moving between different groups, update the task's group property
    if (dragState.activeGroupId !== targetGroupId) {
      dispatch(moveTaskToGroup({
        taskId: activeTaskId,
        groupType: targetGroupInfo.groupType,
        groupValue: targetGroupInfo.groupValue
      }));
    }

    // Handle reordering within the same group or between groups
    const sourceGroup = taskGroups.find(g => g.id === dragState.activeGroupId);
    const targetGroup = taskGroups.find(g => g.id === targetGroupId);

    if (sourceGroup && targetGroup) {
      const sourceIndex = sourceGroup.taskIds.indexOf(activeTaskId);
      const finalTargetIndex = targetIndex === -1 ? targetGroup.taskIds.length : targetIndex;

      // Calculate new order values
      const allTasksInTargetGroup = targetGroup.taskIds.map(id => tasks.find(t => t.id === id)!);
      const newOrder = allTasksInTargetGroup.map((task, index) => {
        if (index < finalTargetIndex) return task.order;
        if (index === finalTargetIndex) return dragState.activeTask!.order;
        return task.order + 1;
      });

      // Dispatch reorder action
      dispatch(reorderTasks({
        taskIds: [activeTaskId, ...allTasksInTargetGroup.map(t => t.id)],
        newOrder: [dragState.activeTask!.order, ...newOrder]
      }));
    }
  };

  const handleSelectTask = (taskId: string, selected: boolean) => {
    dispatch(toggleTaskSelection(taskId));
  };

  const handleToggleSubtasks = (taskId: string) => {
    // Implementation for toggling subtasks
    console.log('Toggle subtasks for task:', taskId);
  };

  if (error) {
    return (
      <Card className={className}>
        <Empty 
          description={`Error loading tasks: ${error}`}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  return (
    <div className={`task-list-board ${className}`}>
      {/* Task Filters */}
      <Card 
        size="small" 
        className="mb-4"
        styles={{ body: { padding: '12px 16px' } }}
      >
        <React.Suspense fallback={<div>Loading filters...</div>}>
          <TaskListFilters position="list" />
        </React.Suspense>
      </Card>

      {/* Bulk Action Bar */}
      {hasSelection && (
        <BulkActionBar
          selectedTaskIds={selectedTaskIds}
          totalSelected={selectedTaskIds.length}
          currentGrouping={currentGrouping as any}
          projectId={projectId}
          onClearSelection={() => dispatch(clearSelection())}
        />
      )}

      {/* Task Groups Container */}
      <div className="task-groups-container">
        {loading ? (
          <Card>
            <div className="flex justify-center items-center py-8">
              <Spin size="large" />
            </div>
          </Card>
        ) : taskGroups.length === 0 ? (
          <Card>
            <Empty 
              description="No tasks found"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="task-groups">
              {taskGroups.map((group) => (
                <TaskGroup
                  key={group.id}
                  group={group}
                  projectId={projectId}
                  currentGrouping={currentGrouping}
                  selectedTaskIds={selectedTaskIds}
                  onSelectTask={handleSelectTask}
                  onToggleSubtasks={handleToggleSubtasks}
                />
              ))}
            </div>

            <DragOverlay>
              {dragState.activeTask ? (
                <TaskRow
                  task={dragState.activeTask}
                  projectId={projectId}
                  groupId={dragState.activeGroupId!}
                  currentGrouping={currentGrouping}
                  isSelected={false}
                  isDragOverlay
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <style>{`
        .task-groups-container {
          max-height: calc(100vh - 300px);
          overflow-y: auto;
          overflow-x: visible;
          padding: 8px 8px 8px 0;
          border-radius: 8px;
          transition: background-color 0.3s ease;
          position: relative;
        }

        .task-groups {
          min-width: fit-content;
          position: relative;
        }

        /* Dark mode support */
        :root {
          --task-bg-primary: #ffffff;
          --task-bg-secondary: #f5f5f5;
          --task-bg-tertiary: #f8f9fa;
          --task-border-primary: #e8e8e8;
          --task-border-secondary: #f0f0f0;
          --task-border-tertiary: #d9d9d9;
          --task-text-primary: #262626;
          --task-text-secondary: #595959;
          --task-text-tertiary: #8c8c8c;
          --task-shadow: rgba(0, 0, 0, 0.1);
          --task-hover-bg: #fafafa;
          --task-selected-bg: #e6f7ff;
          --task-selected-border: #1890ff;
          --task-drag-over-bg: #f0f8ff;
          --task-drag-over-border: #40a9ff;
        }

        .dark .task-groups-container,
        [data-theme="dark"] .task-groups-container {
          --task-bg-primary: #1f1f1f;
          --task-bg-secondary: #141414;
          --task-bg-tertiary: #262626;
          --task-border-primary: #303030;
          --task-border-secondary: #404040;
          --task-border-tertiary: #505050;
          --task-text-primary: #ffffff;
          --task-text-secondary: #d9d9d9;
          --task-text-tertiary: #8c8c8c;
          --task-shadow: rgba(0, 0, 0, 0.3);
          --task-hover-bg: #2a2a2a;
          --task-selected-bg: #1a2332;
          --task-selected-border: #1890ff;
          --task-drag-over-bg: #1a2332;
          --task-drag-over-border: #40a9ff;
        }
      `}</style>
    </div>
  );
};

export default TaskListBoard; 