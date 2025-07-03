import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

interface TaskCardProps {
  task: IProjectTask;
  onTaskDragStart: (e: React.DragEvent, taskId: string, groupId: string) => void;
  onTaskDragOver: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
  onTaskDrop: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
  groupId: string;
  isDropIndicator: boolean;
  idx: number;
}

const TaskCard: React.FC<TaskCardProps> = memo(({ 
  task, 
  onTaskDragStart, 
  onTaskDragOver, 
  onTaskDrop, 
  groupId, 
  isDropIndicator, 
  idx 
}) => {
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);
  const background = themeMode === 'dark' ? '#23272f' : '#fff';
  const color = themeMode === 'dark' ? '#fff' : '#23272f';

  return (
    <>
      {isDropIndicator && (
        <div 
          style={{ 
            height: 80, 
            margin: '8px 0', 
            background: themeMode === 'dark' ? '#2a2a2a' : '#f0f0f0', 
            borderRadius: 6, 
            border: `5px` 
          }} 
        />
      )}
      <div
        className="enhanced-kanban-task-card"
        draggable
        onDragStart={e => onTaskDragStart(e, task.id!, groupId)}
        onDragOver={e => onTaskDragOver(e, groupId, idx)}
        onDrop={e => onTaskDrop(e, groupId, idx)}
        style={{ background, color }}
      >
        <div className="task-content">
          <div className="task-title">{task.name}</div>
          <div className="task-key">{task.task_key}</div>
          <div className="task-assignees">
            {task.assignees?.map(a => a.name).join(', ')}
          </div>
        </div>
      </div>
    </>
  );
});

TaskCard.displayName = 'TaskCard';

export default TaskCard; 