import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSelector } from 'react-redux';
import { taskManagementSelectors } from '@/features/task-management/task-management.slice';
import { Task } from '@/types/task-management.types';
import TaskRow from './task-row';

interface VirtualizedTaskGroupProps {
  group: any;
  projectId: string;
  currentGrouping: 'status' | 'priority' | 'phase';
  selectedTaskIds: string[];
  onSelectTask: (taskId: string, selected: boolean) => void;
  onToggleSubtasks: (taskId: string) => void;
  height: number;
  width: number;
}

const VirtualizedTaskGroup: React.FC<VirtualizedTaskGroupProps> = React.memo(({
  group,
  projectId,
  currentGrouping,
  selectedTaskIds,
  onSelectTask,
  onToggleSubtasks,
  height,
  width
}) => {
  const allTasks = useSelector(taskManagementSelectors.selectAll);
  
  // Get tasks for this group using memoization for performance
  const groupTasks = useMemo(() => {
    return group.taskIds
      .map((taskId: string) => allTasks.find((task: Task) => task.id === taskId))
      .filter((task: Task | undefined): task is Task => task !== undefined);
  }, [group.taskIds, allTasks]);

  const TASK_ROW_HEIGHT = 40;
  const GROUP_HEADER_HEIGHT = 40;
  const COLUMN_HEADER_HEIGHT = 40;
  const ADD_TASK_ROW_HEIGHT = 40;

  // Calculate total height for the group
  const totalHeight = GROUP_HEADER_HEIGHT + COLUMN_HEADER_HEIGHT + (groupTasks.length * TASK_ROW_HEIGHT) + ADD_TASK_ROW_HEIGHT;

  // Row renderer for virtualization
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    // Header row
    if (index === 0) {
      return (
        <div style={style}>
          <div className="task-group-header">
            <div className="task-group-header-row">
              <div className="task-group-header-content">
                <span className="task-group-header-text">
                  {group.title} ({groupTasks.length})
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Column headers row
    if (index === 1) {
      return (
        <div style={style}>
          <div className="task-group-column-headers">
            <div className="task-group-column-headers-row">
              <div className="task-table-fixed-columns">
                <div className="task-table-cell task-table-header-cell" style={{ width: '40px' }}></div>
                <div className="task-table-cell task-table-header-cell" style={{ width: '40px' }}></div>
                <div className="task-table-cell task-table-header-cell" style={{ width: '80px' }}>
                  <span className="column-header-text">Key</span>
                </div>
                <div className="task-table-cell task-table-header-cell" style={{ width: '475px' }}>
                  <span className="column-header-text">Task</span>
                </div>
              </div>
              <div className="task-table-scrollable-columns">
                <div className="task-table-cell task-table-header-cell" style={{ width: '90px' }}>
                  <span className="column-header-text">Progress</span>
                </div>
                <div className="task-table-cell task-table-header-cell" style={{ width: '100px' }}>
                  <span className="column-header-text">Status</span>
                </div>
                <div className="task-table-cell task-table-header-cell" style={{ width: '150px' }}>
                  <span className="column-header-text">Members</span>
                </div>
                <div className="task-table-cell task-table-header-cell" style={{ width: '200px' }}>
                  <span className="column-header-text">Labels</span>
                </div>
                <div className="task-table-cell task-table-header-cell" style={{ width: '100px' }}>
                  <span className="column-header-text">Priority</span>
                </div>
                <div className="task-table-cell task-table-header-cell" style={{ width: '120px' }}>
                  <span className="column-header-text">Time Tracking</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Task rows
    const taskIndex = index - 2;
    if (taskIndex >= 0 && taskIndex < groupTasks.length) {
      const task = groupTasks[taskIndex];
      return (
        <div style={style}>
          <TaskRow
            task={task}
            projectId={projectId}
            groupId={group.id}
            currentGrouping={currentGrouping}
            isSelected={selectedTaskIds.includes(task.id)}
            index={taskIndex}
            onSelect={onSelectTask}
            onToggleSubtasks={onToggleSubtasks}
          />
        </div>
      );
    }

    // Add task row (last row)
    if (taskIndex === groupTasks.length) {
      return (
        <div style={style}>
          <div className="task-group-add-task">
            <div className="task-table-fixed-columns">
              <div style={{ width: '380px', padding: '8px 12px' }}>
                <span className="text-gray-500">+ Add task</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }, [group, groupTasks, projectId, currentGrouping, selectedTaskIds, onSelectTask, onToggleSubtasks]);

  return (
    <div className="virtualized-task-group">
      <SortableContext items={group.taskIds} strategy={verticalListSortingStrategy}>
        <List
          height={Math.min(height, totalHeight)}
          width={width}
          itemCount={groupTasks.length + 3} // +3 for header, column headers, and add task row
          itemSize={TASK_ROW_HEIGHT}
          overscanCount={5} // Render 5 extra items for smooth scrolling
        >
          {Row}
        </List>
      </SortableContext>
    </div>
  );
});

export default VirtualizedTaskGroup; 