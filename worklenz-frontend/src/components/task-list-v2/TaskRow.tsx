import React, { memo, useMemo, useCallback, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircleOutlined, HolderOutlined, CloseOutlined } from '@ant-design/icons';
import { Checkbox, DatePicker } from 'antd';
import { dayjs, taskManagementAntdConfig } from '@/shared/antd-imports';
import { Task } from '@/types/task-management.types';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import AssigneeSelector from '@/components/AssigneeSelector';
import { format } from 'date-fns';
import AvatarGroup from '../AvatarGroup';
import { DEFAULT_TASK_NAME } from '@/shared/constants';
import TaskProgress from '@/pages/projects/project-view-1/taskList/taskListTable/taskListTableCells/TaskProgress';
import TaskStatusDropdown from '@/components/task-management/task-status-dropdown';
import TaskPriorityDropdown from '@/components/task-management/task-priority-dropdown';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { selectTaskById } from '@/features/task-management/task-management.slice';
import { selectIsTaskSelected, toggleTaskSelection } from '@/features/task-management/selection.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useTranslation } from 'react-i18next';
import TaskTimeTracking from './TaskTimeTracking';
import { CustomNumberLabel, CustomColordLabel } from '@/components';
import LabelsSelector from '@/components/LabelsSelector';
import TaskPhaseDropdown from '@/components/task-management/task-phase-dropdown';

interface TaskRowProps {
  taskId: string;
  projectId: string;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
}

interface TaskLabelsCellProps {
  labels: Task['labels'];
  isDarkMode: boolean;
}

const TaskLabelsCell: React.FC<TaskLabelsCellProps> = memo(({ labels, isDarkMode }) => {
  if (!labels) {
    return null;
  }

  return (
    <>
      {labels.map((label, index) => {
        const extendedLabel = label as any;
        return extendedLabel.end && extendedLabel.names && extendedLabel.name ? (
          <CustomNumberLabel
            key={`${label.id}-${index}`}
            labelList={extendedLabel.names}
            namesString={extendedLabel.name}
            isDarkMode={isDarkMode}
            color={label.color}
          />
        ) : (
          <CustomColordLabel
            key={`${label.id}-${index}`}
            label={label}
            isDarkMode={isDarkMode}
          />
        );
      })}
    </>
  );
});

TaskLabelsCell.displayName = 'TaskLabelsCell';

// Utility function to get task display name with fallbacks
const getTaskDisplayName = (task: Task): string => {
  // Check each field and only use if it has actual content after trimming
  if (task.title && task.title.trim()) return task.title.trim();
  if (task.name && task.name.trim()) return task.name.trim();
  if (task.task_key && task.task_key.trim()) return task.task_key.trim();
  return DEFAULT_TASK_NAME;
};

// Memoized date formatter to avoid repeated date parsing
const formatDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return '';
  }
};

