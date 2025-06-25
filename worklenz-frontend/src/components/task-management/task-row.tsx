import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSelector } from 'react-redux';
import { 
  Input, 
  Typography, 
  DatePicker,
  dayjs,
  taskManagementAntdConfig,
  HolderOutlined,
  MessageOutlined,
  PaperClipOutlined,
  ClockCircleOutlined,
  UserOutlined,
  type InputRef
} from './antd-imports';
import { Task } from '@/types/task-management.types';
import { RootState } from '@/app/store';
import { AssigneeSelector, Avatar, AvatarGroup, Button, Checkbox, CustomColordLabel, CustomNumberLabel, LabelsSelector, Progress, Tooltip } from '@/components';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import TaskStatusDropdown from './task-status-dropdown';

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
  columns?: Array<{ key: string; label: string; width: number; fixed?: boolean }>;
  fixedColumns?: Array<{ key: string; label: string; width: number; fixed?: boolean }>;
  scrollableColumns?: Array<{ key: string; label: string; width: number; fixed?: boolean }>;
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
  columns,
  fixedColumns,
  scrollableColumns,
}) => {
  const { socket, connected } = useSocket();
  
  // Edit task name state
  const [editTaskName, setEditTaskName] = useState(false);
  const [taskName, setTaskName] = useState(task.title || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // Click outside detection for edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        handleTaskNameSave();
      }
    };

    if (editTaskName) {
      document.addEventListener('mousedown', handleClickOutside);
      inputRef.current?.focus();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editTaskName]);

  // Handle task name save
  const handleTaskNameSave = useCallback(() => {
    const newTaskName = inputRef.current?.value;
    if (newTaskName?.trim() !== '' && connected && newTaskName !== task.title) {
      socket?.emit(
        SocketEvents.TASK_NAME_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          name: newTaskName,
          parent_task: null, // Assuming top-level tasks for now
        })
      );
    }
    setEditTaskName(false);
  }, [connected, socket, task.id, task.title]);

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
      ? 'border-gray-600 hover:bg-gray-800' 
      : 'border-gray-300 hover:bg-gray-50';
    const backgroundClasses = isDarkMode ? 'bg-[#18181b]' : 'bg-white';
    const selectedClasses = isSelected 
      ? (isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50')
      : '';
    const overlayClasses = isDragOverlay 
      ? `rounded shadow-lg border-2 ${isDarkMode ? 'border-gray-600 shadow-2xl' : 'border-gray-300 shadow-2xl'}`
      : '';
    return `${baseClasses} ${themeClasses} ${backgroundClasses} ${selectedClasses} ${overlayClasses}`;
  }, [isDarkMode, isSelected, isDragOverlay]);

  const fixedColumnsClasses = useMemo(() => 
    `flex sticky left-0 z-10 border-r-2 shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-600' : 'bg-white border-gray-300'}`,
    [isDarkMode]
  );

  const taskNameClasses = useMemo(() => {
    const baseClasses = 'text-sm font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-300 cursor-pointer';
    const themeClasses = isDarkMode ? 'text-gray-100 hover:text-blue-400' : 'text-gray-900 hover:text-blue-600';
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

  // Memoize date values for performance optimization
  const startDateValue = useMemo(() => 
    task.startDate ? dayjs(task.startDate) : undefined, 
    [task.startDate]
  );

  const dueDateValue = useMemo(() => 
    task.dueDate ? dayjs(task.dueDate) : undefined, 
    [task.dueDate]
  );

  // Memoize DatePicker configuration
  const datePickerProps = useMemo(() => ({
    ...taskManagementAntdConfig.datePickerDefaults,
    className: "w-full bg-transparent border-none shadow-none"
  }), []);

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

  // Create adapter for AssigneeSelector - memoized
  const taskAdapterForAssignee = useMemo(() => ({
    id: task.id,
    name: task.title,
    parent_task_id: null,
    assignees: task.assignee_names?.map(member => ({
      team_member_id: member.team_member_id,
      id: member.team_member_id,
      project_member_id: member.team_member_id,
      name: member.name,
    })) || [],
  } as any), [task.id, task.title, task.assignee_names]);

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

  // Memoize date formatting functions
  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return '';
    return dayjs(dateString).format('MMM DD, YYYY');
  }, []);

  const formatDateTime = useCallback((dateString?: string) => {
    if (!dateString) return '';
    return dayjs(dateString).format('MMM DD, YYYY HH:mm');
  }, []);

  // Handle date changes
  const handleDateChange = useCallback((date: dayjs.Dayjs | null, field: 'startDate' | 'dueDate') => {
    if (!connected || !socket) return;
    
    const eventType = field === 'startDate' ? SocketEvents.TASK_START_DATE_CHANGE : SocketEvents.TASK_END_DATE_CHANGE;
    const dateField = field === 'startDate' ? 'start_date' : 'end_date';
    
    socket.emit(
      eventType.toString(),
      JSON.stringify({
        task_id: task.id,
        [dateField]: date?.format('YYYY-MM-DD'),
        parent_task: null,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
    );
  }, [connected, socket, task.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={containerClasses}
    >
      <div className="flex h-10 max-h-10 overflow-visible relative">
        {/* Fixed Columns */}
        <div
          className="flex"
          style={{
            width: fixedColumns?.reduce((sum, col) => sum + col.width, 0) || 0,
          }}
        >
          {fixedColumns?.map((col, colIdx) => {
            const isLastFixed = colIdx === fixedColumns.length - 1;
            const borderClasses = `${isLastFixed ? '' : 'border-r'} border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`;
            switch (col.key) {
              case 'drag':
                return (
                  <div key={col.key} className={`w-10 flex items-center justify-center px-2 ${borderClasses}`} style={{ width: col.width }}>
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
                );
              case 'select':
                return (
                  <div key={col.key} className={`w-10 flex items-center justify-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <Checkbox
                      checked={isSelected}
                      onChange={handleSelectChange}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                );
              case 'key':
                return (
                  <div key={col.key} className={`w-20 flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <span 
                      className={`px-2 py-1 text-xs font-medium rounded truncate whitespace-nowrap max-w-full ${
                        isDarkMode 
                          ? 'bg-gray-700 text-gray-300' 
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {task.task_key}
                    </span>
                  </div>
                );
              case 'task':
                // Compute the style for the cell
                const cellStyle = editTaskName
                  ? { width: col.width, border: '1px solid #1890ff', background: isDarkMode ? '#232b3a' : '#f0f7ff', transition: 'border 0.2s' }
                  : { width: col.width };
                return (
                  <div
                    key={col.key}
                    className={`flex items-center px-2 ${borderClasses}${editTaskName ? ' task-name-edit-active' : ''}`}
                    style={cellStyle}
                  >
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-full overflow-hidden">
                      <div className="flex items-center gap-2 h-5 overflow-hidden">
                        <div ref={wrapperRef} className="flex-1 min-w-0">
                          {editTaskName ? (
                            <input
                              ref={inputRef}
                              className="task-name-input w-full bg-transparent border-none outline-none text-sm"
                              value={taskName}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskName(e.target.value)}
                              onBlur={handleTaskNameSave}
                              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter') {
                                  handleTaskNameSave();
                                }
                              }}
                              style={{ 
                                color: isDarkMode ? '#ffffff' : '#262626'
                              }}
                              autoFocus
                            />
                          ) : (
                            <Typography.Text
                              ellipsis={{ tooltip: task.title }}
                              onClick={() => setEditTaskName(true)}
                              className={taskNameClasses}
                              style={{ cursor: 'pointer' }}
                            >
                              {task.title}
                            </Typography.Text>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              default:
                return null;
            }
          })}
        </div>
        {/* Scrollable Columns */}
        <div className="overflow-visible" style={{ display: 'flex', minWidth: scrollableColumns?.reduce((sum, col) => sum + col.width, 0) || 0 }}>
          {scrollableColumns?.map((col, colIdx) => {
            const isLastScrollable = colIdx === scrollableColumns.length - 1;
            const borderClasses = `${isLastScrollable ? '' : 'border-r'} border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`;
            switch (col.key) {
              case 'description':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <Typography.Paragraph
                      ellipsis={{ 
                        expandable: false,
                        rows: 1,
                        tooltip: task.description,
                      }}
                      className={`w-full mb-0 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      {task.description || ''}
                    </Typography.Paragraph>
                  </div>
                );
              case 'progress':
                return (
                  <div key={col.key} className={`flex items-center justify-center px-2 ${borderClasses}`} style={{ width: col.width }}>
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
                );
              case 'members':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <div className="flex items-center gap-2">
                      {avatarGroupMembers.length > 0 && (
                        <AvatarGroup
                          members={avatarGroupMembers}
                          size={24}
                          maxCount={3}
                          isDarkMode={isDarkMode}
                        />
                      )}
                      <AssigneeSelector
                        task={taskAdapterForAssignee}
                        groupId={groupId}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  </div>
                );
              case 'labels':
                return (
                  <div key={col.key} className={`max-w-[200px] flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
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
                );
              case 'phase':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {task.phase || 'No Phase'}
                    </span>
                  </div>
                );
              case 'status':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses} overflow-visible`} style={{ width: col.width }}>
                    <TaskStatusDropdown
                      task={task}
                      projectId={projectId}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                );
              case 'priority':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getPriorityColor(task.priority) }}
                      />
                      <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                );
              case 'timeTracking':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <div className="flex items-center gap-2 h-full overflow-hidden">
                      {task.timeTracking?.logged && task.timeTracking.logged > 0 && (
                        <div className="flex items-center gap-1">
                          <ClockCircleOutlined className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                          <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            {typeof task.timeTracking.logged === 'number' 
                              ? `${task.timeTracking.logged}h`
                              : task.timeTracking.logged
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              case 'estimation':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {task.timeTracking?.estimated ? `${task.timeTracking.estimated}h` : '-'}
                    </span>
                  </div>
                );
              case 'startDate':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <DatePicker
                      {...datePickerProps}
                      value={startDateValue}
                      onChange={(date) => handleDateChange(date, 'startDate')}
                      placeholder="Start Date"
                    />
                  </div>
                );
              case 'dueDate':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <DatePicker
                      {...datePickerProps}
                      value={dueDateValue}
                      onChange={(date) => handleDateChange(date, 'dueDate')}
                      placeholder="Due Date"
                    />
                  </div>
                );
              case 'dueTime':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {task.dueDate ? dayjs(task.dueDate).format('HH:mm') : '-'}
                    </span>
                  </div>
                );
              case 'completedDate':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {task.completedAt ? formatDate(task.completedAt) : '-'}
                    </span>
                  </div>
                );
              case 'createdDate':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {task.createdAt ? formatDate(task.createdAt) : '-'}
                    </span>
                  </div>
                );
              case 'lastUpdated':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {task.updatedAt ? formatDateTime(task.updatedAt) : '-'}
                    </span>
                  </div>
                );
              case 'reporter':
                return (
                  <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
                    <div className="flex items-center gap-2">
                      <UserOutlined className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                      <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {task.reporter || '-'}
                      </span>
                    </div>
                  </div>
                );
              default:
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Simplified comparison for better performance
  const taskPropsEqual = (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.title === nextProps.task.title &&
    prevProps.task.progress === nextProps.task.progress &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.labels?.length === nextProps.task.labels?.length &&
    prevProps.task.assignee_names?.length === nextProps.task.assignee_names?.length
  );

  const otherPropsEqual = (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragOverlay === nextProps.isDragOverlay &&
    prevProps.groupId === nextProps.groupId
  );

  // Check column props - these are critical for re-rendering when columns change
  const columnPropsEqual = (
    prevProps.fixedColumns?.length === nextProps.fixedColumns?.length &&
    prevProps.scrollableColumns?.length === nextProps.scrollableColumns?.length &&
    JSON.stringify(prevProps.fixedColumns?.map(c => c.key)) === JSON.stringify(nextProps.fixedColumns?.map(c => c.key)) &&
    JSON.stringify(prevProps.scrollableColumns?.map(c => c.key)) === JSON.stringify(nextProps.scrollableColumns?.map(c => c.key))
  );

  return taskPropsEqual && otherPropsEqual && columnPropsEqual;
});

TaskRow.displayName = 'TaskRow';

export default TaskRow;