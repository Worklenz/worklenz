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
  IGroupBy,
  setGroup,
  fetchTaskGroups,
  reorderTasks,
} from '@/features/tasks/tasks.slice';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import TaskGroup from './TaskGroup';
import TaskRow from './TaskRow';
import BulkActionBar from './BulkActionBar';
import { AppDispatch } from '@/app/store';

// Import the TaskListFilters component
const TaskListFilters = React.lazy(() => import('@/pages/projects/projectView/taskList/task-list-filters/task-list-filters'));

interface TaskListBoardProps {
  projectId: string;
  className?: string;
}

interface DragState {
  activeTask: IProjectTask | null;
  activeGroupId: string | null;
}

const TaskListBoard: React.FC<TaskListBoardProps> = ({ projectId, className = '' }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [dragState, setDragState] = useState<DragState>({
    activeTask: null,
    activeGroupId: null,
  });

  // Redux selectors
  const {
    taskGroups,
    loadingGroups,
    error,
    groupBy,
    search,
    archived,
  } = useSelector((state: RootState) => state.taskReducer);

  // Selection state
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

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
      dispatch(fetchTaskGroups(projectId));
    }
  }, [dispatch, projectId, groupBy, search, archived]);

  // Memoized calculations
  const allTaskIds = useMemo(() => {
    return taskGroups.flatMap(group => group.tasks.map(task => task.id!));
  }, [taskGroups]);

  const totalTasksCount = useMemo(() => {
    return taskGroups.reduce((sum, group) => sum + group.tasks.length, 0);
  }, [taskGroups]);

  const hasSelection = selectedTaskIds.length > 0;

  // Handlers
  const handleGroupingChange = (newGroupBy: IGroupBy) => {
    dispatch(setGroup(newGroupBy));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = active.id as string;
    
    // Find the task and its group
    let activeTask: IProjectTask | null = null;
    let activeGroupId: string | null = null;

    for (const group of taskGroups) {
      const task = group.tasks.find(t => t.id === taskId);
      if (task) {
        activeTask = task;
        activeGroupId = group.id;
        break;
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
    
    // Determine if dropping on a group or task
    const overGroup = taskGroups.find(g => g.id === overContainer);
    let targetGroupId = overContainer;
    let targetIndex = -1;

    if (!overGroup) {
      // Dropping on a task, find which group it belongs to
      for (const group of taskGroups) {
        const taskIndex = group.tasks.findIndex(t => t.id === overContainer);
        if (taskIndex !== -1) {
          targetGroupId = group.id;
          targetIndex = taskIndex;
          break;
        }
      }
    }

    const sourceGroup = taskGroups.find(g => g.id === dragState.activeGroupId);
    const targetGroup = taskGroups.find(g => g.id === targetGroupId);

    if (!sourceGroup || !targetGroup) return;

    const sourceIndex = sourceGroup.tasks.findIndex(t => t.id === activeTaskId);
    if (sourceIndex === -1) return;

    // Calculate new positions
    const finalTargetIndex = targetIndex === -1 ? targetGroup.tasks.length : targetIndex;

    // Create updated task arrays
    const updatedSourceTasks = [...sourceGroup.tasks];
    const [movedTask] = updatedSourceTasks.splice(sourceIndex, 1);

    let updatedTargetTasks: IProjectTask[];
    if (sourceGroup.id === targetGroup.id) {
      // Moving within the same group
      updatedTargetTasks = updatedSourceTasks;
      updatedTargetTasks.splice(finalTargetIndex, 0, movedTask);
    } else {
      // Moving between different groups
      updatedTargetTasks = [...targetGroup.tasks];
      updatedTargetTasks.splice(finalTargetIndex, 0, movedTask);
    }

    // Dispatch the reorder action
    dispatch(reorderTasks({
      activeGroupId: sourceGroup.id,
      overGroupId: targetGroup.id,
      fromIndex: sourceIndex,
      toIndex: finalTargetIndex,
      task: movedTask,
      updatedSourceTasks,
      updatedTargetTasks,
    }));
  };



  const handleSelectTask = (taskId: string, selected: boolean) => {
    setSelectedTaskIds(prev => {
      if (selected) {
        return [...prev, taskId];
      } else {
        return prev.filter(id => id !== taskId);
      }
    });
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
          currentGrouping={groupBy}
          projectId={projectId}
        />
      )}

      {/* Task Groups Container */}
      <div className="task-groups-container">
        {loadingGroups ? (
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
                  currentGrouping={groupBy}
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
                  currentGrouping={groupBy}
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
          overflow-x: auto;
          max-height: calc(100vh - 300px);
          overflow-y: auto;
          padding: 8px 8px 8px 0;
          border-radius: 8px;
          transition: background-color 0.3s ease;
        }

        .task-groups {
          min-width: fit-content;
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