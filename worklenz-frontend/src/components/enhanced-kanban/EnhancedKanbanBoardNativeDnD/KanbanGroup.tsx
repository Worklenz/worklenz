import React, { memo, useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import TaskCard from './TaskCard';

interface KanbanGroupProps {
  group: ITaskListGroup;
  onGroupDragStart: (e: React.DragEvent, groupId: string) => void;
  onGroupDragOver: (e: React.DragEvent) => void;
  onGroupDrop: (e: React.DragEvent, groupId: string) => void;
  onTaskDragStart: (e: React.DragEvent, taskId: string, groupId: string) => void;
  onTaskDragOver: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
  onTaskDrop: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
  hoveredTaskIdx: number | null;
  hoveredGroupId: string | null;
}

const KanbanGroup: React.FC<KanbanGroupProps> = memo(({ 
  group, 
  onGroupDragStart, 
  onGroupDragOver, 
  onGroupDrop, 
  onTaskDragStart, 
  onTaskDragOver, 
  onTaskDrop, 
  hoveredTaskIdx, 
  hoveredGroupId 
}) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  
  const headerBackgroundColor = useMemo(() => {
    if (themeMode === 'dark') {
      return group.color_code_dark || group.color_code || '#1e1e1e';
    }
    return group.color_code || '#f5f5f5';
  }, [themeMode, group.color_code, group.color_code_dark]);

  return (
    <div className="enhanced-kanban-group">
      <div
        className="enhanced-kanban-group-header"
        style={{
          backgroundColor: headerBackgroundColor,
        }}
        draggable
        onDragStart={e => onGroupDragStart(e, group.id)}
        onDragOver={onGroupDragOver}
        onDrop={e => onGroupDrop(e, group.id)}
      >
        <h3>{group.name}</h3>
        <span className="task-count">{group.tasks.length}</span>
      </div>
      <div className="enhanced-kanban-group-tasks">
        {/* Drop indicator at the top of the group */}
        {hoveredGroupId === group.id && hoveredTaskIdx === 0 && (
          <div className="drop-preview-indicator">
            <div className="drop-line" />
          </div>
        )}
        
        {group.tasks.map((task, idx) => (
          <React.Fragment key={task.id}>
            <TaskCard
              task={task}
              onTaskDragStart={onTaskDragStart}
              onTaskDragOver={onTaskDragOver}
              onTaskDrop={onTaskDrop}
              groupId={group.id}
              isDropIndicator={hoveredGroupId === group.id && hoveredTaskIdx === idx}
              idx={idx}
            />
          </React.Fragment>
        ))}
        
        {/* Drop indicator at the end of the group */}
        {hoveredGroupId === group.id && hoveredTaskIdx === group.tasks.length && (
          <div className="drop-preview-indicator">
            <div className="drop-line" />
          </div>
        )}
      </div>
    </div>
  );
});

KanbanGroup.displayName = 'KanbanGroup';

export default KanbanGroup; 