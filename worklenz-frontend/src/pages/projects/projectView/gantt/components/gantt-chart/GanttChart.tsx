import React, {
  memo,
  useMemo,
  forwardRef,
  RefObject,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import ReactDOM from 'react-dom';
import { Input, message } from '@/shared/antd-imports';
import { GanttTask, GanttViewMode, GanttPhase } from '../../types/gantt-types';
import { useGanttDimensions } from '../../hooks/useGanttDimensions';
import { useUpdateTaskDatesMutation } from '../../services/roadmap-api.service';
import { useTranslation } from 'react-i18next';

// Utility function to add alpha channel to hex color
const addAlphaToHex = (hex: string, alpha: number): string => {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Convert hex to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Return rgba string
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface GanttChartProps {
  tasks: GanttTask[];
  viewMode: GanttViewMode;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onPhaseClick?: (phase: GanttTask) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange?: { start: Date; end: Date };
  phases?: GanttPhase[];
  expandedTasks?: Set<string>;
  animatingTasks?: Set<string>;
  onCreateQuickTask?: (taskName: string, phaseId?: string, startDate?: Date) => void;
  projectId?: string;
}

interface GridColumnProps {
  index: number;
  columnWidth: number;
}

const GridColumn: React.FC<GridColumnProps> = memo(({ index, columnWidth }) => (
  <div
    className={`border-r border-gray-100 dark:border-gray-700 flex-shrink-0 h-full ${
      index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-850' : ''
    }`}
    style={{ width: `${columnWidth}px` }}
  />
));

GridColumn.displayName = 'GridColumn';

interface TaskBarRowProps {
  task: GanttTask;
  viewMode: GanttViewMode;
  columnWidth: number;
  columnsCount: number;
  dateRange?: { start: Date; end: Date };
  animationClass?: string;
  onPhaseClick?: (phase: GanttTask) => void;
  onTaskDateUpdate?: (taskId: string, startDate: Date | null, endDate: Date | null) => void;
  calculateDateFromPosition?: (x: number, columnWidth: number) => Date;
}

const TaskBarRow: React.FC<TaskBarRowProps> = memo(
  ({
    task,
    viewMode,
    columnWidth,
    columnsCount,
    dateRange,
    animationClass = '',
    onPhaseClick,
    onTaskDateUpdate,
    calculateDateFromPosition,
  }) => {
    const { t } = useTranslation('gantt');
    const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [tempDates, setTempDates] = useState<{ start: Date | null; end: Date | null }>({
      start: task.start_date,
      end: task.end_date,
    });
    const dragStartRef = useRef<{
      x: number;
      originalStart: Date | null;
      originalEnd: Date | null;
    }>({
      x: 0,
      originalStart: null,
      originalEnd: null,
    });
    const isActiveRef = useRef(false);

    // Update temp dates when task changes
    useEffect(() => {
      setTempDates({ start: task.start_date, end: task.end_date });
    }, [task.start_date, task.end_date]);

    // Create stable refs for current values
    const currentStateRef = useRef({
      isResizing,
      isDragging,
      tempDates,
      dateRange,
      viewMode,
      columnWidth,
    });

    // Update refs on each render
    useEffect(() => {
      currentStateRef.current = {
        isResizing,
        isDragging,
        tempDates,
        dateRange,
        viewMode,
        columnWidth,
      };
    });

    const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isActiveRef.current || !currentStateRef.current.dateRange) return;

      const {
        isResizing: currentResize,
        isDragging: currentDrag,
        tempDates: currentTempDates,
        viewMode: currentViewMode,
        columnWidth: currentColumnWidth,
      } = currentStateRef.current;

      const deltaX = e.clientX - dragStartRef.current.x;

      // Calculate delta based on view mode for more precision
      let deltaUnits: number;
      switch (currentViewMode) {
        case 'day':
          deltaUnits = Math.round(deltaX / currentColumnWidth);
          break;
        case 'week':
          deltaUnits = Math.round(deltaX / (currentColumnWidth / 7)); // 7 days per week column
          break;
        case 'month':
          deltaUnits = Math.round(deltaX / (currentColumnWidth / 30)); // Approximate 30 days per month
          break;
        case 'quarter':
          deltaUnits = Math.round(deltaX / (currentColumnWidth / 90)); // Approximate 90 days per quarter
          break;
        case 'year':
          deltaUnits = Math.round(deltaX / (currentColumnWidth / 365)); // 365 days per year
          break;
        default:
          deltaUnits = Math.round(deltaX / currentColumnWidth);
      }

      if (currentResize === 'left' && dragStartRef.current.originalStart) {
        // Resizing from left - adjust start date
        const newStart = new Date(dragStartRef.current.originalStart);
        newStart.setDate(newStart.getDate() + deltaUnits);

        // Don't allow start to go past end
        if (currentTempDates.end && newStart < currentTempDates.end) {
          setTempDates(prev => ({ ...prev, start: newStart }));
        }
      } else if (currentResize === 'right' && dragStartRef.current.originalEnd) {
        // Resizing from right - adjust end date
        const newEnd = new Date(dragStartRef.current.originalEnd);
        newEnd.setDate(newEnd.getDate() + deltaUnits);

        // Don't allow end to go before start
        if (currentTempDates.start && newEnd > currentTempDates.start) {
          setTempDates(prev => ({ ...prev, end: newEnd }));
        }
      } else if (
        currentDrag &&
        dragStartRef.current.originalStart &&
        dragStartRef.current.originalEnd
      ) {
        // Dragging entire bar - adjust both dates
        const newStart = new Date(dragStartRef.current.originalStart);
        const newEnd = new Date(dragStartRef.current.originalEnd);
        newStart.setDate(newStart.getDate() + deltaUnits);
        newEnd.setDate(newEnd.getDate() + deltaUnits);
        setTempDates({ start: newStart, end: newEnd });
      }
    }, []);

    const handleMouseUp = useCallback(() => {
      if (!isActiveRef.current) return;

      isActiveRef.current = false;

      // Remove global event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Remove body classes
      document.body.classList.remove('gantt-dragging', 'gantt-resizing');

      // Save the changes if dates changed
      const currentTempDates = currentStateRef.current.tempDates;
      if (
        onTaskDateUpdate &&
        (currentTempDates.start?.getTime() !== task.start_date?.getTime() ||
          currentTempDates.end?.getTime() !== task.end_date?.getTime())
      ) {
        onTaskDateUpdate(task.id, currentTempDates.start, currentTempDates.end);
      }

      setIsResizing(null);
      setIsDragging(false);
    }, [handleMouseMove, onTaskDateUpdate, task.id, task.start_date, task.end_date]);

    // Cleanup effect to remove body classes and event listeners on unmount
    useEffect(() => {
      return () => {
        isActiveRef.current = false;
        document.body.classList.remove('gantt-dragging', 'gantt-resizing');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, [handleMouseMove, handleMouseUp]);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent, type: 'left' | 'right' | 'drag') => {
        e.stopPropagation();
        e.preventDefault();

        console.log(`Mouse down: ${type}`, { tempDates, isActiveRef: isActiveRef.current }); // Debug log

        isActiveRef.current = true;

        if (type === 'drag') {
          setIsDragging(true);
          document.body.classList.add('gantt-dragging');
        } else {
          setIsResizing(type);
          document.body.classList.add('gantt-resizing');
        }

        dragStartRef.current = {
          x: e.clientX,
          originalStart: tempDates.start,
          originalEnd: tempDates.end,
        };

        // Add global mouse event listeners
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      },
      [tempDates.start, tempDates.end, handleMouseMove, handleMouseUp]
    );

    const renderMilestone = () => {
      if (!task.start_date || !dateRange) return null;

      // Calculate position for milestone diamond based on day alignment
      const startOfRange = new Date(dateRange.start);
      startOfRange.setHours(0, 0, 0, 0);

      const startOfMilestone = new Date(task.start_date);
      startOfMilestone.setHours(0, 0, 0, 0);

      // Calculate days from range start to milestone start
      const daysFromStart = Math.floor(
        (startOfMilestone.getTime() - startOfRange.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Position milestone at the center of the day column
      const left = daysFromStart * columnWidth + columnWidth / 2;

      return (
        <div
          className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 rotate-45 z-10 shadow-sm"
          style={{
            left: `${left}px`,
            backgroundColor: task.color || '#3b82f6',
          }}
          title={`${task.name} - ${task.start_date.toLocaleDateString()}`}
        />
      );
    };

    const renderTaskBar = () => {
      if (!dateRange) return null;

      // For tasks without dates, show a placeholder on click
      if (!tempDates.start || !tempDates.end) {
        return (
          <div
            className="absolute inset-0 flex items-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            title={t('task.clickTimelineSetDates', 'Click on timeline to set dates for this task')}
          >
            <div className="text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm border border-gray-200 dark:border-gray-600 ml-2">
              {t('task.clickTimelineAddDates', 'Click timeline to add dates')}
            </div>
          </div>
        );
      }

      // Calculate position and width for task bar based on precise day alignment
      const startOfRange = new Date(dateRange.start);
      startOfRange.setHours(0, 0, 0, 0);

      const startOfTask = new Date(tempDates.start);
      startOfTask.setHours(0, 0, 0, 0);

      const endOfTask = new Date(tempDates.end);
      endOfTask.setHours(23, 59, 59, 999); // Set to end of day for proper width calculation

      const totalWidth = columnsCount * columnWidth;

      // Calculate days from range start to task start
      const daysFromStart = Math.floor(
        (startOfTask.getTime() - startOfRange.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate task duration in days (inclusive)
      const taskDurationDays =
        Math.floor((endOfTask.getTime() - startOfTask.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Position based on day columns
      const left = Math.max(0, daysFromStart * columnWidth);
      const width = Math.max(columnWidth, taskDurationDays * columnWidth);

      return (
        <div
          className={`absolute top-1/2 transform -translate-y-1/2 h-6 rounded flex items-center text-xs text-white font-medium shadow-sm group gantt-task-bar ${
            isDragging
              ? 'dragging cursor-move'
              : isResizing
                ? 'resizing'
                : 'cursor-grab hover:cursor-grab'
          }`}
          style={{
            left: `${left}px`,
            width: `${width}px`,
            backgroundColor: task.color || '#6b7280',
            opacity: isResizing || isDragging ? 0.8 : 1,
          }}
          title={`${task.name} - ${tempDates.start.toLocaleDateString()} to ${tempDates.end.toLocaleDateString()}`}
        >
          {/* Left resize handle */}
          <div
            className="gantt-resize-handle left"
            onMouseDown={e => handleMouseDown(e, 'left')}
            title={t('task.resizeStartDate', 'Resize start date')}
          >
            <div className="w-1 h-4 bg-white bg-opacity-60 rounded-sm opacity-20 group-hover:opacity-100 hover:opacity-100 transition-opacity" />
          </div>

          {/* Task content area - draggable */}
          <div
            className={`flex-1 flex items-center px-2 min-w-0 h-full ${
              isDragging ? 'cursor-move' : 'cursor-grab hover:cursor-grab'
            }`}
            onMouseDown={e => handleMouseDown(e, 'drag')}
            style={{ userSelect: 'none' }}
            title={t('task.dragToMove', 'Drag to move task')}
          >
            {/* Task name */}
            <div className="truncate flex-1 pointer-events-none select-none">{task.name}</div>
          </div>

          {/* Progress bar */}
          {task.progress > 0 && (
            <div
              className="absolute top-0 left-0 h-full bg-black bg-opacity-20 rounded pointer-events-none z-10"
              style={{ width: `${task.progress}%` }}
            />
          )}

          {/* Right resize handle */}
          <div
            className="gantt-resize-handle right"
            onMouseDown={e => handleMouseDown(e, 'right')}
            title={t('task.resizeEndDate', 'Resize end date')}
          >
            <div className="w-1 h-4 bg-white bg-opacity-60 rounded-sm opacity-20 group-hover:opacity-100 hover:opacity-100 transition-opacity" />
          </div>
        </div>
      );
    };

    const isPhase = task.type === 'milestone' || task.is_milestone;

    const handleClick = (e: React.MouseEvent) => {
      // For regular tasks without dates, calculate date from click position
      if (
        !isPhase &&
        (!task.start_date || !task.end_date) &&
        calculateDateFromPosition &&
        onTaskDateUpdate
      ) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickedDate = calculateDateFromPosition(x, columnWidth);

        // Set both start and end date based on view mode
        const startDate = new Date(clickedDate);
        startDate.setHours(0, 0, 0, 0); // Start of day

        const endDate = new Date(clickedDate);
        switch (viewMode) {
          case 'day':
            // For day view, end at end of the same day
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'week':
            // For week view, span one week
            endDate.setDate(endDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'month':
            // For month view, span one month
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(endDate.getDate() - 1);
            endDate.setHours(23, 59, 59, 999);
            break;
          default:
            // Default to next day
            endDate.setDate(endDate.getDate() + 1);
            endDate.setHours(23, 59, 59, 999);
        }

        setTempDates({ start: startDate, end: endDate });
        onTaskDateUpdate(task.id, startDate, endDate);
      } else if (isPhase && onPhaseClick) {
        onPhaseClick(task);
      }
    };

    return (
      <div
        className={`${isPhase ? 'min-h-[4.5rem]' : 'h-9'} relative border-b border-gray-100 dark:border-gray-700 transition-colors ${
          !isPhase
            ? 'hover:bg-gray-50 dark:hover:bg-gray-750'
            : onPhaseClick
              ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750'
              : ''
        } ${animationClass}`}
        onClick={handleClick}
        style={{
          ...(isPhase && task.color ? { backgroundColor: addAlphaToHex(task.color, 0.15) } : {}),
          // Set lower z-index when no phase click handler so parent can receive clicks
          ...(isPhase && !onPhaseClick ? { position: 'relative', zIndex: 1 } : {}),
        }}
      >
        {isPhase ? renderMilestone() : renderTaskBar()}
      </div>
    );
  }
);

TaskBarRow.displayName = 'TaskBarRow';

// Task Creation Popover Component
const TaskCreationPopover: React.FC<{
  taskPopover: {
    taskName: string;
    date: Date;
    phaseId: string | null;
    position: { x: number; y: number };
    visible: boolean;
  };
  onTaskNameChange: (name: string) => void;
  onCreateTask: () => void;
  onCancel: () => void;
}> = ({ taskPopover, onTaskNameChange, onCreateTask, onCancel }) => {
  const { t } = useTranslation('gantt');

  if (!taskPopover.visible) {
    return null;
  }

  return ReactDOM.createPortal(
    <>
      {/* Click outside overlay to close popover */}
      <div className="fixed inset-0 z-[9999] bg-black/5" onClick={onCancel} />

      {/* Popover */}
      <div
        className="fixed z-[10000]"
        style={{
          left: `${taskPopover.position.x - 100}px`,
          top: `${taskPopover.position.y - 30}px`,
        }}
      >
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 min-w-[250px]">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('task.addTaskFor', 'Add task for {{date}}', {
              date: taskPopover.date.toLocaleDateString(),
            })}
          </div>
          <Input
            value={taskPopover.taskName}
            onChange={e => onTaskNameChange(e.target.value)}
            onPressEnter={onCreateTask}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                onCancel();
              }
            }}
            placeholder={t('task.enterTaskName', 'Enter task name...')}
            autoFocus
            size="small"
            className="mb-2"
          />
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {t('task.pressEnterToCreate', 'Press Enter to create • Esc to cancel')}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

const GanttChart = forwardRef<HTMLDivElement, GanttChartProps>(
  (
    {
      tasks,
      viewMode,
      onScroll,
      onPhaseClick,
      containerRef,
      dateRange,
      phases,
      expandedTasks,
      animatingTasks,
      onCreateQuickTask,
      projectId,
    },
    ref
  ) => {
    // State for popover task creation
    const [taskPopover, setTaskPopover] = useState<{
      taskName: string;
      date: Date;
      phaseId: string | null;
      position: { x: number; y: number };
      visible: boolean;
    } | null>(null);

    // API mutation for updating task dates
    const [updateTaskDates, { isLoading: isUpdatingDates }] = useUpdateTaskDatesMutation();

    const columnsCount = useMemo(() => {
      if (!dateRange) {
        // Default counts if no date range
        switch (viewMode) {
          case 'day':
            return 30;
          case 'week':
            return 12;
          case 'month':
            return 12;
          case 'quarter':
            return 8;
          case 'year':
            return 5;
          default:
            return 12;
        }
      }

      const { start, end } = dateRange;
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let baseColumnsCount = 0;

      switch (viewMode) {
        case 'day':
          baseColumnsCount = diffDays;
          break;
        case 'week':
          baseColumnsCount = Math.ceil(diffDays / 7);
          break;
        case 'month':
          const startYear = start.getFullYear();
          const startMonth = start.getMonth();
          const endYear = end.getFullYear();
          const endMonth = end.getMonth();
          baseColumnsCount = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
          break;
        case 'quarter':
          const qStartYear = start.getFullYear();
          const qStartQuarter = Math.ceil((start.getMonth() + 1) / 3);
          const qEndYear = end.getFullYear();
          const qEndQuarter = Math.ceil((end.getMonth() + 1) / 3);
          baseColumnsCount = (qEndYear - qStartYear) * 4 + (qEndQuarter - qStartQuarter) + 1;
          break;
        case 'year':
          baseColumnsCount = end.getFullYear() - start.getFullYear() + 1;
          break;
        default:
          baseColumnsCount = 12;
      }

      return baseColumnsCount;
    }, [viewMode, dateRange]);

    // Calculate exact date from mouse position within timeline columns
    const calculateDateFromPosition = useCallback(
      (x: number, columnWidth: number): Date => {
        if (!dateRange) return new Date();

        // Calculate which column was clicked and position within that column
        const columnIndex = Math.floor(x / columnWidth);
        const positionWithinColumn = (x % columnWidth) / columnWidth; // 0 to 1

        const { start, end } = dateRange;
        let targetDate = new Date(start);

        // Handle virtual columns beyond the actual date range
        const actualColumnsInRange = columnsCount;
        const isVirtualColumn = columnIndex >= actualColumnsInRange;

        // If it's a virtual column, extend the date by calculating based on the end date
        if (isVirtualColumn) {
          const virtualColumnIndex = columnIndex - actualColumnsInRange;
          targetDate = new Date(end);

          switch (viewMode) {
            case 'day':
              targetDate.setDate(targetDate.getDate() + virtualColumnIndex + 1);
              targetDate.setHours(Math.min(Math.floor(positionWithinColumn * 24), 23), 0, 0, 0);
              break;
            case 'week':
              targetDate.setDate(targetDate.getDate() + (virtualColumnIndex + 1) * 7);
              const dayWithinVirtualWeek = Math.min(Math.floor(positionWithinColumn * 7), 6);
              targetDate.setDate(targetDate.getDate() + dayWithinVirtualWeek);
              targetDate.setHours(0, 0, 0, 0);
              break;
            case 'month':
              targetDate.setMonth(targetDate.getMonth() + virtualColumnIndex + 1);
              const daysInVirtualMonth = new Date(
                targetDate.getFullYear(),
                targetDate.getMonth() + 1,
                0
              ).getDate();
              const dayWithinVirtualMonth = Math.max(
                1,
                Math.min(Math.ceil(positionWithinColumn * daysInVirtualMonth), daysInVirtualMonth)
              );
              targetDate.setDate(dayWithinVirtualMonth);
              targetDate.setHours(0, 0, 0, 0);
              break;
            case 'quarter':
              const quartersToAdd = virtualColumnIndex + 1;
              targetDate.setMonth(targetDate.getMonth() + quartersToAdd * 3);
              const quarterStartMonth = Math.floor(targetDate.getMonth() / 3) * 3;
              targetDate.setMonth(quarterStartMonth, 1);
              const quarterEndDate = new Date(targetDate.getFullYear(), quarterStartMonth + 3, 0);
              const daysInVirtualQuarter =
                Math.floor(
                  (quarterEndDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)
                ) + 1;
              const dayWithinVirtualQuarter = Math.min(
                Math.floor(positionWithinColumn * daysInVirtualQuarter),
                daysInVirtualQuarter - 1
              );
              targetDate.setDate(targetDate.getDate() + dayWithinVirtualQuarter);
              targetDate.setHours(0, 0, 0, 0);
              break;
            case 'year':
              targetDate.setFullYear(targetDate.getFullYear() + virtualColumnIndex + 1);
              const isLeapYear =
                (targetDate.getFullYear() % 4 === 0 && targetDate.getFullYear() % 100 !== 0) ||
                targetDate.getFullYear() % 400 === 0;
              const daysInVirtualYear = isLeapYear ? 366 : 365;
              const dayWithinVirtualYear = Math.min(
                Math.floor(positionWithinColumn * daysInVirtualYear),
                daysInVirtualYear - 1
              );
              targetDate = new Date(targetDate.getFullYear(), 0, 1 + dayWithinVirtualYear);
              targetDate.setHours(0, 0, 0, 0);
              break;
            default:
              targetDate.setDate(targetDate.getDate() + virtualColumnIndex + 1);
              targetDate.setHours(0, 0, 0, 0);
              break;
          }

          return targetDate;
        }

        switch (viewMode) {
          case 'day':
            // Timeline shows individual days - each column is one day
            const dayStart = new Date(start);
            const dayDates: Date[] = [];
            const tempDayDate = new Date(dayStart);
            while (tempDayDate <= end && dayDates.length <= columnIndex) {
              dayDates.push(new Date(tempDayDate));
              tempDayDate.setDate(tempDayDate.getDate() + 1);
            }

            if (dayDates[columnIndex]) {
              targetDate = new Date(dayDates[columnIndex]);
              // For day view, add hours based on position within column (0-23 hours)
              const hour = Math.min(Math.floor(positionWithinColumn * 24), 23);
              targetDate.setHours(hour, 0, 0, 0);
            } else if (dayDates.length > 0) {
              // Fallback to last available day if index is out of bounds
              targetDate = new Date(dayDates[dayDates.length - 1]);
              targetDate.setHours(23, 59, 59, 999);
            }
            break;

          case 'week':
            // Timeline shows weeks - calculate specific day within the week
            const weekStart = new Date(start);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)

            const weekDates: Date[] = [];
            const tempWeekDate = new Date(weekStart);
            while (tempWeekDate <= end && weekDates.length <= columnIndex) {
              weekDates.push(new Date(tempWeekDate));
              tempWeekDate.setDate(tempWeekDate.getDate() + 7);
            }

            if (weekDates[columnIndex]) {
              targetDate = new Date(weekDates[columnIndex]);
              // Add days within the week (0-6 days from Sunday)
              const dayWithinWeek = Math.min(Math.floor(positionWithinColumn * 7), 6);
              targetDate.setDate(targetDate.getDate() + dayWithinWeek);
              targetDate.setHours(0, 0, 0, 0);
            } else if (weekDates.length > 0) {
              // Fallback to last available week if index is out of bounds
              targetDate = new Date(weekDates[weekDates.length - 1]);
              targetDate.setDate(targetDate.getDate() + 6); // End of week
              targetDate.setHours(23, 59, 59, 999);
            }
            break;

          case 'month':
            // Timeline shows months - calculate specific day within the month
            const startYear = start.getFullYear();
            const startMonth = start.getMonth();
            const endYear = end.getFullYear();
            const endMonth = end.getMonth();

            const monthDates: Date[] = [];
            let currentYear = startYear;
            let currentMonth = startMonth;

            while (
              (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) &&
              monthDates.length <= columnIndex
            ) {
              monthDates.push(new Date(currentYear, currentMonth, 1));
              currentMonth++;
              if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
              }
            }

            if (monthDates[columnIndex]) {
              targetDate = new Date(monthDates[columnIndex]);
              // Calculate days in this month
              const daysInMonth = new Date(
                targetDate.getFullYear(),
                targetDate.getMonth() + 1,
                0
              ).getDate();
              // Add days within the month (1-daysInMonth)
              const dayWithinMonth = Math.max(
                1,
                Math.min(Math.ceil(positionWithinColumn * daysInMonth), daysInMonth)
              );
              targetDate.setDate(dayWithinMonth);
              targetDate.setHours(0, 0, 0, 0);
            } else if (monthDates.length > 0) {
              // Fallback to last available month if index is out of bounds
              targetDate = new Date(monthDates[monthDates.length - 1]);
              const daysInMonth = new Date(
                targetDate.getFullYear(),
                targetDate.getMonth() + 1,
                0
              ).getDate();
              targetDate.setDate(daysInMonth);
              targetDate.setHours(23, 59, 59, 999);
            }
            break;

          case 'quarter':
            // Timeline shows quarters - calculate specific month and day within quarter
            const qStartYear = start.getFullYear();
            const qStartQuarter = Math.ceil((start.getMonth() + 1) / 3);
            const qEndYear = end.getFullYear();
            const qEndQuarter = Math.ceil((end.getMonth() + 1) / 3);

            const quarterDates: Date[] = [];
            let qYear = qStartYear;
            let qQuarter = qStartQuarter;

            while (
              (qYear < qEndYear || (qYear === qEndYear && qQuarter <= qEndQuarter)) &&
              quarterDates.length <= columnIndex
            ) {
              const quarterStartMonth = (qQuarter - 1) * 3;
              quarterDates.push(new Date(qYear, quarterStartMonth, 1));

              qQuarter++;
              if (qQuarter > 4) {
                qQuarter = 1;
                qYear++;
              }
            }

            if (quarterDates[columnIndex]) {
              targetDate = new Date(quarterDates[columnIndex]);
              // Calculate exact days in this quarter
              const quarterStartMonth = targetDate.getMonth();
              const quarterEndMonth = Math.min(quarterStartMonth + 2, 11);
              const quarterEndDate = new Date(targetDate.getFullYear(), quarterEndMonth + 1, 0);
              const daysInQuarter =
                Math.floor(
                  (quarterEndDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)
                ) + 1;

              const dayWithinQuarter = Math.min(
                Math.floor(positionWithinColumn * daysInQuarter),
                daysInQuarter - 1
              );
              targetDate.setDate(targetDate.getDate() + dayWithinQuarter);
              targetDate.setHours(0, 0, 0, 0);
            } else if (quarterDates.length > 0) {
              // Fallback to last available quarter if index is out of bounds
              targetDate = new Date(quarterDates[quarterDates.length - 1]);
              const quarterStartMonth = targetDate.getMonth();
              const quarterEndMonth = Math.min(quarterStartMonth + 2, 11);
              targetDate.setMonth(quarterEndMonth);
              const daysInMonth = new Date(
                targetDate.getFullYear(),
                quarterEndMonth + 1,
                0
              ).getDate();
              targetDate.setDate(daysInMonth);
              targetDate.setHours(23, 59, 59, 999);
            }
            break;

          case 'year':
            // Timeline shows years - calculate specific month and day within year
            const yearStart = start.getFullYear();
            const yearEnd = end.getFullYear();

            const yearDates: Date[] = [];
            for (let year = yearStart; year <= yearEnd && yearDates.length <= columnIndex; year++) {
              yearDates.push(new Date(year, 0, 1));
            }

            if (yearDates[columnIndex]) {
              targetDate = new Date(yearDates[columnIndex]);
              // Calculate exact days in this year
              const isLeapYear =
                (targetDate.getFullYear() % 4 === 0 && targetDate.getFullYear() % 100 !== 0) ||
                targetDate.getFullYear() % 400 === 0;
              const daysInYear = isLeapYear ? 366 : 365;
              const dayWithinYear = Math.min(
                Math.floor(positionWithinColumn * daysInYear),
                daysInYear - 1
              );

              // Add days carefully to avoid month overflow
              const tempDate = new Date(targetDate.getFullYear(), 0, 1 + dayWithinYear);
              targetDate = tempDate;
              targetDate.setHours(0, 0, 0, 0);
            } else if (yearDates.length > 0) {
              // Fallback to last available year if index is out of bounds
              targetDate = new Date(yearDates[yearDates.length - 1]);
              targetDate.setMonth(11, 31); // December 31st
              targetDate.setHours(23, 59, 59, 999);
            }
            break;

          default:
            // Default to day precision
            targetDate = new Date(start);
            targetDate.setDate(start.getDate() + columnIndex);
            targetDate.setHours(0, 0, 0, 0);
            break;
        }

        // Final safety check - ensure we have a valid date
        if (isNaN(targetDate.getTime())) {
          console.warn('Invalid date calculated, falling back to start date');
          targetDate = new Date(start);
          targetDate.setHours(0, 0, 0, 0);
        }

        // Ensure date is within the dateRange bounds
        if (targetDate < start) {
          targetDate = new Date(start);
          targetDate.setHours(0, 0, 0, 0);
        } else if (targetDate > end) {
          targetDate = new Date(end);
          targetDate.setHours(23, 59, 59, 999);
        }

        return targetDate;
      },
      [dateRange, viewMode, columnsCount]
    );

    // First get basic dimensions to access containerWidth
    const basicDimensions = useGanttDimensions(viewMode, containerRef, columnsCount);

    // Calculate effective columns count that ensures container coverage
    const effectiveColumnsCount = useMemo(() => {
      if (!basicDimensions.containerWidth || basicDimensions.containerWidth === 0) {
        return columnsCount;
      }

      // Import the column width calculation
      const getBaseColumnWidth = (mode: GanttViewMode): number => {
        switch (mode) {
          case 'day':
            return 40;
          case 'week':
            return 60;
          case 'month':
            return 80;
          case 'quarter':
            return 120;
          case 'year':
            return 160;
          default:
            return 80;
        }
      };

      const baseColumnWidth = getBaseColumnWidth(viewMode);
      const minColumnsNeeded = Math.ceil(basicDimensions.containerWidth / baseColumnWidth);

      // For views that should stretch (month, quarter, year), ensure we have enough columns
      // but don't add too many extra columns for day/week views
      const shouldEnsureMinimum = viewMode !== 'day' && viewMode !== 'week';

      if (shouldEnsureMinimum) {
        return Math.max(columnsCount, minColumnsNeeded);
      } else {
        // For day/week views, we want scrolling, so just use calculated columns
        // But ensure we have at least enough to fill a reasonable portion
        return Math.max(columnsCount, Math.min(minColumnsNeeded, columnsCount * 2));
      }
    }, [columnsCount, basicDimensions.containerWidth, viewMode]);

    // Get final dimensions with effective column count
    const { actualColumnWidth, totalWidth, shouldScroll, containerWidth } = useGanttDimensions(
      viewMode,
      containerRef,
      effectiveColumnsCount
    );

    const gridColumns = useMemo(
      () => Array.from({ length: effectiveColumnsCount }).map((_, index) => index),
      [effectiveColumnsCount]
    );

    // Flatten tasks to match the same hierarchy as task list
    // This should be synchronized with the task list component's expand/collapse state
    const flattenedTasks = useMemo(() => {
      const result: Array<
        GanttTask | { id: string; isEmptyRow: boolean; isAddPhaseRow?: boolean }
      > = [];
      const processedIds = new Set<string>(); // Track processed task IDs to prevent duplicates

      const processTask = (task: GanttTask, level: number = 0) => {
        const isPhase = task.type === 'milestone' || task.is_milestone;
        const phaseId = isPhase
          ? task.id === 'phase-unmapped'
            ? 'unmapped'
            : task.phase_id || task.id.replace('phase-', '')
          : task.id;
        const isExpanded = expandedTasks ? expandedTasks.has(phaseId) : task.expanded !== false;

        // Avoid processing the same task multiple times
        if (processedIds.has(task.id)) {
          return;
        }
        processedIds.add(task.id);

        // Set the correct level for nested tasks
        const taskWithLevel = { ...task, level };
        result.push(taskWithLevel);

        if (isPhase && isExpanded) {
          // Add children if they exist
          if (task.children && task.children.length > 0) {
            task.children.forEach(child => processTask(child, level + 1));
          }
          // Add an empty row for the "Add Task" button at the end (only if not already processed)
          const addTaskId = `add-task-${task.id}-timeline`;
          if (!processedIds.has(addTaskId)) {
            processedIds.add(addTaskId);
            result.push({ id: addTaskId, isEmptyRow: true });
          }
        } else if (!isPhase && task.children && expandedTasks && expandedTasks.has(task.id)) {
          task.children.forEach(child => processTask(child, level + 1));
        }
      };

      tasks.forEach(task => processTask(task, 0));

      // Add the "Add Phase" row at the end
      result.push({ id: 'add-phase-timeline', isEmptyRow: true, isAddPhaseRow: true });

      return result;
    }, [tasks, expandedTasks]);

    // Use flattenedTasks directly since we're using popover instead of inline rows
    const finalTasks = flattenedTasks;

    // Handle timeline click - defined after flattenedTasks
    const handleTimelineClick = useCallback(
      (e: React.MouseEvent, rowIndex: number) => {
        if (!dateRange || !onCreateQuickTask) return;

        // Get the task for this row
        const task = flattenedTasks[rowIndex];

        // Check if this is a phase row - only show popover for phase rows
        const isPhase = task && 'type' in task && (task.type === 'milestone' || task.is_milestone);
        if (!isPhase) {
          return; // Don't show popover for non-phase rows
        }

        // Get the click position relative to the timeline
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;

        // Calculate which date was clicked based on column position
        const clickedDate = calculateDateFromPosition(x, actualColumnWidth);

        // Find which phase this row belongs to
        let phaseId: string | null = null;

        if (task && 'phase_id' in task) {
          phaseId = task.phase_id || null;
        } else {
          // Find the nearest phase above this row
          for (let i = rowIndex - 1; i >= 0; i--) {
            const prevTask = flattenedTasks[i];
            if (prevTask && 'is_milestone' in prevTask && prevTask.is_milestone) {
              phaseId = prevTask.phase_id || prevTask.id.replace('phase-', '');
              break;
            }
          }
        }

        // Get the click position relative to the viewport for popover positioning
        const clickX = e.clientX;
        const clickY = e.clientY;

        const newPopoverState = {
          taskName: '',
          date: clickedDate,
          phaseId,
          position: { x: clickX, y: clickY },
          visible: true,
        };
        setTaskPopover(newPopoverState);
      },
      [dateRange, onCreateQuickTask, flattenedTasks, calculateDateFromPosition, actualColumnWidth]
    );

    // Handle task creation
    const handleCreateTask = useCallback(() => {
      if (taskPopover && onCreateQuickTask && taskPopover.taskName.trim()) {
        onCreateQuickTask(
          taskPopover.taskName.trim(),
          taskPopover.phaseId || undefined,
          taskPopover.date
        );
        setTaskPopover(null);
      }
    }, [taskPopover, onCreateQuickTask]);

    // Handle cancel
    const handleCancel = useCallback(() => {
      setTaskPopover(null);
    }, []);

    // Handle task date update
    const handleTaskDateUpdate = useCallback(
      async (taskId: string, startDate: Date | null, endDate: Date | null) => {
        if (!startDate || !endDate) return;

        try {
          await updateTaskDates({
            task_id: taskId,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          }).unwrap();

          message.success('Task dates updated successfully');
        } catch (error) {
          console.error('Failed to update task dates:', error);
          message.error('Failed to update task dates');
        }
      },
      [updateTaskDates]
    );

    return (
      <>
        <div
          ref={ref}
          className={`flex-1 relative bg-white dark:bg-gray-800 overflow-y-auto ${
            shouldScroll ? 'overflow-x-auto' : 'overflow-x-hidden'
          } gantt-chart-scroll`}
          onScroll={onScroll}
        >
          <div
            className="relative"
            style={{
              width: `${totalWidth}px`,
              minHeight: '100%',
              minWidth: shouldScroll ? 'auto' : '100%',
            }}
          >
            <div
              className="absolute top-0 left-0 bottom-0 flex pointer-events-none"
              style={{ width: `${totalWidth}px` }}
            >
              {/* Grid columns for timeline */}
              {gridColumns.map(index => (
                <GridColumn
                  key={`grid-col-${index}`}
                  index={index}
                  columnWidth={actualColumnWidth}
                />
              ))}
            </div>
            <div className="relative z-10">
              {finalTasks.map((item, index) => {
                if ('isEmptyRow' in item && item.isEmptyRow) {
                  // Check if this is the Add Phase row
                  if ('isAddPhaseRow' in item && item.isAddPhaseRow) {
                    return (
                      <div
                        key={item.id}
                        className="min-h-[4.5rem] border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20"
                      />
                    );
                  }

                  // Regular add-task row - determine animation classes
                  const addTaskPhaseId = item.id.replace('add-task-', '').replace('-timeline', '');
                  const shouldAnimate = animatingTasks ? animatingTasks.has(addTaskPhaseId) : false;
                  const staggerIndex = Math.min((index - 1) % 5, 4);
                  const animationClass = shouldAnimate
                    ? `gantt-task-slide-in gantt-task-stagger-${staggerIndex + 1}`
                    : '';

                  // Render empty row for add-task
                  return (
                    <div
                      key={item.id}
                      className={`h-9 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 ${animationClass}`}
                    />
                  );
                }

                const task = item as GanttTask;
                const isPhase = task.type === 'milestone' || task.is_milestone;

                // Determine if this task should have animation classes
                let parentPhaseId = '';
                if (isPhase) {
                  parentPhaseId =
                    task.id === 'phase-unmapped'
                      ? 'unmapped'
                      : task.phase_id || task.id.replace('phase-', '');
                } else {
                  parentPhaseId = task.phase_id || '';
                }

                const shouldAnimate =
                  !isPhase && animatingTasks ? animatingTasks.has(parentPhaseId) : false;
                const staggerIndex = Math.min((index - 1) % 5, 4);
                const animationClass = shouldAnimate
                  ? `gantt-task-slide-in gantt-task-stagger-${staggerIndex + 1}`
                  : '';

                return (
                  <div
                    key={item.id}
                    className={`relative transition-colors ${
                      isPhase
                        ? 'cursor-pointer hover:bg-blue-50/30 dark:hover:bg-blue-900/10'
                        : 'hover:bg-gray-50/50 dark:hover:bg-gray-700/30'
                    } ${animationClass}`}
                    onClick={e => {
                      handleTimelineClick(e, index);
                    }}
                    style={{
                      height: isPhase ? '4.5rem' : '2.25rem',
                      zIndex: 10,
                    }}
                  >
                    <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                      <TaskBarRow
                        task={task}
                        viewMode={viewMode}
                        columnWidth={actualColumnWidth}
                        columnsCount={columnsCount}
                        dateRange={dateRange}
                        animationClass=""
                        onPhaseClick={undefined}
                        onTaskDateUpdate={handleTaskDateUpdate}
                        calculateDateFromPosition={calculateDateFromPosition}
                      />
                    </div>
                  </div>
                );
              })}
              {finalTasks.length === 0 && (
                <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
                  No tasks to display
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Creation Popover */}
        {taskPopover && taskPopover.visible && (
          <TaskCreationPopover
            taskPopover={taskPopover}
            onTaskNameChange={name =>
              setTaskPopover(prev => (prev ? { ...prev, taskName: name } : null))
            }
            onCreateTask={handleCreateTask}
            onCancel={handleCancel}
          />
        )}
      </>
    );
  }
);

GanttChart.displayName = 'GanttChart';

export default memo(GanttChart);
