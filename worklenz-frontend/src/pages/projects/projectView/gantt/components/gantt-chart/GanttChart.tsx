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
import { useGanttContext } from '../../context/gantt-context';
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
  onTaskClick?: (taskId: string) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange?: { start: Date; end: Date };
  phases?: GanttPhase[];
  expandedTasks?: Set<string>;
  animatingTasks?: Set<string>;
  onCreateQuickTask?: (taskName: string, phaseId?: string, startDate?: Date) => void;
  projectId?: string;
  onRefresh?: () => void;
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
  onTaskClick?: (taskId: string) => void;
  onTaskDateUpdate?: (taskId: string, startDate: Date | null, endDate: Date | null) => void;
  calculateDateFromPosition?: (x: number, columnWidth: number) => Date;
  timelineCalculator?: any; // Pass timeline calculator
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
    onTaskClick,
    onTaskDateUpdate,
    calculateDateFromPosition,
    timelineCalculator,
  }) => {
    const { t } = useTranslation('gantt');
    const isPhase = task.type === 'milestone' || task.is_milestone;

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
    const hasDraggedRef = useRef(false); // Track if the user actually dragged

    // Update temp dates when task changes (but not for phases - they should use actual dates)
    useEffect(() => {
      // Only update tempDates for regular tasks, not phases
      // AND only when not actively dragging/resizing
      // AND not when we just finished dragging (hasDraggedRef)
      if (!isPhase && !isDragging && !isResizing && !hasDraggedRef.current) {
        // Check if the dates have actually changed to avoid unnecessary updates
        const startChanged = tempDates.start?.getTime() !== task.start_date?.getTime();
        const endChanged = tempDates.end?.getTime() !== task.end_date?.getTime();

        if (startChanged || endChanged) {
          setTempDates({ start: task.start_date, end: task.end_date });
        }
      }
    }, [task.start_date, task.end_date, isPhase, isDragging, isResizing]);

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

      // Mark that we've actually dragged if movement is significant (more than 5 pixels)
      if (Math.abs(deltaX) > 5) {
        hasDraggedRef.current = true;
      }

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
      const datesChanged =
        hasDraggedRef.current &&
        (currentTempDates.start?.getTime() !== task.start_date?.getTime() ||
          currentTempDates.end?.getTime() !== task.end_date?.getTime());

      if (onTaskDateUpdate && datesChanged) {
        // Keep the temp dates as they are (don't revert) since we're updating the DB
        onTaskDateUpdate(task.id, currentTempDates.start, currentTempDates.end);
      }

      // Reset dragging state after a small delay to prevent click from firing
      setTimeout(() => {
        setIsResizing(null);
        setIsDragging(false);
        // Only reset hasDraggedRef after a longer delay if dates were changed
        // This prevents the useEffect from reverting the dates
        if (datesChanged) {
          setTimeout(() => {
            hasDraggedRef.current = false;
          }, 500);
        } else {
          hasDraggedRef.current = false;
        }
      }, 50);
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

        isActiveRef.current = true;
        hasDraggedRef.current = false; // Reset drag tracking

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
      if (!dateRange) return null;

      // Use actual task dates, not tempDates for phase rendering
      const actualStartDate = task.start_date;
      const actualEndDate = task.end_date;

      console.log(`renderMilestone for ${task.name}:`, {
        taskStartDate: task.start_date,
        taskEndDate: task.end_date,
        actualStartDate,
        actualEndDate,
        isPhase,
        taskId: task.id,
      });

      // For milestones without dates, show a placeholder
      if (!actualStartDate || !actualEndDate) {
        return (
          <div
            className="absolute inset-0 flex items-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            title={t('task.clickTimelineSetDates', 'Click on timeline to set dates for this phase')}
          >
            <div className="text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm border border-gray-200 dark:border-gray-600 ml-2">
              {t('task.clickTimelineAddDates', 'Click timeline to add dates')}
            </div>
          </div>
        );
      }

      // Use unified timeline calculator for consistent positioning
      let left = 0;
      let width = columnWidth;

      if (timelineCalculator) {
        const position = timelineCalculator.calculateTaskPosition(actualStartDate, actualEndDate);
        console.log(`Phase ${task.name} positioning:`, {
          startDate: actualStartDate,
          endDate: actualEndDate,
          calculatedPosition: position,
          viewMode,
          columnWidth,
        });

        if (position.isValid) {
          left = position.left;
          width = position.width;
        }
      } else {
        // Fallback to percentage-based positioning
        const startOfRange = new Date(dateRange.start);
        startOfRange.setHours(0, 0, 0, 0);

        const startOfMilestone = new Date(actualStartDate);
        startOfMilestone.setHours(0, 0, 0, 0);

        const endOfMilestone = new Date(actualEndDate);
        endOfMilestone.setHours(23, 59, 59, 999);

        const totalTimeSpan = dateRange.end.getTime() - dateRange.start.getTime();
        const milestoneStartOffset = startOfMilestone.getTime() - startOfRange.getTime();
        const milestoneEndOffset = endOfMilestone.getTime() - startOfRange.getTime();

        const totalWidth = columnsCount * columnWidth;
        const startPercent = Math.max(0, Math.min(1, milestoneStartOffset / totalTimeSpan));
        const endPercent = Math.max(0, Math.min(1, milestoneEndOffset / totalTimeSpan));

        left = Math.max(0, startPercent * totalWidth);
        width = Math.max(columnWidth * 0.5, (endPercent - startPercent) * totalWidth);
      }

      return (
        <div
          className="absolute inset-y-2 z-10 gantt-phase-bar"
          style={{
            left: `${left}px`,
            width: `${width}px`,
          }}
          title={t('task.phaseTitle', 'Phase: {{name}} - {{startDate}} to {{endDate}}', {
            name: task.name,
            startDate: actualStartDate.toLocaleDateString(),
            endDate: actualEndDate.toLocaleDateString(),
          })}
        >
          {/* Main phase bar with gradient and distinctive styling */}
          <div
            className="h-full rounded-lg flex items-center text-sm text-white font-bold shadow-lg border-2 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${task.color || '#3b82f6'} 0%, ${addAlphaToHex(task.color || '#3b82f6', 0.8)} 100%)`,
              borderColor: task.color || '#3b82f6',
              boxShadow: `0 4px 12px ${addAlphaToHex(task.color || '#3b82f6', 0.3)}`,
            }}
          >
            {/* Left accent stripe */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-white opacity-60" />

            {/* Phase content - non-draggable */}
            <div className="flex-1 flex items-center px-3 min-w-0 h-full pointer-events-none relative">
              {/* Phase name */}
              <div className="truncate flex-1 select-none font-bold tracking-wide text-shadow">
                {task.name}
              </div>

              {/* Progress indicator if phase has children */}
              {task.children && task.children.length > 0 && (
                <div className="flex-shrink-0 ml-2 text-xs gantt-phase-progress">
                  {Math.round(
                    (task.children.filter((child: any) => child.progress === 100).length /
                      task.children.length) *
                      100
                  )}
                  %
                </div>
              )}
            </div>

            {/* Subtle pattern overlay */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 4px,
                  rgba(255, 255, 255, 0.1) 4px,
                  rgba(255, 255, 255, 0.1) 8px
                )`,
              }}
            />

            {/* Right accent stripe */}
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white opacity-60" />
          </div>
        </div>
      );
    };

    const renderTaskBar = () => {
      if (!dateRange) return null;

      // For tasks without dates, show a hover preview and placeholder
      if (!tempDates.start || !tempDates.end) {
        const getDurationText = () => {
          switch (viewMode) {
            case 'day':
              return '3 days';
            case 'week':
              return '3 weeks';
            case 'month':
              return '3 months';
            case 'quarter':
              return '3 quarters';
            case 'year':
              return '3 years';
            default:
              return '3 days';
          }
        };

        return (
          <div className="absolute inset-0 gantt-task-preview-container group">
            {/* Hover preview bar that follows mouse */}
            <div
              className="gantt-task-preview-tracker"
              onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;

                // Calculate which column the mouse is over
                const columnIndex = Math.floor(x / columnWidth);

                // Always show exactly 3 cells width
                const previewWidth = 3 * columnWidth;

                // Debug log
                console.log('Preview calculation:', {
                  columnWidth,
                  columnIndex,
                  previewWidth,
                  rectWidth: rect.width,
                  mouseX: x,
                });

                // Position preview starting at the current column, but ensure it doesn't go off screen
                let previewLeft = columnIndex * columnWidth;

                // If preview would extend beyond the right edge, shift it left
                if (previewLeft + previewWidth > rect.width) {
                  previewLeft = Math.max(0, rect.width - previewWidth);
                }

                // Update preview bar position with exact dimensions
                const previewElement = e.currentTarget.querySelector(
                  '.gantt-task-preview-bar'
                ) as HTMLElement;
                if (previewElement) {
                  previewElement.style.left = `${previewLeft}px`;
                  previewElement.style.width = `${previewWidth}px`;
                  previewElement.style.opacity = '0.85';
                  previewElement.style.display = 'flex';
                }
              }}
              onMouseLeave={e => {
                const previewElement = e.currentTarget.querySelector(
                  '.gantt-task-preview-bar'
                ) as HTMLElement;
                if (previewElement) {
                  previewElement.style.opacity = '0';
                }
              }}
            >
              {/* Preview bar */}
              <div
                className="gantt-task-preview-bar absolute top-1/2 transform -translate-y-1/2 h-6 rounded-md transition-all duration-200 pointer-events-none opacity-0 flex items-center"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 4px 8px rgba(16, 185, 129, 0.4)',
                  border: '2px solid rgba(16, 185, 129, 0.6)',
                  left: '0px',
                  width: '0px', // Will be set dynamically
                }}
              >
                {/* Preview content */}
                <div className="flex-1 flex items-center justify-center px-2">
                  <span className="text-xs font-semibold text-white tracking-wide opacity-90">
                    {getDurationText()}
                  </span>
                </div>

                {/* Preview indicator dots */}
                <div className="absolute inset-x-0 bottom-0 flex justify-center space-x-1 pb-1">
                  <div className="w-1 h-1 bg-white rounded-full opacity-60"></div>
                  <div className="w-1 h-1 bg-white rounded-full opacity-60"></div>
                  <div className="w-1 h-1 bg-white rounded-full opacity-60"></div>
                </div>
              </div>

              {/* Text hint */}
              <div
                className="absolute inset-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pointer-events-auto"
                title={t(
                  'task.clickTimelineSetDates',
                  `Click on timeline to create ${getDurationText()} task`
                )}
              >
                <div className="text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm border border-gray-200 dark:border-gray-600 ml-2 pointer-events-none">
                  {t('task.clickTimelineAddDates', `Click to add ${getDurationText()}`)}
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Use unified timeline calculator for consistent positioning
      let left = 0;
      let width = columnWidth;

      if (timelineCalculator && tempDates.start && tempDates.end) {
        const position = timelineCalculator.calculateTaskPosition(tempDates.start, tempDates.end);

        if (position.isValid) {
          left = position.left;
          width = position.width;
        }
      } else {
        // Fallback to percentage-based positioning
        const startOfRange = new Date(dateRange.start);
        startOfRange.setHours(0, 0, 0, 0);

        const startOfTask = new Date(tempDates.start);
        startOfTask.setHours(0, 0, 0, 0);

        const endOfTask = new Date(tempDates.end);
        endOfTask.setHours(23, 59, 59, 999);

        const totalTimeSpan = dateRange.end.getTime() - dateRange.start.getTime();
        const taskStartOffset = startOfTask.getTime() - startOfRange.getTime();
        const taskEndOffset = endOfTask.getTime() - startOfRange.getTime();

        const totalWidth = columnsCount * columnWidth;
        const startPercent = taskStartOffset / totalTimeSpan;
        const endPercent = taskEndOffset / totalTimeSpan;

        left = Math.max(0, startPercent * totalWidth);
        width = Math.max(columnWidth, (endPercent - startPercent) * totalWidth);
      }

      return (
        <div
          className={`absolute top-1/2 h-6 rounded flex items-center text-xs text-white font-medium shadow-sm group gantt-task-bar ${
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
            transform: `translateY(-50%) ${isDragging ? 'scale(1.05)' : 'scale(1)'}`,
            zIndex: isDragging || isResizing ? 999 : 1,
            boxShadow: isDragging || isResizing ? '0 4px 12px rgba(0,0,0,0.3)' : undefined,
          }}
          title={t('task.taskTitle', '{{name}} - {{startDate}} to {{endDate}}', {
            name: task.name,
            startDate: tempDates.start?.toLocaleDateString() || t('common.noStart', 'No start'),
            endDate: tempDates.end?.toLocaleDateString() || t('common.noEnd', 'No end'),
          })}
        >
          {/* Left resize handle */}
          <div
            className="gantt-resize-handle left"
            onMouseDown={e => handleMouseDown(e, 'left')}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
            title={t('task.resizeStartDate', 'Resize start date')}
          >
            <div className="w-1 h-4 bg-white bg-opacity-60 rounded-sm opacity-20 group-hover:opacity-100 hover:opacity-100 transition-opacity" />
          </div>

          {/* Task content area - draggable */}
          <div
            className={`flex-1 flex items-center px-2 min-w-0 h-full ${
              isDragging ? 'cursor-move' : 'cursor-pointer hover:cursor-grab'
            }`}
            onMouseDown={e => handleMouseDown(e, 'drag')}
            onClick={e => {
              e.stopPropagation();
              // Only trigger click if we haven't dragged
              if (!hasDraggedRef.current && !isDragging && !isResizing && onTaskClick) {
                onTaskClick(task.id);
              }
            }}
            style={{ userSelect: 'none' }}
            title={t('task.dragToMove', 'Click to open task details, drag to move')}
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
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
            title={t('task.resizeEndDate', 'Resize end date')}
          >
            <div className="w-1 h-4 bg-white bg-opacity-60 rounded-sm opacity-20 group-hover:opacity-100 hover:opacity-100 transition-opacity" />
          </div>
        </div>
      );
    };

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

        // Set both start and end date based on view mode with 3-cell duration
        const startDate = new Date(clickedDate);
        startDate.setHours(0, 0, 0, 0); // Start of day

        const endDate = new Date(startDate);
        switch (viewMode) {
          case 'day':
            // For day view, span 3 days (3 cells)
            endDate.setDate(endDate.getDate() + 2); // +2 to make it 3 days inclusive
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'week':
            // For week view, span 3 weeks (3 cells)
            endDate.setDate(endDate.getDate() + 3 * 7 - 1); // 3 weeks minus 1 day for inclusive
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'month':
            // For month view, span 3 months (3 cells)
            endDate.setMonth(endDate.getMonth() + 3);
            endDate.setDate(endDate.getDate() - 1); // Make it inclusive
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'quarter':
            // For quarter view, span 3 quarters (3 cells)
            endDate.setMonth(endDate.getMonth() + 9); // 3 quarters = 9 months
            endDate.setDate(endDate.getDate() - 1);
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'year':
            // For year view, span 3 years (3 cells)
            endDate.setFullYear(endDate.getFullYear() + 3);
            endDate.setDate(endDate.getDate() - 1);
            endDate.setHours(23, 59, 59, 999);
            break;
          default:
            // Default to 3 days
            endDate.setDate(endDate.getDate() + 2);
            endDate.setHours(23, 59, 59, 999);
        }

        setTempDates({ start: startDate, end: endDate });
        onTaskDateUpdate(task.id, startDate, endDate);
      } else if (isPhase && onPhaseClick) {
        // When clicking on a phase bar, trigger the phase click handler
        onPhaseClick(task);
      } else if (!isPhase && onTaskClick) {
        // When clicking on a regular task bar, open the task drawer
        onTaskClick(task.id);
      }
    };

    return (
      <div
        className={`${isPhase ? 'min-h-[4.5rem]' : 'h-9'} relative border-b border-gray-100 dark:border-gray-700 transition-colors ${
          !isPhase
            ? '' // Removed hover background for tasks
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
      onTaskClick,
      containerRef,
      dateRange,
      phases,
      expandedTasks,
      animatingTasks,
      onCreateQuickTask,
      projectId,
      onRefresh,
    },
    ref
  ) => {
    const { t } = useTranslation('gantt');
    // Get timeline calculator from context
    const { timelineCalculator } = useGanttContext();
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

        // Disable the task creation popover on timeline clicks completely
        return;

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

        // Find the task to check if it's a phase
        const task = finalTasks.find(t => 'id' in t && t.id === taskId);
        if (task && 'type' in task && (task.type === 'milestone' || task.is_milestone)) {
          // Don't allow date updates for phases via this method
          console.warn('Attempted to update phase dates via task update method');
          return;
        }

        try {
          console.log('Updating task dates:', {
            taskId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          });

          await updateTaskDates({
            task_id: taskId,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          }).unwrap();

          console.log('Task dates updated successfully in database');
          message.success(t('task.datesUpdatedSuccessfully', 'Task dates updated successfully'));

          // Delay the refresh slightly to allow the UI to settle
          // This prevents the task bar from jumping back
          if (onRefresh) {
            setTimeout(() => {
              console.log('Calling manual refresh...');
              onRefresh();
            }, 100);
          }
        } catch (error) {
          console.error('Failed to update task dates:', error);
          message.error(t('task.failedToUpdateDates', 'Failed to update task dates'));
          // On error, refresh to revert to correct state
          if (onRefresh) {
            onRefresh();
          }
        }
      },
      [updateTaskDates, finalTasks, onRefresh, t]
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

                // Debug task dates
                if (isPhase) {
                  console.log(`Rendering phase bar for ${task.name}:`, {
                    start_date: task.start_date,
                    end_date: task.end_date,
                    task_id: task.id,
                  });
                }

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
                        columnsCount={effectiveColumnsCount}
                        dateRange={dateRange}
                        animationClass=""
                        onPhaseClick={isPhase ? onPhaseClick : undefined}
                        onTaskClick={!isPhase ? onTaskClick : undefined}
                        onTaskDateUpdate={handleTaskDateUpdate}
                        calculateDateFromPosition={calculateDateFromPosition}
                        timelineCalculator={timelineCalculator}
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
