import React, { useMemo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSelector } from 'react-redux';
import {
  HolderOutlined,
  MessageOutlined,
  PaperClipOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { Task } from '@/types/task-management.types';
import { RootState } from '@/app/store';
import { AssigneeSelector, Avatar, AvatarGroup, Button, Checkbox, CustomColordLabel, CustomNumberLabel, LabelsSelector, Progress, Tag, Tooltip } from '@/components';

interface TaskRowProps {
  task: Task;
  projectId: string;
  groupId: string;
  currentGrouping: 'status' | 'priority' | 'phase';
  isSelected: boolean;
  isDragOverlay?: boolean;
  index?: number;
  onSelect?: (taskId: string, selected: boolean) => void;
  onToggleSubtasks?: (taskId: string) => void;
}

// Priority and status colors - moved outside component to avoid recreation
const PRIORITY_COLORS = {
  critical: '#ff4d4f',
  high: '#ff7a45',
  medium: '#faad14',
  low: '#52c41a',
} as const;

const STATUS_COLORS = {
  todo: '#f0f0f0',
  doing: '#1890ff',
  done: '#52c41a',
} as const;

const TaskRow: React.FC<TaskRowProps> = React.memo(({
  task,
  projectId,
  groupId,
  currentGrouping,
  isSelected,
  isDragOverlay = false,
  index,
  onSelect,
  onToggleSubtasks,
}) => {
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
      taskId: task.id,
      groupId,
    },
    disabled: isDragOverlay,
  });

  // Get theme from Redux store
  const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');

  // Memoize style calculations - simplified
  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }), [transform, transition, isDragging]);

  // Memoize event handlers to prevent unnecessary re-renders
  const handleSelectChange = useCallback((checked: boolean) => {
    onSelect?.(task.id, checked);
  }, [onSelect, task.id]);

  const handleToggleSubtasks = useCallback(() => {
    onToggleSubtasks?.(task.id);
  }, [onToggleSubtasks, task.id]);

  // Memoize assignees for AvatarGroup to prevent unnecessary re-renders
  const avatarGroupMembers = useMemo(() => {
    return task.assignee_names || [];
  }, [task.assignee_names]);

  // Simplified class name calculations
  const containerClasses = useMemo(() => {
    const baseClasses = 'border-b transition-all duration-300';
    const themeClasses = isDarkMode 
      ? 'border-gray-700 bg-gray-900 hover:bg-gray-800' 
      : 'border-gray-200 bg-white hover:bg-gray-50';
    const selectedClasses = isSelected 
      ? (isDarkMode ? 'bg-blue-900/20 border-l-4 border-l-blue-500' : 'bg-blue-50 border-l-4 border-l-blue-500')
      : '';
    const overlayClasses = isDragOverlay 
      ? `rounded shadow-lg border-2 ${isDarkMode ? 'bg-gray-900 border-gray-600 shadow-2xl' : 'bg-white border-gray-300 shadow-2xl'}`
      : '';
    
    return `${baseClasses} ${themeClasses} ${selectedClasses} ${overlayClasses}`;
  }, [isDarkMode, isSelected, isDragOverlay]);

  const fixedColumnsClasses = useMemo(() => 
    `flex sticky left-0 z-10 border-r-2 shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`,
    [isDarkMode]
  );

  const taskNameClasses = useMemo(() => {
    const baseClasses = 'text-sm font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-300';
    const themeClasses = isDarkMode ? 'text-gray-100' : 'text-gray-900';
    const completedClasses = task.progress === 100 
      ? `line-through ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}` 
      : '';
    
    return `${baseClasses} ${themeClasses} ${completedClasses}`;
  }, [isDarkMode, task.progress]);

  // Get colors - using constants for better performance
  const getPriorityColor = useCallback((priority: string) => 
    PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || '#d9d9d9', []);
  
  const getStatusColor = useCallback((status: string) => 
    STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#d9d9d9', []);

  // Create adapter for LabelsSelector - memoized
  const taskAdapter = useMemo(() => ({
    id: task.id,
    name: task.title,
    parent_task_id: null,
    all_labels: task.labels?.map(label => ({ 
      id: label.id, 
      name: label.name,
      color_code: label.color 
    })) || [],
    labels: task.labels?.map(label => ({ 
      id: label.id, 
      name: label.name,
      color_code: label.color 
    })) || [],
  } as any), [task.id, task.title, task.labels]);

  // Memoize due date calculation
  const dueDate = useMemo(() => {
    if (!task.dueDate) return null;
    const date = new Date(task.dueDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, color: 'error' };
    } else if (diffDays === 0) {
      return { text: 'Due today', color: 'warning' };
    } else if (diffDays <= 3) {
      return { text: `Due in ${diffDays}d`, color: 'warning' };
    } else {
      return { text: `Due ${date.toLocaleDateString()}`, color: 'default' };
    }
  }, [task.dueDate]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={containerClasses}
    >
      <div className="flex h-10 max-h-10 overflow-visible relative min-w-[1200px]">
        {/* Fixed Columns */}
        <div className={fixedColumnsClasses}>
          {/* Drag Handle */}
          <div className={`w-10 flex items-center justify-center px-2 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <Button
              variant="text"
              size="small"
              icon={<HolderOutlined />}
              className="opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing"
              isDarkMode={isDarkMode}
              {...attributes}
              {...listeners}
            />
          </div>

          {/* Selection Checkbox */}
          <div className={`w-10 flex items-center justify-center px-2 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <Checkbox
              checked={isSelected}
              onChange={handleSelectChange}
              isDarkMode={isDarkMode}
            />
          </div>

          {/* Task Key */}
          <div className={`w-20 flex items-center px-2 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <Tag 
              backgroundColor={isDarkMode ? "#374151" : "#f0f0f0"} 
              color={isDarkMode ? "#d1d5db" : "#666"}
              className="truncate whitespace-nowrap max-w-full"
            >
              {task.task_key}
            </Tag>
          </div>

          {/* Task Name */}
          <div className="w-[475px] flex items-center px-2">
            <div className="flex-1 min-w-0 flex flex-col justify-center h-full overflow-hidden">
              <div className="flex items-center gap-2 h-5 overflow-hidden">
                <span className={taskNameClasses}>
                  {task.title}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Columns */}
        <div className="flex flex-1 min-w-0">
          {/* Progress */}
          <div className={`w-[90px] flex items-center justify-center px-2 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            {task.progress !== undefined && task.progress >= 0 && (
              <Progress
                type="circle"
                percent={task.progress}
                size={24}
                strokeColor={task.progress === 100 ? '#52c41a' : '#1890ff'}
                strokeWidth={2}
                showInfo={true}
                isDarkMode={isDarkMode}
              />
            )}
          </div>

          {/* Members */}
          <div className={`w-[150px] flex items-center px-2 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              {avatarGroupMembers.length > 0 && (
                <AvatarGroup
                  members={avatarGroupMembers}
                  size={24}
                  maxCount={3}
                  isDarkMode={isDarkMode}
                />
              )}
              <button
                className={`
                  w-6 h-6 rounded-full border border-dashed flex items-center justify-center
                  transition-colors duration-200
                  ${isDarkMode 
                    ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800 text-gray-400' 
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-600'
                  }
                `}
                onClick={() => {
                  // TODO: Implement assignee selector functionality
                  console.log('Add assignee clicked for task:', task.id);
                }}
              >
                <span className="text-xs">+</span>
              </button>
            </div>
          </div>

          {/* Labels */}
          <div className={`w-[200px] max-w-[200px] flex items-center px-2 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-1 flex-wrap h-full w-full overflow-visible relative">
              {task.labels?.map((label, index) => (
                label.end && label.names && label.name ? (
                  <CustomNumberLabel 
                    key={`${label.id}-${index}`} 
                    labelList={label.names} 
                    namesString={label.name}
                    isDarkMode={isDarkMode}
                  />
                ) : (
                  <CustomColordLabel 
                    key={`${label.id}-${index}`} 
                    label={label}
                    isDarkMode={isDarkMode}
                  />
                )
              ))}
              <LabelsSelector
                task={taskAdapter}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>

          {/* Status */}
          <div className={`w-[100px] flex items-center px-2 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <Tag
              backgroundColor={getStatusColor(task.status)}
              color="white"
              className="text-xs font-medium uppercase"
            >
              {task.status}
            </Tag>
          </div>

          {/* Priority */}
          <div className={`w-[100px] flex items-center px-2 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getPriorityColor(task.priority) }}
              />
              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {task.priority}
              </span>
            </div>
          </div>

          {/* Time Tracking */}
          <div className={`w-[120px] flex items-center px-2 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 h-full overflow-hidden">
              {task.timeTracking?.logged && task.timeTracking.logged > 0 && (
                <div className="flex items-center gap-1">
                  <ClockCircleOutlined className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {typeof task.timeTracking.logged === 'number' 
                      ? `${task.timeTracking.logged}h`
                      : task.timeTracking.logged
                    }
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Simplified comparison for better performance
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.title === nextProps.task.title &&
    prevProps.task.progress === nextProps.task.progress &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.labels?.length === nextProps.task.labels?.length &&
    prevProps.task.assignee_names?.length === nextProps.task.assignee_names?.length &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragOverlay === nextProps.isDragOverlay &&
    prevProps.groupId === nextProps.groupId
  );
});

TaskRow.displayName = 'TaskRow';

export default TaskRow; 