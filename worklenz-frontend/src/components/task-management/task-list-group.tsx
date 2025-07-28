import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, TaskGroup } from '@/types/task-management.types';
import TaskRow from './task-row';

interface TaskListGroupProps {
  group: TaskGroup;
  tasks: Task[];
  isCollapsed: boolean;
  onCollapse: () => void;
  onTaskSelect: (taskId: string, event: React.MouseEvent) => void;
  selectedTaskIds: string[];
  projectId: string;
  currentGrouping: 'status' | 'priority' | 'phase';
}

const TaskListGroup: React.FC<TaskListGroupProps> = ({
  group,
  tasks,
  isCollapsed,
  onCollapse,
  onTaskSelect,
  selectedTaskIds,
  projectId,
  currentGrouping,
}) => {
  const groupStyle = {
    backgroundColor: group.color ? `${group.color}10` : undefined,
    borderColor: group.color,
  };

  const headerStyle = {
    backgroundColor: group.color ? `${group.color}20` : undefined,
  };

  return (
    <div className="task-list-group" style={groupStyle}>
      <div className="group-header" style={headerStyle} onClick={onCollapse}>
        <div className="group-title">
          <span className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`}>
            {isCollapsed ? '►' : '▼'}
          </span>
          <h3>{group.title}</h3>
          <span className="task-count">({tasks.length})</span>
        </div>
      </div>
      {!isCollapsed && (
        <div className="task-list">
          {tasks.map((task, index) => {
            const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
              useSortable({
                id: task.id,
              });

            const style = {
              transform: CSS.Transform.toString(transform),
              transition,
            };

            return (
              <div
                key={task.id}
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={`task-row-wrapper ${isDragging ? 'dragging' : ''}`}
              >
                <TaskRow
                  task={task}
                  projectId={projectId}
                  groupId={group.id}
                  currentGrouping={currentGrouping}
                  isSelected={selectedTaskIds.includes(task.id)}
                  onSelect={(taskId, selected) => onTaskSelect(taskId, {} as React.MouseEvent)}
                  index={index}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TaskListGroup;
