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
  UserOutlined,
  type InputRef,
  Tooltip,
} from '@/shared/antd-imports';
import {
  RightOutlined,
  ExpandAltOutlined,
  CheckCircleOutlined,
  MinusCircleOutlined,
  EyeOutlined,
  RetweetOutlined,
  DownOutlined, // Added DownOutlined for expand/collapse
  CloseOutlined, // Added CloseOutlined for clear button
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task-management.types';
import { RootState } from '@/app/store';
import {
  AvatarGroup,
  Button,
  Checkbox,
  CustomColordLabel,
  CustomNumberLabel,
  Progress,
} from '@/components';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import TaskTimer from '@/components/taskListCommon/task-timer/task-timer';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import {
  formatDate as utilFormatDate,
  formatDateTime as utilFormatDateTime,
  createLabelsAdapter,
  createAssigneeAdapter,
  PRIORITY_COLORS as UTIL_PRIORITY_COLORS,
} from './task-row-utils';
import './task-row-optimized.css';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import useDragCursor from '@/hooks/useDragCursor';

interface TaskRowProps {
  task: Task;
  projectId: string;
  groupId: string;
  currentGrouping: 'status' | 'priority' | 'phase';
  isSelected: boolean;
  isDragOverlay?: boolean;
  index?: number;
  onSelect?: (taskId: string, selected: boolean) => void;
  onToggleSubtasks?: (taskId: string) => void; // Modified prop
  columns?: Array<{ key: string; label: string; width: number; fixed?: boolean }>;
  fixedColumns?: Array<{ key: string; label: string; width: number; fixed?: boolean }>;
  scrollableColumns?: Array<{ key: string; label: string; width: number; fixed?: boolean }>;
  onExpandSubtaskInput?: (taskId: string) => void;
  level?: number; // Added level prop for indentation
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

// Memoized sub-components for maximum performance
const DragHandle = React.memo<{ isDarkMode: boolean; attributes: any; listeners: any }>(
  ({ isDarkMode, attributes, listeners }) => {
    return (
      <div
        className="drag-handle-optimized flex items-center justify-center w-6 h-6 opacity-60 hover:opacity-100"
        style={{
          transition: 'opacity 0.1s ease', // Faster transition
          cursor: 'grab',
        }}
        data-dnd-drag-handle="true"
        {...attributes}
        {...listeners}
      >
        <HolderOutlined
          className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
          style={{ pointerEvents: 'none' }} // Prevent icon from interfering
        />
      </div>
    );
  }
);

const TaskKey = React.memo<{ taskKey: string; isDarkMode: boolean }>(({ taskKey, isDarkMode }) => (
  <span
    className={`px-2 py-1 text-xs font-medium rounded truncate whitespace-nowrap max-w-full ${
      isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
    }`}
  >
    {taskKey}
  </span>
));

const TaskDescription = React.memo<{ description?: string; isDarkMode: boolean }>(
  ({ description, isDarkMode }) => {
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
  }
);

const TaskProgress = React.memo<{ progress: number; isDarkMode: boolean }>(
  ({ progress, isDarkMode }) => (
    <Progress
      type="circle"
      percent={progress}
      size={24}
      strokeColor={progress === 100 ? '#52c41a' : '#1890ff'}
      strokeWidth={2}
      showInfo={true}
      isDarkMode={isDarkMode}
    />
  )
);

const TaskTimeTracking = React.memo<{ taskId: string; isDarkMode: boolean }>(
  ({ taskId, isDarkMode }) => {
    const { started, timeString, handleStartTimer, handleStopTimer } = useTaskTimer(
      taskId,
      null // The hook will get the timer start time from Redux
    );

    return (
      <TaskTimer
        taskId={taskId}
        started={started}
        handleStartTimer={handleStartTimer}
        handleStopTimer={handleStopTimer}
        timeString={timeString}
      />
    );
  }
);

const TaskReporter = React.memo<{ reporter?: string; isDarkMode: boolean }>(
  ({ reporter, isDarkMode }) => (
    <div className="flex items-center gap-2">
      <UserOutlined className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
      <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        {reporter || '-'}
      </span>
    </div>
  )
);

// PERFORMANCE OPTIMIZATION: Lightweight placeholder components for better performance
const AssigneePlaceholder = React.memo<{ isDarkMode: boolean; memberCount?: number }>(
  ({ isDarkMode, memberCount = 0 }) => (
    <div className="flex items-center gap-1">
      {memberCount > 0 ? (
        <div className="flex -space-x-1">
          {Array.from({ length: Math.min(memberCount, 3) }).map((_, i) => (
            <div
              key={i}
              className={`w-6 h-6 rounded-full border-2 ${
                isDarkMode ? 'bg-gray-600 border-gray-700' : 'bg-gray-200 border-gray-300'
              }`}
              style={{ zIndex: 3 - i }}
            />
          ))}
          {memberCount > 3 && (
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium ${
                isDarkMode
                  ? 'bg-gray-600 border-gray-700 text-gray-300'
                  : 'bg-gray-200 border-gray-300 text-gray-600'
              }`}
              style={{ zIndex: 0 }}
            >
              +{memberCount - 3}
            </div>
          )}
        </div>
      ) : (
        <div className={`w-6 h-6 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
      )}
      <div className={`w-4 h-4 rounded-sm ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
    </div>
  )
);

const StatusPlaceholder = React.memo<{ status?: string; isDarkMode: boolean }>(
  ({ status, isDarkMode }) => (
    <div
      className={`px-2 py-1 text-xs rounded-full min-w-16 h-6 flex items-center justify-center ${
        isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {status || '...'}
    </div>
  )
);

const PriorityPlaceholder = React.memo<{ priority?: string; isDarkMode: boolean }>(
  ({ priority, isDarkMode }) => (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-gray-500' : 'bg-gray-300'}`} />
      <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        {priority || '...'}
      </span>
    </div>
  )
);

const PhasePlaceholder = React.memo<{ phase?: string; isDarkMode: boolean }>(
  ({ phase, isDarkMode }) => (
    <div
      className={`px-2 py-1 text-xs rounded min-w-16 h-6 flex items-center justify-center ${
        isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {phase || '...'}
    </div>
  )
);

const LabelsPlaceholder = React.memo<{ labelCount?: number; isDarkMode: boolean }>(
  ({ labelCount = 0, isDarkMode }) => (
    <div className="flex items-center gap-1 flex-wrap">
      {labelCount > 0 ? (
        Array.from({ length: Math.min(labelCount, 3) }).map((_, i) => (
          <div
            key={i}
            className={`px-2 py-0.5 text-xs rounded-full ${
              isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
            }`}
            style={{
              width: `${40 + Math.random() * 30}px`,
              height: '20px',
            }}
          />
        ))
      ) : (
        <div className={`w-4 h-4 rounded-sm ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
      )}
    </div>
  )
);

// PERFORMANCE OPTIMIZATION: Simplified placeholders without animations under memory pressure
const SimplePlaceholder = React.memo<{ width: number; height: number; isDarkMode: boolean }>(
  ({ width, height, isDarkMode }) => (
    <div
      className={`rounded-sm ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}
      style={{ width, height }}
    />
  )
);

// Lazy-loaded components with Suspense fallbacks
const LazyAssigneeSelector = React.lazy(() =>
  import('./lazy-assignee-selector').then(module => ({ default: module.default }))
);

const LazyTaskStatusDropdown = React.lazy(() =>
  import('./task-status-dropdown').then(module => ({ default: module.default }))
);

const LazyTaskPriorityDropdown = React.lazy(() =>
  import('./task-priority-dropdown').then(module => ({ default: module.default }))
);

const LazyTaskPhaseDropdown = React.lazy(() =>
  import('./task-phase-dropdown').then(module => ({ default: module.default }))
);

const LazyLabelsSelector = React.lazy(() =>
  import('@/components/LabelsSelector').then(module => ({ default: module.default }))
);

// Enhanced component wrapper with progressive loading
const ProgressiveComponent = React.memo<{
  isLoaded: boolean;
  placeholder: React.ReactNode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}>(({ isLoaded, placeholder, children, fallback }) => {
  if (!isLoaded) {
    return <>{placeholder}</>;
  }

  return <React.Suspense fallback={fallback || placeholder}>{children}</React.Suspense>;
});

// PERFORMANCE OPTIMIZATION: Frame-rate aware rendering hooks
const useFrameRateOptimizedLoading = (index?: number) => {
  const [canRender, setCanRender] = useState((index !== undefined && index < 3) || false);
  const renderRequestRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (index === undefined || canRender) return;

    // Use requestIdleCallback for non-critical rendering
    const scheduleRender = () => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(
          () => {
            setCanRender(true);
          },
          { timeout: 100 }
        );
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => setCanRender(true), 50);
      }
    };

    renderRequestRef.current = requestAnimationFrame(scheduleRender);

    return () => {
      if (renderRequestRef.current) {
        cancelAnimationFrame(renderRequestRef.current);
      }
    };
  }, [index, canRender]);

  return canRender;
};

// PERFORMANCE OPTIMIZATION: Memory pressure detection
const useMemoryPressure = () => {
  const [isUnderPressure, setIsUnderPressure] = useState(false);

  useEffect(() => {
    if (!('memory' in performance)) return;

    const checkMemory = () => {
      const memory = (performance as any).memory;
      if (memory) {
        const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        setIsUnderPressure(usedRatio > 0.6); // Conservative threshold
      }
    };

    checkMemory();
    const interval = setInterval(checkMemory, 2000);
    return () => clearInterval(interval);
  }, []);

  return isUnderPressure;
};

const TaskRow: React.FC<TaskRowProps> = React.memo(
  ({
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
    onExpandSubtaskInput,
    level = 0, // Initialize level to 0
  }) => {
    // PERFORMANCE OPTIMIZATION: Frame-rate aware loading
    const canRenderComplex = useFrameRateOptimizedLoading(index);
    const isMemoryPressured = useMemoryPressure();

    // PERFORMANCE OPTIMIZATION: More aggressive performance - only load first 2 immediately
    const [isFullyLoaded, setIsFullyLoaded] = useState((index !== undefined && index < 2) || false);
    const [isIntersecting, setIsIntersecting] = useState(false);
    const rowRef = useRef<HTMLDivElement>(null);
    const hasBeenFullyLoadedOnce = useRef((index !== undefined && index < 2) || false);

    // PERFORMANCE OPTIMIZATION: Conditional component loading based on memory pressure
    const [shouldShowComponents, setShouldShowComponents] = useState(
      (index !== undefined && index < 2) || false
    );

    // PERFORMANCE OPTIMIZATION: Only connect to socket after component is visible
    const { socket, connected } = useSocket();

    // Redux dispatch
    const dispatch = useAppDispatch();

    // Edit task name state
    const [editTaskName, setEditTaskName] = useState(false);
    const [taskName, setTaskName] = useState(task.title || '');
    const [showAddSubtask, setShowAddSubtask] = useState(false);
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const inputRef = useRef<InputRef>(null);
    const addSubtaskInputRef = useRef<InputRef>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Subtask expansion state (managed by Redux)

    // PERFORMANCE OPTIMIZATION: Intersection Observer for lazy loading
    useEffect(() => {
      // Skip intersection observer if already fully loaded
      if (!rowRef.current || hasBeenFullyLoadedOnce.current) return;

      const observer = new IntersectionObserver(
        entries => {
          const [entry] = entries;
          if (entry.isIntersecting && !isIntersecting && !hasBeenFullyLoadedOnce.current) {
            setIsIntersecting(true);
            // Immediate loading when intersecting - no delay
            setIsFullyLoaded(true);
            hasBeenFullyLoadedOnce.current = true; // Mark as fully loaded once

            // Add a tiny delay for component loading to prevent browser freeze
            setTimeout(() => {
              setShouldShowComponents(true);
            }, 8); // Half frame delay for even more responsive experience
          }
        },
        {
          root: null,
          rootMargin: '200px', // Increased to load components earlier before they're visible
          threshold: 0, // Load as soon as any part enters the extended viewport
        }
      );

      observer.observe(rowRef.current);

      return () => {
        observer.disconnect();
      };
    }, [isIntersecting, hasBeenFullyLoadedOnce.current]);

    // PERFORMANCE OPTIMIZATION: Skip expensive operations during initial render
    // Once fully loaded, always render full to prevent blanking during real-time updates
    const shouldRenderFull =
      (isFullyLoaded && shouldShowComponents) ||
      hasBeenFullyLoadedOnce.current ||
      isDragOverlay ||
      editTaskName;

    // PERFORMANCE OPTIMIZATION: Minimal initial render for non-visible tasks
    // Only render essential columns during initial load to reduce DOM nodes
    const shouldRenderMinimal = !shouldRenderFull && !isDragOverlay;

    // DRAG OVERLAY: When dragging, show only task name for cleaner experience
    const shouldRenderDragOverlay = isDragOverlay;

    // REAL-TIME UPDATES: Ensure content stays loaded during socket updates
    useEffect(() => {
      if (shouldRenderFull && !hasBeenFullyLoadedOnce.current) {
        hasBeenFullyLoadedOnce.current = true;
      }
    }, [shouldRenderFull]);

    // Optimized drag and drop setup with maximum performance
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: task.id,
      data: {
        type: 'task',
        taskId: task.id,
        groupId,
      },
      disabled: isDragOverlay || !shouldRenderFull, // Disable drag until fully loaded
      // PERFORMANCE OPTIMIZATION: Disable all animations for maximum performance
      animateLayoutChanges: () => false, // Disable layout animations
      transition: null, // Disable transitions
    });

    // Get theme from Redux store - memoized selector
    const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');

    // Translation hook
    const { t } = useTranslation('task-management');

    // Optimized task name save handler
    const handleTaskNameSave = useCallback(() => {
      const newTaskName = taskName?.trim();
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
    }, [connected, socket, task.id, task.title, taskName]);

    // PERFORMANCE OPTIMIZATION: Only setup click outside detection when editing
    useEffect(() => {
      if (!editTaskName || !shouldRenderFull) return;

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
    }, [editTaskName, shouldRenderFull, handleTaskNameSave]);

    // Handle canceling add subtask
    const handleCancelAddSubtask = useCallback(() => {
      setNewSubtaskName('');
      setShowAddSubtask(false);
    }, []);

    // Optimized style calculations with maximum performance
    const dragStyle = useMemo(() => {
      if (!isDragging && !transform) return {};

      return {
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto',
      };
    }, [transform, isDragging]);

    // Memoized event handlers with better dependency tracking
    const handleSelectChange = useCallback(
      (checked: boolean) => {
        onSelect?.(task.id, checked);
      },
      [onSelect, task.id]
    );

    // Modified handleToggleSubtasks to use Redux state
    const handleToggleSubtasks = useCallback(() => {
      if (!task.id) return;
      onToggleSubtasks?.(task.id);
    }, [task.id, onToggleSubtasks]);

    // Handle successful subtask creation
    const handleSubtaskCreated = useCallback(
      (newTask: any) => {
        if (newTask && newTask.id) {
          // Update parent task progress
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);

          // Clear form and hide add subtask row
          setNewSubtaskName('');
          setShowAddSubtask(false);

          // The global socket handler will automatically add the subtask to the parent task
          // and update the UI through Redux

          // After creating the first subtask, the task now has subtasks
          // so we should expand it to show the new subtask
          if (task.sub_tasks_count === 0 || !task.sub_tasks_count) {
            // Trigger expansion to show the newly created subtask
            setTimeout(() => {
              onToggleSubtasks?.(task.id, true); // Pass true to expand
            }, 100);
          }
        }
      },
      [socket, task.id, task.sub_tasks_count, onToggleSubtasks]
    );

    // Handle adding new subtask
    const handleAddSubtask = useCallback(() => {
      const subtaskName = newSubtaskName?.trim();
      if (subtaskName && connected && projectId) {
        // Get current session for reporter_id and team_id
        const currentSession = JSON.parse(localStorage.getItem('session') || '{}');

        const requestBody = {
          project_id: projectId,
          name: subtaskName,
          reporter_id: currentSession.id,
          team_id: currentSession.team_id,
          parent_task_id: task.id,
        };

        socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(requestBody));

        // Handle the response
        socket?.once(SocketEvents.QUICK_TASK.toString(), handleSubtaskCreated);
      }
    }, [newSubtaskName, connected, socket, task.id, projectId, handleSubtaskCreated]);

    // Handle expand/collapse or add subtask
    const handleExpandClick = useCallback(() => {
      // Always show add subtask row when clicking expand icon
      setShowAddSubtask(!showAddSubtask);
      if (!showAddSubtask) {
        // Focus the input after state update
        setTimeout(() => {
          addSubtaskInputRef.current?.focus();
        }, 100);
      }
    }, [showAddSubtask]);

    // Handle opening task drawer
    const handleOpenTask = useCallback(() => {
      if (!task.id) return;
      dispatch(setSelectedTaskId(task.id));
      dispatch(setShowTaskDrawer(true));
      // Fetch task data - this is necessary for detailed task drawer information
      // that's not available in the list view (comments, attachments, etc.)
      dispatch(fetchTask({ taskId: task.id, projectId }));
    }, [task.id, projectId, dispatch]);

    // Optimized date handling with better memoization
    const dateValues = useMemo(
      () => ({
        start: task.startDate ? dayjs(task.startDate) : undefined,
        due: task.dueDate ? dayjs(task.dueDate) : undefined,
      }),
      [task.startDate, task.dueDate]
    );

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
      },
      [connected, socket, task.id]
    );

    // Optimized class name calculations with better memoization
    const styleClasses = useMemo(() => {
      const base = 'border-b transition-all duration-150'; // Reduced duration for better performance
      const theme = isDarkMode
        ? 'border-gray-600 hover:bg-gray-800'
        : 'border-gray-300 hover:bg-gray-50';
      const background = isDarkMode ? 'bg-[#18181b]' : 'bg-white';
      const selected = isSelected ? (isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50') : '';
      const overlay = isDragOverlay
        ? `rounded-sm shadow-lg border-2 ${isDarkMode ? 'border-gray-600 shadow-2xl' : 'border-gray-300 shadow-2xl'}`
        : '';

      return {
        container: `${base} ${theme} ${background} ${selected} ${overlay}`,
        taskName: `text-sm font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-150 cursor-pointer ${
          isDarkMode ? 'text-gray-100 hover:text-blue-400' : 'text-gray-900 hover:text-blue-600'
        } ${task.progress === 100 ? `line-through ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}` : ''}`,
      };
    }, [isDarkMode, isSelected, isDragOverlay, task.progress]);

    // Memoized adapters for better performance
    const adapters = useMemo(
      () => ({
        labels: createLabelsAdapter(task),
        assignee: createAssigneeAdapter(task),
      }),
      [task]
    );

    // PERFORMANCE OPTIMIZATION: Minimal column rendering for initial load
    const renderMinimalColumn = useCallback(
      (
        col: { key: string; width: number },
        isFixed: boolean,
        index: number,
        totalColumns: number
      ) => {
        const isActuallyLast = isFixed
          ? index === totalColumns - 1 && (!scrollableColumns || scrollableColumns.length === 0)
          : index === totalColumns - 1;
        const borderClasses = `${isActuallyLast ? '' : 'border-r'} border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`;

        // Only render essential columns during minimal load
        switch (col.key) {
          case 'drag':
            return (
              <div
                key={col.key}
                className={`flex items-center justify-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <div className="w-4 h-4 opacity-30 bg-gray-300 rounded-sm"></div>
              </div>
            );

          case 'select':
            return (
              <div
                key={col.key}
                className={`flex items-center justify-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <Checkbox
                  checked={isSelected}
                  onChange={handleSelectChange}
                  isDarkMode={isDarkMode}
                />
              </div>
            );

          case 'key':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <TaskKey taskKey={task.task_key || ''} isDarkMode={isDarkMode} />
              </div>
            );

          case 'task':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <div className="flex-1 min-w-0 flex flex-col justify-center h-full overflow-hidden">
                  <div className="flex items-center gap-2 h-5 overflow-hidden">
                    {/* Always reserve space for expand icon */}
                    <div style={{ width: 20, display: 'inline-block' }} />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <Typography.Text
                        ellipsis={{ tooltip: task.title }}
                        className={styleClasses.taskName}
                      >
                        {task.title}
                      </Typography.Text>
                      {(task as any).sub_tasks_count > 0 && (
                        <div
                          className={`subtask-count-badge flex items-center gap-1 px-1 py-0.5 text-xs font-semibold`}
                          style={{
                            fontSize: '10px',
                            marginLeft: 4,
                            color: isDarkMode ? '#b0b3b8' : '#888',
                          }}
                        >
                          <span>{(task as any).sub_tasks_count}</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, marginLeft: 1 }}>
                            {'»'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );

          case 'progress':
            return (
              <div
                key={col.key}
                className={`flex items-center justify-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                {task.progress !== undefined &&
                  task.progress >= 0 &&
                  (task.progress === 100 ? (
                    <div className="flex items-center justify-center">
                      <CheckCircleOutlined
                        className="text-green-500"
                        style={{
                          fontSize: '16px',
                          color: '#52c41a',
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className={`w-6 h-3 rounded-sm ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
                    ></div>
                  ))}
              </div>
            );

          default:
            // For non-essential columns, show minimal placeholder
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <div
                  className={`w-6 h-3 rounded-sm ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
                ></div>
              </div>
            );
        }
      },
      [isDarkMode, task, isSelected, handleSelectChange, styleClasses, scrollableColumns]
    );

    // Optimized column rendering with better performance
    const renderColumn = useCallback(
      (
        col: { key: string; width: number },
        isFixed: boolean,
        index: number,
        totalColumns: number
      ) => {
        // Use simplified rendering for initial load
        if (!shouldRenderFull) {
          return renderMinimalColumn(col, isFixed, index, totalColumns);
        }

        // Full rendering logic (existing code)
        // Simplified border logic - no fixed columns
        const isLast = index === totalColumns - 1;
        const borderClasses = `${isLast ? '' : 'border-r'} border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`;

        switch (col.key) {
          case 'drag':
            return (
              <div
                key={col.key}
                className={`flex items-center justify-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <DragHandle isDarkMode={isDarkMode} attributes={attributes} listeners={listeners} />
              </div>
            );

          case 'select':
            return (
              <div
                key={col.key}
                className={`flex items-center justify-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <Checkbox
                  checked={isSelected}
                  onChange={handleSelectChange}
                  isDarkMode={isDarkMode}
                />
              </div>
            );

          case 'key':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <TaskKey taskKey={task.task_key || ''} isDarkMode={isDarkMode} />
              </div>
            );

          case 'task':
            const cellStyle = editTaskName
              ? {
                  width: col.width,
                  borderTop: '1px solid #1890ff',
                  borderBottom: '1px solid #1890ff',
                  borderLeft: '1px solid #1890ff',
                  background: isDarkMode ? '#232b3a' : '#f0f7ff',
                  transition: 'border 0.2s',
                }
              : { width: col.width };

            return (
              <div
                key={col.key}
                className={`task-cell-container flex items-center px-2 ${borderClasses}${editTaskName ? ' task-name-edit-active' : ''}`}
                style={{ ...cellStyle, paddingLeft: `${level * 20 + 8}px` }} // Apply indentation
              >
                <div className="flex-1 min-w-0 flex items-center justify-between h-full overflow-hidden">
                  {/* Left section with expand icon and task content */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Expand/Collapse Icon - Smart visibility */}
                    {typeof task.sub_tasks_count === 'number' ? (
                      <div className="expand-icon-container hover-only w-5 h-5 flex items-center justify-center">
                        <button
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (task.sub_tasks_count && task.sub_tasks_count > 0) {
                              handleToggleSubtasks(); // Toggle expansion for tasks with subtasks
                            } else {
                              onExpandSubtaskInput?.(task.id); // Show add subtask input for tasks without subtasks
                            }
                          }}
                          className={`expand-toggle-btn w-4 h-4 flex items-center justify-center border-none rounded text-xs cursor-pointer transition-all duration-200 ${
                            isDarkMode
                              ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                          }`}
                          style={{ backgroundColor: 'transparent' }}
                          title={
                            task.sub_tasks_count && task.sub_tasks_count > 0
                              ? task.show_sub_tasks
                                ? 'Collapse subtasks'
                                : 'Expand subtasks'
                              : 'Add subtask'
                          }
                        >
                          {task.sub_tasks_count && task.sub_tasks_count > 0 ? (
                            task.show_sub_tasks ? (
                              <DownOutlined
                                style={{ fontSize: 16, color: isDarkMode ? '#b0b3b8' : '#888' }}
                              />
                            ) : (
                              <RightOutlined
                                style={{ fontSize: 16, color: isDarkMode ? '#b0b3b8' : '#888' }}
                              />
                            )
                          ) : (
                            <RightOutlined
                              style={{ fontSize: 16, color: isDarkMode ? '#b0b3b8' : '#888' }}
                            />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div style={{ width: 20, display: 'inline-block' }} /> // Placeholder for alignment
                    )}

                    {/* Task name and input */}
                    <div ref={wrapperRef} className="flex-1 min-w-0 flex items-center gap-2">
                      {editTaskName ? (
                        <Input
                          ref={inputRef}
                          className="task-name-input"
                          value={taskName}
                          onChange={e => setTaskName(e.target.value)}
                          onBlur={handleTaskNameSave}
                          onPressEnter={handleTaskNameSave}
                          variant="borderless"
                          style={{
                            color: isDarkMode ? '#ffffff' : '#262626',
                            padding: 0,
                          }}
                          autoFocus
                        />
                      ) : (
                        <>
                          <Typography.Text
                            ellipsis={{ tooltip: task.title }}
                            onClick={() => setEditTaskName(true)}
                            className={styleClasses.taskName}
                            style={{ cursor: 'pointer' }}
                          >
                            {task.title}
                          </Typography.Text>
                          {(task as any).sub_tasks_count > 0 && (
                            <div
                              className={`subtask-count-badge flex items-center gap-1 px-1 py-0.5 text-xs font-semibold`}
                              style={{
                                fontSize: '10px',
                                marginLeft: 4,
                                color: isDarkMode ? '#b0b3b8' : '#888',
                              }}
                            >
                              <span>{(task as any).sub_tasks_count}</span>
                              <span style={{ fontSize: '12px', fontWeight: 600, marginLeft: 1 }}>
                                {'»'}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Indicators section */}
                    {!editTaskName && (
                      <div className="task-indicators flex items-center gap-2">
                        {/* Comments indicator */}
                        {(task as any).comments_count > 0 && (
                          <Tooltip
                            title={t(
                              `task-management:indicators.tooltips.comments${(task as any).comments_count === 1 ? '' : '_plural'}`,
                              { count: (task as any).comments_count }
                            )}
                          >
                            <MessageOutlined
                              style={{ fontSize: 14, color: isDarkMode ? '#b0b3b8' : '#888' }}
                            />
                          </Tooltip>
                        )}
                        {/* Attachments indicator */}
                        {(task as any).attachments_count > 0 && (
                          <Tooltip
                            title={t(
                              `task-management:indicators.tooltips.attachments${(task as any).attachments_count === 1 ? '' : '_plural'}`,
                              { count: (task as any).attachments_count }
                            )}
                          >
                            <PaperClipOutlined
                              style={{ fontSize: 14, color: isDarkMode ? '#b0b3b8' : '#888' }}
                            />
                          </Tooltip>
                        )}
                        {/* Dependencies indicator */}
                        {(task as any).has_dependencies && (
                          <Tooltip title={t('task-management:indicators.tooltips.dependencies')}>
                            <MinusCircleOutlined
                              style={{ fontSize: 14, color: isDarkMode ? '#b0b3b8' : '#888' }}
                            />
                          </Tooltip>
                        )}
                        {/* Subscribers indicator */}
                        {(task as any).has_subscribers && (
                          <Tooltip title={t('task-management:indicators.tooltips.subscribers')}>
                            <EyeOutlined
                              style={{ fontSize: 14, color: isDarkMode ? '#b0b3b8' : '#888' }}
                            />
                          </Tooltip>
                        )}
                        {/* Recurring indicator */}
                        {(task as any).schedule_id && (
                          <Tooltip title={t('task-management:indicators.tooltips.recurring')}>
                            <RetweetOutlined
                              style={{ fontSize: 14, color: isDarkMode ? '#b0b3b8' : '#888' }}
                            />
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right section with open button - CSS hover only */}
                  {!editTaskName && (
                    <div
                      className="task-open-button ml-2 opacity-0 transition-opacity duration-200"
                      style={{ zIndex: 10 }}
                    >
                      <button
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenTask();
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded border transition-all duration-200 text-xs font-medium ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500 hover:text-gray-100'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-700'
                        }`}
                        style={{ fontSize: '11px', minWidth: 'fit-content' }}
                      >
                        <ExpandAltOutlined style={{ fontSize: '10px' }} />
                        <span>{t('openTask')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );

          case 'description':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <TaskDescription description={task.description} isDarkMode={isDarkMode} />
              </div>
            );

          case 'progress':
            return (
              <div
                key={col.key}
                className={`flex items-center justify-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
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
                    <TaskProgress progress={task.progress} isDarkMode={isDarkMode} />
                  ))}
              </div>
            );

          case 'members':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses} overflow-visible`}
                style={{ width: col.width }}
              >
                <div className="flex items-center gap-2 overflow-visible">
                  <ProgressiveComponent
                    isLoaded={shouldRenderFull}
                    placeholder={
                      <AssigneePlaceholder
                        isDarkMode={isDarkMode}
                        memberCount={task.assignee_names?.length || 0}
                      />
                    }
                    fallback={
                      <AssigneePlaceholder
                        isDarkMode={isDarkMode}
                        memberCount={task.assignee_names?.length || 0}
                      />
                    }
                  >
                    <div className="flex items-center gap-2 overflow-visible">
                      {task.assignee_names && task.assignee_names.length > 0 && (
                        <AvatarGroup
                          members={task.assignee_names}
                          size={24}
                          maxCount={3}
                          isDarkMode={isDarkMode}
                        />
                      )}
                      <LazyAssigneeSelector
                        task={adapters.assignee}
                        groupId={groupId}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  </ProgressiveComponent>
                </div>
              </div>
            );

          case 'labels':
            return (
              <div
                key={col.key}
                className={`max-w-[200px] flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <div className="flex items-center gap-1 flex-wrap h-full w-full overflow-visible relative">
                  <ProgressiveComponent
                    isLoaded={shouldRenderFull}
                    placeholder={
                      <LabelsPlaceholder
                        labelCount={task.labels?.length || 0}
                        isDarkMode={isDarkMode}
                      />
                    }
                    fallback={
                      <LabelsPlaceholder
                        labelCount={task.labels?.length || 0}
                        isDarkMode={isDarkMode}
                      />
                    }
                  >
                    <>
                      {task.labels?.map((label, index) =>
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
                      )}
                      <LazyLabelsSelector task={adapters.labels} isDarkMode={isDarkMode} />
                    </>
                  </ProgressiveComponent>
                </div>
              </div>
            );

          case 'phase':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses} overflow-visible`}
                style={{ width: col.width, minWidth: col.width }}
              >
                <div className="w-full">
                  <ProgressiveComponent
                    isLoaded={shouldRenderFull}
                    placeholder={<PhasePlaceholder phase={task.phase} isDarkMode={isDarkMode} />}
                    fallback={<PhasePlaceholder phase={task.phase} isDarkMode={isDarkMode} />}
                  >
                    <LazyTaskPhaseDropdown
                      task={task}
                      projectId={projectId}
                      isDarkMode={isDarkMode}
                    />
                  </ProgressiveComponent>
                </div>
              </div>
            );

          case 'status':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses} overflow-visible`}
                style={{ width: col.width, minWidth: col.width }}
              >
                <div className="w-full">
                  <ProgressiveComponent
                    isLoaded={shouldRenderFull}
                    placeholder={<StatusPlaceholder status={task.status} isDarkMode={isDarkMode} />}
                    fallback={<StatusPlaceholder status={task.status} isDarkMode={isDarkMode} />}
                  >
                    <LazyTaskStatusDropdown
                      task={task}
                      projectId={projectId}
                      isDarkMode={isDarkMode}
                    />
                  </ProgressiveComponent>
                </div>
              </div>
            );

          case 'priority':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses} overflow-visible`}
                style={{ width: col.width, minWidth: col.width }}
              >
                <div className="w-full">
                  <ProgressiveComponent
                    isLoaded={shouldRenderFull}
                    placeholder={
                      <PriorityPlaceholder priority={task.priority} isDarkMode={isDarkMode} />
                    }
                    fallback={
                      <PriorityPlaceholder priority={task.priority} isDarkMode={isDarkMode} />
                    }
                  >
                    <LazyTaskPriorityDropdown
                      task={task}
                      projectId={projectId}
                      isDarkMode={isDarkMode}
                    />
                  </ProgressiveComponent>
                </div>
              </div>
            );

          case 'timeTracking':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <TaskTimeTracking taskId={task.id || ''} isDarkMode={isDarkMode} />
              </div>
            );

          case 'estimation':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {task.timeTracking?.estimated ? `${task.timeTracking.estimated}h` : '-'}
                </span>
              </div>
            );

          case 'startDate':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <div className="w-full relative group">
                  <DatePicker
                    {...taskManagementAntdConfig.datePickerDefaults}
                    className="w-full bg-transparent border-none shadow-none"
                    value={dateValues.start}
                    onChange={date => handleDateChange(date, 'startDate')}
                    placeholder="Start Date"
                    allowClear={false} // We'll handle clear manually
                    suffixIcon={null}
                  />
                  {/* Custom clear button - only show when there's a value */}
                  {dateValues.start && (
                    <button
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDateChange(null, 'startDate');
                      }}
                      className={`absolute right-1 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-4 h-4 flex items-center justify-center rounded-full text-xs ${
                        isDarkMode
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                      title="Clear start date"
                    >
                      <CloseOutlined style={{ fontSize: '10px' }} />
                    </button>
                  )}
                </div>
              </div>
            );

          case 'dueDate':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <div className="w-full relative group">
                  <DatePicker
                    {...taskManagementAntdConfig.datePickerDefaults}
                    className="w-full bg-transparent border-none shadow-none"
                    value={dateValues.due}
                    onChange={date => handleDateChange(date, 'dueDate')}
                    placeholder="Due Date"
                    allowClear={false} // We'll handle clear manually
                    suffixIcon={null}
                  />
                  {/* Custom clear button - only show when there's a value */}
                  {dateValues.due && (
                    <button
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDateChange(null, 'dueDate');
                      }}
                      className={`absolute right-1 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-4 h-4 flex items-center justify-center rounded-full text-xs ${
                        isDarkMode
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                      title="Clear due date"
                    >
                      <CloseOutlined style={{ fontSize: '10px' }} />
                    </button>
                  )}
                </div>
              </div>
            );

          case 'dueTime':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {task.dueDate ? dayjs(task.dueDate).format('HH:mm') : '-'}
                </span>
              </div>
            );

          case 'completedDate':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {task.completedAt ? utilFormatDate(task.completedAt) : '-'}
                </span>
              </div>
            );

          case 'createdDate':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {task.createdAt ? utilFormatDate(task.createdAt) : '-'}
                </span>
              </div>
            );

          case 'lastUpdated':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {task.updatedAt ? utilFormatDateTime(task.updatedAt) : '-'}
                </span>
              </div>
            );

          case 'reporter':
            return (
              <div
                key={col.key}
                className={`flex items-center px-2 ${borderClasses}`}
                style={{ width: col.width }}
              >
                <TaskReporter reporter={task.reporter} isDarkMode={isDarkMode} />
              </div>
            );

          default:
            return null;
        }
      },
      [
        shouldRenderFull,
        renderMinimalColumn,
        isDarkMode,
        task,
        isSelected,
        editTaskName,
        taskName,
        adapters,
        groupId,
        projectId,
        attributes,
        listeners,
        handleSelectChange,
        handleTaskNameSave,
        handleDateChange,
        handleToggleSubtasks, // Added handleToggleSubtasks
        dateValues,
        styleClasses,
        onExpandSubtaskInput,
        level, // Added level
      ]
    );

    // Apply global cursor style when dragging
    useDragCursor(isDragging);

    // Compute theme class
    const themeClass = isDarkMode ? 'dark' : '';

    // DRAG OVERLAY: Render simplified version when dragging
    if (isDragOverlay) {
      return (
        <div
          className="drag-overlay-simplified"
          style={{
            padding: '8px 12px',
            backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
            border: `1px solid ${isDarkMode ? '#404040' : '#d9d9d9'}`,
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            color: isDarkMode ? 'white' : 'black',
            fontSize: '14px',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '300px',
          }}
        >
          {task.title}
        </div>
      );
    }

    return (
      <>
        <div
          ref={node => {
            setNodeRef(node);
            rowRef.current = node;
          }}
          style={dragStyle}
          className={`task-row task-row-optimized ${themeClass} ${isSelected ? 'selected' : ''} ${isDragOverlay ? 'drag-overlay' : ''} ${isDragging ? 'is-dragging' : ''}`}
          data-dnd-draggable="true"
          data-dnd-dragging={isDragging ? 'true' : 'false'}
          data-task-id={task.id}
          data-group-id={groupId}
        >
          <div className="task-row-container flex h-10 max-h-10 relative">
            {/* All Columns - No Fixed Positioning */}
            <div className="task-table-all-columns flex">
              {/* Fixed Columns (now scrollable) */}
              {(fixedColumns ?? []).length > 0 && (
                <>
                  {(fixedColumns ?? []).map((col, index) =>
                    shouldRenderMinimal
                      ? renderMinimalColumn(col, false, index, (fixedColumns ?? []).length)
                      : renderColumn(col, false, index, (fixedColumns ?? []).length)
                  )}
                </>
              )}

              {/* Scrollable Columns */}
              {(scrollableColumns ?? []).length > 0 && (
                <>
                  {(scrollableColumns ?? []).map((col, index) =>
                    shouldRenderMinimal
                      ? renderMinimalColumn(col, false, index, (scrollableColumns ?? []).length)
                      : renderColumn(col, false, index, (scrollableColumns ?? []).length)
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  },
  (prevProps, nextProps) => {
    // PERFORMANCE OPTIMIZATION: Enhanced comparison function
    // Skip comparison during initial renders to reduce CPU load
    if (!prevProps.task.id || !nextProps.task.id) return false;

    // Quick identity checks first
    if (prevProps.task.id !== nextProps.task.id) return false;
    if (prevProps.isSelected !== nextProps.isSelected) return false;
    if (prevProps.isDragOverlay !== nextProps.isDragOverlay) return false;
    if (prevProps.groupId !== nextProps.groupId) return false;
    if (prevProps.level !== nextProps.level) return false; // Compare level

    // REAL-TIME UPDATES: Always re-render if updatedAt changed (indicates real-time update)
    if (prevProps.task.updatedAt !== nextProps.task.updatedAt) return false;

    // Deep comparison for task properties that commonly change
    const taskProps = [
      'title',
      'progress',
      'status',
      'priority',
      'description',
      'startDate',
      'dueDate',
      'sub_tasks_count',
      'show_sub_tasks',
    ]; // Added sub_tasks_count and show_sub_tasks
    for (const prop of taskProps) {
      if (prevProps.task[prop as keyof Task] !== nextProps.task[prop as keyof Task]) {
        return false;
      }
    }

    // REAL-TIME UPDATES: Compare assignees and labels content (not just length)
    if (prevProps.task.assignees?.length !== nextProps.task.assignees?.length) return false;
    if (prevProps.task.assignees?.length > 0) {
      // Deep compare assignee IDs - create copies before sorting to avoid mutating read-only arrays
      const prevAssigneeIds = [...prevProps.task.assignees].sort();
      const nextAssigneeIds = [...nextProps.task.assignees].sort();
      for (let i = 0; i < prevAssigneeIds.length; i++) {
        if (prevAssigneeIds[i] !== nextAssigneeIds[i]) return false;
      }
    }

    if (prevProps.task.assignee_names?.length !== nextProps.task.assignee_names?.length)
      return false;
    if (
      prevProps.task.assignee_names &&
      nextProps.task.assignee_names &&
      prevProps.task.assignee_names.length > 0
    ) {
      // Deep compare assignee names
      for (let i = 0; i < prevProps.task.assignee_names.length; i++) {
        if (prevProps.task.assignee_names[i] !== nextProps.task.assignee_names[i]) return false;
      }
    }

    if (prevProps.task.labels?.length !== nextProps.task.labels?.length) return false;
    if (prevProps.task.labels?.length > 0) {
      // Deep compare label IDs and names
      for (let i = 0; i < prevProps.task.labels.length; i++) {
        const prevLabel = prevProps.task.labels[i];
        const nextLabel = nextProps.task.labels[i];
        if (
          prevLabel.id !== nextLabel.id ||
          prevLabel.name !== nextLabel.name ||
          prevLabel.color !== nextLabel.color
        ) {
          return false;
        }
      }
    }

    // Compare column configurations
    if (prevProps.fixedColumns?.length !== nextProps.fixedColumns?.length) return false;
    if (prevProps.scrollableColumns?.length !== nextProps.scrollableColumns?.length) return false;

    // If we reach here, props are effectively equal
    return true;
  }
);

TaskRow.displayName = 'TaskRow';

export default TaskRow;