const TaskRow: React.FC<TaskRowProps> = memo(({ taskId, projectId, visibleColumns }) => {
  const dispatch = useAppDispatch();
  const task = useAppSelector(state => selectTaskById(state, taskId));
  const isSelected = useAppSelector(state => selectIsTaskSelected(state, taskId));
  const { socket, connected } = useSocket();
  const { t } = useTranslation('task-list-table');

  // State for tracking which date picker is open
  const [activeDatePicker, setActiveDatePicker] = useState<string | null>(null);

  if (!task) {
    return null; // Don't render if task is not found in store
  }

  // Drag and drop functionality
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
  });

  // Memoize style object to prevent unnecessary re-renders
  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }), [transform, transition, isDragging]);

  // Get dark mode from Redux state
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  // Memoize task display name
  const taskDisplayName = useMemo(() => getTaskDisplayName(task), [task.title, task.name, task.task_key]);

  // Memoize converted task for AssigneeSelector to prevent recreation
  const convertedTask = useMemo(() => ({
    id: task.id,
    name: taskDisplayName,
    task_key: task.task_key || taskDisplayName,
    assignees:
      task.assignee_names?.map((assignee: InlineMember, index: number) => ({
        team_member_id: assignee.team_member_id || `assignee-${index}`,
        id: assignee.team_member_id || `assignee-${index}`,
        project_member_id: assignee.team_member_id || `assignee-${index}`,
        name: assignee.name || '',
      })) || [],
    parent_task_id: task.parent_task_id,
    status_id: undefined,
    project_id: undefined,
    manual_progress: undefined,
  }), [task.id, taskDisplayName, task.task_key, task.assignee_names, task.parent_task_id]);

  // Memoize formatted dates
  const formattedDates = useMemo(() => ({
    due: (() => {
      const dateValue = task.dueDate || task.due_date;
      return dateValue ? formatDate(dateValue) : null;
    })(),
    start: task.startDate ? formatDate(task.startDate) : null,
    completed: task.completedAt ? formatDate(task.completedAt) : null,
    created: task.created_at ? formatDate(task.created_at) : null,
    updated: task.updatedAt ? formatDate(task.updatedAt) : null,
  }), [task.dueDate, task.due_date, task.startDate, task.completedAt, task.created_at, task.updatedAt]);

  // Memoize date values for DatePicker
  const dateValues = useMemo(
    () => ({
      start: task.startDate ? dayjs(task.startDate) : undefined,
      due: (task.dueDate || task.due_date) ? dayjs(task.dueDate || task.due_date) : undefined,
    }),
    [task.startDate, task.dueDate, task.due_date]
  );

  // Create labels adapter for LabelsSelector
  const labelsAdapter = useMemo(() => ({
    id: task.id,
    name: task.title || task.name,
    parent_task_id: task.parent_task_id,
    manual_progress: false,
    all_labels: task.labels?.map(label => ({
      id: label.id,
      name: label.name,
      color_code: label.color,
    })) || [],
    labels: task.labels?.map(label => ({
      id: label.id,
      name: label.name,
      color_code: label.color,
    })) || [],
  }), [task.id, task.title, task.name, task.parent_task_id, task.labels]);

  // Handle checkbox change
  const handleCheckboxChange = useCallback((e: any) => {
    e.stopPropagation(); // Prevent row click when clicking checkbox
    dispatch(toggleTaskSelection(taskId));
  }, [dispatch, taskId]);

  // Handle date change
  const handleDateChange = useCallback(
    (date: dayjs.Dayjs | null, field: 'startDate' | 'dueDate') => {
      if (!connected || !socket) return;

      const eventType =
        field === 'startDate'
          ? SocketEvents.TASK_START_DATE_CHANGE
          : SocketEvents.TASK_END_DATE_CHANGE;
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

      // Close the date picker after selection
      setActiveDatePicker(null);
    },
    [connected, socket, task.id]
  );

  // Memoize date picker handlers
  const datePickerHandlers = useMemo(() => ({
    setDueDate: () => setActiveDatePicker('dueDate'),
    setStartDate: () => setActiveDatePicker('startDate'),
    clearDueDate: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleDateChange(null, 'dueDate');
    },
    clearStartDate: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleDateChange(null, 'startDate');
    },
  }), [handleDateChange]);

  const renderColumn = useCallback((columnId: string, width: string, isSticky?: boolean, index?: number) => {
    const baseStyle = { width };

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

      case 'checkbox':
        return (
          <div className="flex items-center justify-center" style={baseStyle}>
            <Checkbox
              checked={isSelected}
              onChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
            />
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
              {taskDisplayName}
            </span>
          </div>
        );

      case 'status':
        return (
          <div style={baseStyle}>
            <TaskStatusDropdown
              task={task}
              projectId={projectId}
              isDarkMode={isDarkMode}
            />
          </div>
        );

      case 'assignees':
        return (
          <div className="flex items-center gap-1" style={baseStyle}>
            <AvatarGroup
              members={task.assignee_names || []}
              maxCount={3}
              isDarkMode={isDarkMode}
              size={24}
            />
            <AssigneeSelector
              task={convertedTask}
              groupId={null}
              isDarkMode={isDarkMode}
            />
          </div>
        );

      case 'priority':
        return (
          <div style={baseStyle}>
            <TaskPriorityDropdown
              task={task}
              projectId={projectId}
              isDarkMode={isDarkMode}
            />
          </div>
        );

      case 'dueDate':
        return (
          <div style={baseStyle} className="relative group">
            {activeDatePicker === 'dueDate' ? (
              <div className="w-full relative">
                <DatePicker
                  {...taskManagementAntdConfig.datePickerDefaults}
                  className="w-full bg-transparent border-none shadow-none"
                  value={dateValues.due}
                  onChange={date => handleDateChange(date, 'dueDate')}
                  placeholder={t('dueDatePlaceholder')}
                  allowClear={false}
                  suffixIcon={null}
                  open={true}
                  onOpenChange={(open) => {
                    if (!open) {
                      setActiveDatePicker(null);
                    }
                  }}
                  autoFocus
                />
                {/* Custom clear button */}
                {dateValues.due && (
                  <button
                    onClick={datePickerHandlers.clearDueDate}
                    className={`absolute right-1 top-1/2 transform -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-xs ${
                      isDarkMode 
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    title={t('clearDueDate')}
                  >
                    <CloseOutlined style={{ fontSize: '10px' }} />
                  </button>
                )}
              </div>
            ) : (
              <div 
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  datePickerHandlers.setDueDate();
                }}
              >
                {formattedDates.due ? (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formattedDates.due}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">
                    {t('setDueDate')}
                  </span>
                )}
              </div>
            )}
          </div>
        );

      case 'progress':
        return (
          <div style={baseStyle}>
            {task.progress !== undefined &&
              task.progress >= 0 &&
              (task.progress === 100 ? (
                <div className="flex items-center justify-center">
                  <CheckCircleOutlined
                    className="text-green-500"
                    style={{
                      fontSize: '20px',
                      color: '#52c41a',
                    }}
                  />
                </div>
              ) : (
                <TaskProgress
                  progress={task.progress}
                  numberOfSubTasks={task.sub_tasks?.length || 0}
                />
              ))}
          </div>
        );

      case 'labels':
        return (
          <div className="flex items-center gap-1 flex-wrap min-w-0" style={{ ...baseStyle, minWidth: '200px' }}>
            <TaskLabelsCell labels={task.labels} isDarkMode={isDarkMode} />
            <LabelsSelector task={labelsAdapter} isDarkMode={isDarkMode} />
          </div>
        );

      case 'phase':
        return (
          <div style={baseStyle}>
            <TaskPhaseDropdown
              task={task}
              projectId={projectId}
              isDarkMode={isDarkMode}
            />
          </div>
        );

      case 'timeTracking':
        return (
          <div style={baseStyle}>
            <TaskTimeTracking taskId={task.id || ''} isDarkMode={isDarkMode} />
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
          <div style={baseStyle} className="relative group">
            {activeDatePicker === 'startDate' ? (
              <div className="w-full relative">
                <DatePicker
                  {...taskManagementAntdConfig.datePickerDefaults}
                  className="w-full bg-transparent border-none shadow-none"
                  value={dateValues.start}
                  onChange={date => handleDateChange(date, 'startDate')}
                  placeholder={t('startDatePlaceholder')}
                  allowClear={false}
                  suffixIcon={null}
                  open={true}
                  onOpenChange={(open) => {
                    if (!open) {
                      setActiveDatePicker(null);
                    }
                  }}
                  autoFocus
                />
                {/* Custom clear button */}
                {dateValues.start && (
                  <button
                    onClick={datePickerHandlers.clearStartDate}
                    className={`absolute right-1 top-1/2 transform -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-xs ${
                      isDarkMode 
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    title={t('clearStartDate')}
                  >
                    <CloseOutlined style={{ fontSize: '10px' }} />
                  </button>
                )}
              </div>
            ) : (
              <div 
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  datePickerHandlers.setStartDate();
                }}
              >
                {formattedDates.start ? (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formattedDates.start}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">
                    {t('setStartDate')}
                  </span>
                )}
              </div>
            )}
          </div>
        );

      case 'completedDate':
        return (
          <div style={baseStyle}>
            {formattedDates.completed && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formattedDates.completed}
              </span>
            )}
          </div>
        );

      case 'createdDate':
        return (
          <div style={baseStyle}>
            {formattedDates.created && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formattedDates.created}
              </span>
            )}
          </div>
        );

      case 'lastUpdated':
        return (
          <div style={baseStyle}>
            {formattedDates.updated && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formattedDates.updated}
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
  }, [
    // Essential props and state
    attributes,
    listeners,
    isSelected,
    handleCheckboxChange,
    activeDatePicker,
    isDarkMode,
    projectId,
    
    // Task data
    task,
    taskDisplayName,
    convertedTask,
    
    // Memoized values
    dateValues,
    formattedDates,
    labelsAdapter,
    
    // Handlers
    handleDateChange,
    datePickerHandlers,
    
    // Translation
    t,
  ]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center min-w-max px-4 py-2 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${
        isDragging ? 'shadow-lg border border-blue-300' : ''
      }`}
    >
      {visibleColumns.map((column, index) =>
        renderColumn(column.id, column.width, column.isSticky, index)
      )}
    </div>
  );
});

TaskRow.displayName = 'TaskRow';

export default TaskRow;
