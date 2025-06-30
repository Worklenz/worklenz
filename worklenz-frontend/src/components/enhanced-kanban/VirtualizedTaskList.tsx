import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import EnhancedKanbanTaskCard from './EnhancedKanbanTaskCard';
import './VirtualizedTaskList.css';

interface VirtualizedTaskListProps {
  tasks: IProjectTask[];
  height: number;
  itemHeight?: number;
  activeTaskId?: string | null;
  overId?: string | null;
  onTaskRender?: (task: IProjectTask, index: number) => void;
}

const VirtualizedTaskList: React.FC<VirtualizedTaskListProps> = ({
  tasks,
  height,
  itemHeight = 80,
  activeTaskId,
  overId,
  onTaskRender,
}) => {
  // Memoize task data to prevent unnecessary re-renders
  const taskData = useMemo(() => ({
    tasks,
    activeTaskId,
    overId,
    onTaskRender,
  }), [tasks, activeTaskId, overId, onTaskRender]);

  // Row renderer for virtualized list
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const task = tasks[index];
    if (!task) return null;

    // Call onTaskRender callback if provided
    onTaskRender?.(task, index);

    return (
      <div className="virtualized-task-row" style={style}>
        <EnhancedKanbanTaskCard
          task={task}
          isActive={task.id === activeTaskId}
          isDropTarget={overId === task.id}
          sectionId={task.status || 'default'}
        />
      </div>
    );
  }, [tasks, activeTaskId, overId, onTaskRender]);

  // Memoize the list component to prevent unnecessary re-renders
  const VirtualizedList = useMemo(() => (
    <List
      height={height}
      width="100%"
      itemCount={tasks.length}
      itemSize={itemHeight}
      itemData={taskData}
      overscanCount={10} // Increased overscan for smoother scrolling experience
      className="virtualized-task-list"
    >
      {Row}
    </List>
  ), [height, tasks.length, itemHeight, taskData, Row]);

  if (tasks.length === 0) {
    return (
      <div className="virtualized-empty-state" style={{ height }}>
        <div className="empty-message">No tasks in this group</div>
      </div>
    );
  }

  return VirtualizedList;
};

export default React.memo(VirtualizedTaskList); 