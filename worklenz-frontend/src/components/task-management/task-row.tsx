import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSelector } from 'react-redux';
import DOMPurify from 'dompurify';
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
import { 
  formatDate as utilFormatDate, 
  formatDateTime as utilFormatDateTime, 
  createLabelsAdapter, 
  createAssigneeAdapter,
  PRIORITY_COLORS as UTIL_PRIORITY_COLORS,
  performanceMonitor,
  taskPropsEqual
} from './task-row-utils';
import './task-row-optimized.css';

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

// Memoized sub-components for better performance
const DragHandle = React.memo<{ isDarkMode: boolean; attributes: any; listeners: any }>(({ isDarkMode, attributes, listeners }) => (
  <Button
    variant="text"
    size="small"
    icon={<HolderOutlined />}
    className="opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing"
    isDarkMode={isDarkMode}
    {...attributes}
    {...listeners}
  />
));

const TaskKey = React.memo<{ taskKey: string; isDarkMode: boolean }>(({ taskKey, isDarkMode }) => (
  <span 
    className={`px-2 py-1 text-xs font-medium rounded truncate whitespace-nowrap max-w-full ${
      isDarkMode 
        ? 'bg-gray-700 text-gray-300' 
        : 'bg-gray-100 text-gray-600'
    }`}
  >
    {taskKey}
  </span>
));

