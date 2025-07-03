import React from 'react';
import { Task } from '@/types/task-management.types';
import Avatar from '@/components/Avatar';
import { format } from 'date-fns';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { ClockIcon } from '@heroicons/react/24/outline';

interface TaskRowProps {
  task: Task;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, visibleColumns }) => {
  const renderColumn = (columnId: string, width: string, isSticky?: boolean, index?: number) => {
    const baseStyle = {
      width,
      ...(isSticky ? {
        position: 'sticky' as const,
        left: index === 0 ? 0 : index === 1 ? 32 : 132,
        backgroundColor: 'inherit',
        zIndex: 1,
      } : {}),
    };

    switch (columnId) {
      case 'dragHandle':
        return (
          <div 
            className="cursor-move flex items-center justify-center"
            style={baseStyle}
          >
            <Bars3Icon className="w-4 h-4 text-gray-400" />
          </div>
        );

      case 'taskKey':
        return (
          <div 
            className="flex items-center"
            style={baseStyle}
          >
            <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
              {task.task_key}
            </span>
          </div>
        );

      case 'title':
        return (
          <div 
            className="flex items-center"
            style={baseStyle}
          >
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {task.title || task.name}
            </span>
          </div>
        );

      case 'status':
        return (
          <div style={baseStyle}>
            <span 
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: task.statusColor ? `${task.statusColor}20` : 'rgb(229, 231, 235)',
                color: task.statusColor || 'rgb(31, 41, 55)',
              }}
            >
              {task.status}
            </span>
          </div>
        );

      case 'assignees':
        return (
          <div className="flex items-center gap-1" style={baseStyle}>
            {task.assignee_names?.slice(0, 3).map((assignee, index) => (
              <Avatar
                key={index}
                name={assignee.name || ''}
                size="small"
                className="ring-2 ring-white dark:ring-gray-900"
              />
            ))}
            {(task.assignee_names?.length || 0) > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                +{task.assignee_names!.length - 3}
              </span>
            )}
          </div>
        );

      case 'priority':
        return (
          <div style={baseStyle}>
            <span 
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: task.priorityColor ? `${task.priorityColor}20` : 'rgb(229, 231, 235)',
                color: task.priorityColor || 'rgb(31, 41, 55)',
              }}
            >
              {task.priority}
            </span>
          </div>
        );

      case 'dueDate':
        return (
          <div style={baseStyle}>
            {task.dueDate && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {format(new Date(task.dueDate), 'MMM d')}
              </span>
            )}
          </div>
        );

      case 'progress':
        return (
          <div style={baseStyle}>
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        );

      case 'labels':
        return (
          <div className="flex items-center gap-1" style={baseStyle}>
            {task.labels?.slice(0, 2).map((label, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: label.color ? `${label.color}20` : 'rgb(229, 231, 235)',
                  color: label.color || 'rgb(31, 41, 55)',
                }}
              >
                {label.name}
              </span>
            ))}
            {(task.labels?.length || 0) > 2 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{task.labels!.length - 2}
              </span>
            )}
          </div>
        );

      case 'phase':
        return (
          <div style={baseStyle}>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
              {task.phase}
            </span>
          </div>
        );

      case 'timeTracking':
        return (
          <div className="flex items-center gap-1" style={baseStyle}>
            <ClockIcon className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {task.timeTracking?.logged || 0}h
            </span>
            {task.timeTracking?.estimated && (
              <span className="text-sm text-gray-400 dark:text-gray-500">
                /{task.timeTracking.estimated}h
              </span>
            )}
          </div>
        );

      case 'estimation':
        return (
          <div style={baseStyle}>
            {task.timeTracking.estimated && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {task.timeTracking.estimated}h
              </span>
            )}
          </div>
        );

      case 'startDate':
        return (
          <div style={baseStyle}>
            {task.startDate && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {format(new Date(task.startDate), 'MMM d')}
              </span>
            )}
          </div>
        );

      case 'completedDate':
        return (
          <div style={baseStyle}>
            {task.completedAt && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {format(new Date(task.completedAt), 'MMM d')}
              </span>
            )}
          </div>
        );

      case 'createdDate':
        return (
          <div style={baseStyle}>
            {task.createdAt && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {format(new Date(task.createdAt), 'MMM d')}
              </span>
            )}
          </div>
        );

      case 'lastUpdated':
        return (
          <div style={baseStyle}>
            {task.updatedAt && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {format(new Date(task.updatedAt), 'MMM d')}
              </span>
            )}
          </div>
        );

      case 'reporter':
        return (
          <div style={baseStyle}>
            {task.reporter && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {task.reporter}
              </span>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex items-center min-w-max px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
      {visibleColumns.map((column, index) => renderColumn(column.id, column.width, column.isSticky, index))}
    </div>
  );
};

export default TaskRow; 