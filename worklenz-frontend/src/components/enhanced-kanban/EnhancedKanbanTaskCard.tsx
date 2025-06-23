import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import './EnhancedKanbanTaskCard.css';

interface EnhancedKanbanTaskCardProps {
  task: IProjectTask;
  isActive?: boolean;
  isDragOverlay?: boolean;
  isDropTarget?: boolean;
}

const EnhancedKanbanTaskCard: React.FC<EnhancedKanbanTaskCardProps> = React.memo(({
  task,
  isActive = false,
  isDragOverlay = false,
  isDropTarget = false
}) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id!,
    data: {
      type: 'task',
      task,
    },
    disabled: isDragOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: themeMode === 'dark' ? '#292929' : '#fafafa',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`enhanced-kanban-task-card ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOverlay ? 'drag-overlay' : ''} ${isDropTarget ? 'drop-target' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="task-content">
        <div className="task-title" title={task.name}>{task.name}</div>
        {/* {task.task_key && <div className="task-key">{task.task_key}</div>} */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="task-assignees">
            Assignees: {task.assignees.map(a => a.name).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
});

export default EnhancedKanbanTaskCard; 