const TaskDescription = React.memo<{ description?: string; isDarkMode: boolean }>(({ description, isDarkMode }) => {
  if (!description) return null;
  
  const sanitizedDescription = DOMPurify.sanitize(description);
  
  return (
    <Typography.Paragraph
      ellipsis={{ 
        expandable: false,
        rows: 1,
        tooltip: description,
      }}
      className={`w-full mb-0 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
    >
      <span dangerouslySetInnerHTML={{ __html: sanitizedDescription }} />
    </Typography.Paragraph>
  );
});

const TaskProgress = React.memo<{ progress: number; isDarkMode: boolean }>(({ progress, isDarkMode }) => (
  <Progress
    type="circle"
    percent={progress}
    size={24}
    strokeColor={progress === 100 ? '#52c41a' : '#1890ff'}
    strokeWidth={2}
    showInfo={true}
    isDarkMode={isDarkMode}
  />
));

const TaskPriority = React.memo<{ priority: string; isDarkMode: boolean }>(({ priority, isDarkMode }) => {
  const color = PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || '#d9d9d9';
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        {priority}
      </span>
    </div>
  );
});

const TaskTimeTracking = React.memo<{ timeTracking?: { logged?: number | string }; isDarkMode: boolean }>(({ timeTracking, isDarkMode }) => {
  if (!timeTracking?.logged || timeTracking.logged === 0) return null;
  
  return (
    <div className="flex items-center gap-1">
      <ClockCircleOutlined className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
      <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        {typeof timeTracking.logged === 'number' 
          ? `${timeTracking.logged}h`
          : timeTracking.logged
        }
      </span>
    </div>
  );
});

const TaskReporter = React.memo<{ reporter?: string; isDarkMode: boolean }>(({ reporter, isDarkMode }) => (
  <div className="flex items-center gap-2">
    <UserOutlined className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
      {reporter || '-'}
    </span>
  </div>
));



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

  // Optimized drag and drop setup with better performance
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
    // Optimize animation performance
    animateLayoutChanges: () => false, // Disable layout animations for better performance
  });

  // Get theme from Redux store - memoized selector
  const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');

  // Optimized click outside detection
  useEffect(() => {
    if (!editTaskName) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        handleTaskNameSave();
      }
    };

    document.addEventListener('mousedown', handleClickOutside, { passive: true });
    inputRef.current?.focus();

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editTaskName]);

  // Optimized task name save handler
  const handleTaskNameSave = useCallback(() => {
    const newTaskName = inputRef.current?.value?.trim();
    if (newTaskName && connected && newTaskName !== task.title) {
      socket?.emit(
        SocketEvents.TASK_NAME_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          name: newTaskName,
          parent_task: null,
        })
      );
    }
    setEditTaskName(false);
  }, [connected, socket, task.id, task.title]);

  // Optimized style calculations with better memoization
  const dragStyle = useMemo(() => {
    if (!isDragging && !transform) return {};
    
    return {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 1000 : 'auto',
      // Add GPU acceleration for better performance
      willChange: isDragging ? 'transform' : 'auto',
    };
  }, [transform, transition, isDragging]);

  // Memoized event handlers with better dependency tracking
  const handleSelectChange = useCallback((checked: boolean) => {
    onSelect?.(task.id, checked);
  }, [onSelect, task.id]);

  const handleToggleSubtasks = useCallback(() => {
    onToggleSubtasks?.(task.id);
  }, [onToggleSubtasks, task.id]);

  // Optimized date handling with better memoization
  const dateValues = useMemo(() => ({
    start: task.startDate ? dayjs(task.startDate) : undefined,
    due: task.dueDate ? dayjs(task.dueDate) : undefined,
  }), [task.startDate, task.dueDate]);

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

  // Optimized class name calculations with better memoization
  const styleClasses = useMemo(() => {
    const base = 'border-b transition-all duration-200'; // Reduced duration for better performance
    const theme = isDarkMode 
      ? 'border-gray-600 hover:bg-gray-800' 
      : 'border-gray-300 hover:bg-gray-50';
    const background = isDarkMode ? 'bg-[#18181b]' : 'bg-white';
    const selected = isSelected 
      ? (isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50')
      : '';
    const overlay = isDragOverlay 
      ? `rounded shadow-lg border-2 ${isDarkMode ? 'border-gray-600 shadow-2xl' : 'border-gray-300 shadow-2xl'}`
      : '';
    
    return {
      container: `${base} ${theme} ${background} ${selected} ${overlay}`,
      taskName: `text-sm font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-200 cursor-pointer ${
        isDarkMode ? 'text-gray-100 hover:text-blue-400' : 'text-gray-900 hover:text-blue-600'
      } ${task.progress === 100 ? `line-through ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}` : ''}`,
    };
  }, [isDarkMode, isSelected, isDragOverlay, task.progress]);

  // Memoized adapters for better performance
  const adapters = useMemo(() => ({
    labels: createLabelsAdapter(task),
    assignee: createAssigneeAdapter(task),
  }), [task]);

  // Optimized column rendering with better performance
  const renderColumn = useCallback((col: { key: string; width: number }, isFixed: boolean, index: number, totalColumns: number) => {
    const isLast = index === totalColumns - 1;
    const borderClasses = `${isLast ? '' : 'border-r'} border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`;
    
    switch (col.key) {
      case 'drag':
        return (
          <div key={col.key} className={`flex items-center justify-center px-2 ${borderClasses}`} style={{ width: col.width }}>
            <DragHandle isDarkMode={isDarkMode} attributes={attributes} listeners={listeners} />
          </div>
        );
      
      case 'select':
        return (
          <div key={col.key} className={`flex items-center justify-center px-2 ${borderClasses}`} style={{ width: col.width }}>
            <Checkbox
              checked={isSelected}
              onChange={handleSelectChange}
              isDarkMode={isDarkMode}
            />
          </div>
        );
      
      case 'key':
        return (
          <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
            <TaskKey taskKey={task.task_key} isDarkMode={isDarkMode} />
          </div>
        );
      
      case 'task':
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
                      onChange={(e) => setTaskName(e.target.value)}
                      onBlur={handleTaskNameSave}
                      onKeyDown={(e) => {
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
                      className={styleClasses.taskName}
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
      
      case 'description':
        return (
          <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
            <TaskDescription description={task.description} isDarkMode={isDarkMode} />
          </div>
        );
      
      case 'progress':
        return (
          <div key={col.key} className={`flex items-center justify-center px-2 ${borderClasses}`} style={{ width: col.width }}>
            {task.progress !== undefined && task.progress >= 0 && (
              <TaskProgress progress={task.progress} isDarkMode={isDarkMode} />
            )}
          </div>
        );
      
      case 'members':
        return (
          <div key={col.key} className={`flex items-center px-2 ${borderClasses} overflow-visible`} style={{ width: col.width }}>
            <div className="flex items-center gap-2 overflow-visible">
              {task.assignee_names && task.assignee_names.length > 0 && (
                <AvatarGroup
                  members={task.assignee_names}
                  size={24}
                  maxCount={3}
                  isDarkMode={isDarkMode}
                />
              )}
              <AssigneeSelector
                task={adapters.assignee}
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
                task={adapters.labels}
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
            <TaskPriority priority={task.priority} isDarkMode={isDarkMode} />
          </div>
        );
      
      case 'timeTracking':
        return (
          <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
            <TaskTimeTracking timeTracking={task.timeTracking} isDarkMode={isDarkMode} />
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
              {...taskManagementAntdConfig.datePickerDefaults}
              className="w-full bg-transparent border-none shadow-none"
              value={dateValues.start}
              onChange={(date) => handleDateChange(date, 'startDate')}
              placeholder="Start Date"
            />
          </div>
        );
      
      case 'dueDate':
        return (
          <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
            <DatePicker
              {...taskManagementAntdConfig.datePickerDefaults}
              className="w-full bg-transparent border-none shadow-none"
              value={dateValues.due}
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
                {task.completedAt ? utilFormatDate(task.completedAt) : '-'}
              </span>
            </div>
          );
        
        case 'createdDate':
          return (
            <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
              <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {task.createdAt ? utilFormatDate(task.createdAt) : '-'}
              </span>
            </div>
          );
        
        case 'lastUpdated':
          return (
            <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
              <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {task.updatedAt ? utilFormatDateTime(task.updatedAt) : '-'}
              </span>
            </div>
          );
      
      case 'reporter':
        return (
          <div key={col.key} className={`flex items-center px-2 ${borderClasses}`} style={{ width: col.width }}>
            <TaskReporter reporter={task.reporter} isDarkMode={isDarkMode} />
          </div>
        );
      
      default:
        return null;
    }
  }, [
    isDarkMode, task, isSelected, editTaskName, taskName, adapters, groupId, projectId,
    attributes, listeners, handleSelectChange, handleTaskNameSave, handleDateChange,
    dateValues, styleClasses
  ]);

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={`${styleClasses.container} task-row-optimized`}
      // Add CSS containment for better performance
      data-task-id={task.id}
    >
      <div className="flex h-10 max-h-10 overflow-visible relative">
        {/* Fixed Columns */}
        {fixedColumns && fixedColumns.length > 0 && (
          <div
            className="flex overflow-visible"
            style={{
              width: fixedColumns.reduce((sum, col) => sum + col.width, 0),
            }}
          >
            {fixedColumns.map((col, index) => renderColumn(col, true, index, fixedColumns.length))}
          </div>
        )}
        
        {/* Scrollable Columns */}
        {scrollableColumns && scrollableColumns.length > 0 && (
          <div 
            className="overflow-visible" 
            style={{ 
              display: 'flex', 
              minWidth: scrollableColumns.reduce((sum, col) => sum + col.width, 0) 
            }}
          >
            {scrollableColumns.map((col, index) => renderColumn(col, false, index, scrollableColumns.length))}
          </div>
        )}
      </div>
      

    </div>
  );
}, (prevProps, nextProps) => {
  // Optimized comparison function for better performance
  // Only compare essential props that affect rendering
  if (prevProps.task.id !== nextProps.task.id) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isDragOverlay !== nextProps.isDragOverlay) return false;
  if (prevProps.groupId !== nextProps.groupId) return false;
  
  // Deep comparison for task properties that commonly change
  const taskProps = ['title', 'progress', 'status', 'priority', 'description', 'startDate', 'dueDate'];
  for (const prop of taskProps) {
    if (prevProps.task[prop as keyof Task] !== nextProps.task[prop as keyof Task]) {
      return false;
    }
  }
  
  // Compare arrays by length first (fast path)
  if (prevProps.task.labels?.length !== nextProps.task.labels?.length) return false;
  if (prevProps.task.assignee_names?.length !== nextProps.task.assignee_names?.length) return false;
  
  // Compare column configurations
  if (prevProps.fixedColumns?.length !== nextProps.fixedColumns?.length) return false;
  if (prevProps.scrollableColumns?.length !== nextProps.scrollableColumns?.length) return false;
  
  // If we reach here, props are effectively equal
  return true;
});

TaskRow.displayName = 'TaskRow';

export default TaskRow;