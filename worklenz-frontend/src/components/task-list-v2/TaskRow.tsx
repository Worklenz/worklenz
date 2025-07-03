import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HolderOutlined } from '@ant-design/icons';
import { Task } from '@/types/task-management.types';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import Avatar from '@/components/Avatar';
import AssigneeSelector from '@/components/AssigneeSelector';
import { format } from 'date-fns';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { ClockIcon } from '@heroicons/react/24/outline';
import AvatarGroup from '../AvatarGroup';
import { DEFAULT_TASK_NAME } from '@/shared/constants';

interface TaskRowProps {
  task: Task;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
}

// Utility function to get task display name with fallbacks
const getTaskDisplayName = (task: Task): string => {
  // Check each field and only use if it has actual content after trimming
  if (task.title && task.title.trim()) return task.title.trim();
  if (task.name && task.name.trim()) return task.name.trim();
  if (task.task_key && task.task_key.trim()) return task.task_key.trim();
  return DEFAULT_TASK_NAME;
};

const TaskRow: React.FC<TaskRowProps> = ({ task, visibleColumns }) => {
  // Drag and drop functionality
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Convert Task to IProjectTask format for AssigneeSelector compatibility
  const convertTaskToProjectTask = (task: Task) => {
    return {
      id: task.id,
      name: getTaskDisplayName(task),
      task_key: task.task_key || getTaskDisplayName(task),
      assignees:
        task.assignee_names?.map((assignee: InlineMember, index: number) => ({
          team_member_id: assignee.team_member_id || `assignee-${index}`,
          id: assignee.team_member_id || `assignee-${index}`,
          project_member_id: assignee.team_member_id || `assignee-${index}`,
          name: assignee.name || '',
        })) || [],
      parent_task_id: task.parent_task_id,
      // Add other required fields with defaults
      status_id: undefined,
      project_id: undefined,
      manual_progress: undefined, // Required field
    };
  };

  const renderColumn = (columnId: string, width: string, isSticky?: boolean, index?: number) => {
    const baseStyle = {
      width,
      // Removed sticky functionality to prevent overlap with group headers
      // ...(isSticky
      //   ? {
      //       position: 'sticky' as const,
      //       left: index === 0 ? 0 : index === 1 ? 32 : 132,
      //       backgroundColor: 'inherit',
      //       zIndex: 1,
      //     }
      //   : {}),
    };

    switch (columnId) {
      case 'dragHandle':
        return (
          <div 
            className="cursor-grab active:cursor-grabbing flex items-center justify-center" 
            style={baseStyle}
            {...attributes}
            {...listeners}
          >
            <HolderOutlined className="text-gray-400 hover:text-gray-600" />
          </div>
        );

      case 'taskKey':
        return (
          <div className="flex items-center" style={baseStyle}>
            <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
              {task.task_key || 'N/A'}
            </span>
          </div>
        );

      case 'title':
        return (
          <div className="flex items-center" style={baseStyle}>
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {getTaskDisplayName(task)}
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
            {/* Show existing assignee avatars */}
            {
              <AvatarGroup
                members={task.assignee_names || []}
                maxCount={3}
                isDarkMode={document.documentElement.classList.contains('dark')}
                size={24}
              />
            }
            {/* Add AssigneeSelector for adding/managing assignees */}
            <AssigneeSelector
              task={convertTaskToProjectTask(task)}
              groupId={null}
              isDarkMode={document.documentElement.classList.contains('dark')}
            />
          </div>
        );

      case 'priority':
        return (
          <div style={baseStyle}>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: task.priorityColor
                  ? `${task.priorityColor}20`
                  : 'rgb(229, 231, 235)',
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
            {task.timeTracking?.estimated && (
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
            {task.created_at && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {format(new Date(task.created_at), 'MMM d')}
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
              <span className="text-sm text-gray-500 dark:text-gray-400">{task.reporter}</span>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`flex items-center min-w-max px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
        isDragging ? 'shadow-lg border border-blue-300' : ''
      }`}
    >
      {visibleColumns.map((column, index) =>
        renderColumn(column.id, column.width, column.isSticky, index)
      )}
    </div>
  );
};

export default TaskRow;
