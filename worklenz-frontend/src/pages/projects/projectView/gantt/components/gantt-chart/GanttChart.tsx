import React, {
  memo,
  useMemo,
  forwardRef,
  RefObject,
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react';
import ReactDOM from 'react-dom';
import { Input, Button, Empty, Spin, message, theme } from '@/shared/antd-imports';
import { RightOutlined, CloseOutlined } from '@ant-design/icons';
import { ITaskDependency, IDependencyType } from '@/types/tasks/task-dependency.types';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { taskDependenciesApiService } from '@/api/tasks/task-dependencies.api.service';
import { ITask } from '@/types/tasks/task.types';
import { GanttTask, GanttViewMode, GanttPhase } from '../../types/gantt-types';
import { useGanttContext } from '../../context/gantt-context';
import { useUpdateTaskDatesMutation } from '../../services/roadmap-api.service';
import { formatDateLocal } from '../../utils/date-utils';
import { useTranslation } from 'react-i18next';
import useTaskCreationPermission from '@/hooks/useTaskCreationPermission';
import { useAppSelector } from '@/hooks/useAppSelector';

const buildTaskMap = (tasks: GanttTask[]): Map<string, GanttTask> => {
  const taskMap = new Map<string, GanttTask>();
  const traverseTask = (task: GanttTask) => {
    if (taskMap.has(task.id)) return;
    taskMap.set(task.id, task);

    if (task.children) {
      task.children.forEach(child => traverseTask(child));
    }
    if (task.sub_tasks) {
      task.sub_tasks.forEach(child => traverseTask(child));
    }
  };

  tasks.forEach(task => traverseTask(task));
  return taskMap;
};

const hasDependencyPath = (
  taskMap: Map<string, GanttTask>,
  fromTaskId: string,
  toTaskId: string,
  visited = new Set<string>()
): boolean => {
  if (fromTaskId === toTaskId) {
    return true;
  }
  if (visited.has(fromTaskId)) {
    return false;
  }
  visited.add(fromTaskId);

  const task = taskMap.get(fromTaskId);
  if (!task || !task.dependencies) {
    return false;
  }

  for (const nextId of task.dependencies) {
    if (nextId === toTaskId) {
      return true;
    }
    if (hasDependencyPath(taskMap, nextId, toTaskId, visited)) {
      return true;
    }
  }

  return false;
};

const wouldCreateCircularDependency = (
  taskMap: Map<string, GanttTask>,
  sourceTaskId: string,
  targetTaskId: string
): boolean => {
  // Adding an edge from source -> target creates a cycle if target already reaches source.
  return hasDependencyPath(taskMap, targetTaskId, sourceTaskId);
};

interface DependencyLineSegment {
  dependencyId: string;
  sourceTaskId: string;
  targetTaskId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'finish_to_start';
}

interface PathPoint {
  x: number;
  y: number;
}

interface HoveredDependencyControl {
  line: DependencyLineSegment;
  mid: { x: number; y: number; angle: number };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Extra hit area around task bars so corner dependency connectors stay hoverable. */
const HOVER_CONTROL_SLOP = 22;
const TASK_BAR_HEIGHT_PX = 24;

interface DependencyPathResult {
  d: string;
  points: PathPoint[];
}

/** Build orthogonal dependency path with optional lane index for de-overlapping shared sources/targets. */
const buildDependencyPath = (
  startX: number,
  y1: number,
  endX: number,
  y2: number,
  laneIndex = 0,
  laneCount = 1
): DependencyPathResult => {
  const gapX = Math.abs(endX - startX);
  const isBackward = endX < startX;
  const LANE_X_STEP = 22;
  const LANE_MIDY_STEP = 14;
  const baseStepOut = Math.min(Math.max(24, gapX * 0.22), 80);
  const stepOutStart = baseStepOut + laneIndex * LANE_X_STEP;
  const reverseLane = laneCount > 1 ? laneCount - 1 - laneIndex : 0;
  const stepOutEnd = baseStepOut + reverseLane * (LANE_X_STEP * 0.65);
  const laneOffset = laneCount > 1 ? laneIndex - (laneCount - 1) / 2 : 0;

  const elbowX1 = isBackward ? startX - stepOutStart : startX + stepOutStart;
  const elbowX2 = isBackward ? endX + stepOutEnd : endX - stepOutEnd;

  if (Math.abs(y2 - y1) < 4) {
    const spreadY = laneOffset * 12;
    const points = [
      { x: startX, y: y1 + spreadY },
      { x: elbowX1, y: y1 + spreadY },
      { x: endX, y: y2 + spreadY },
    ];
    return {
      d: `M ${points[0].x} ${points[0].y} H ${elbowX1} H ${endX}`,
      points,
    };
  }

  const midY = (y1 + y2) / 2 + laneOffset * LANE_MIDY_STEP;

  const points = [
    { x: startX, y: y1 },
    { x: elbowX1, y: y1 },
    { x: elbowX1, y: midY },
    { x: elbowX2, y: midY },
    { x: elbowX2, y: y2 },
    { x: endX, y: y2 },
  ];

  return {
    d: `M ${startX} ${y1} H ${elbowX1} V ${midY} H ${elbowX2} V ${y2} H ${endX}`,
    points,
  };
};

/** Point at a given arc-length along a polyline, with tangent angle in degrees. */
const interpolateAlongPath = (
  points: PathPoint[],
  distance: number
): { x: number; y: number; angle: number } => {
  if (points.length === 0) {
    return { x: 0, y: 0, angle: 0 };
  }
  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y, angle: 0 };
  }

  let traveled = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length === 0) continue;

    if (traveled + length >= distance) {
      const t = (distance - traveled) / length;
      return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        angle: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
      };
    }
    traveled += length;
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    x: last.x,
    y: last.y,
    angle: (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI,
  };
};

const getPolylineLength = (points: PathPoint[]): number => {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return total;
};

/** Half-length along the path and half-height perpendicular — arrow is symmetric around mid. */
const DEPENDENCY_ARROW_LENGTH = 7;
const DEPENDENCY_ARROW_HEIGHT = 5;

/** Filled chevron aligned to the path tangent at the midpoint. */
const buildArrowPathAtMid = (mid: { x: number; y: number; angle: number }): string => {
  const rad = (mid.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const len = DEPENDENCY_ARROW_LENGTH;
  const h = DEPENDENCY_ARROW_HEIGHT;

  const tipX = mid.x + cos * len;
  const tipY = mid.y + sin * len;
  const backX = mid.x - cos * len;
  const backY = mid.y - sin * len;
  const perpX = -sin * h;
  const perpY = cos * h;

  const x1 = backX + perpX;
  const y1 = backY + perpY;
  const x2 = backX - perpX;
  const y2 = backY - perpY;

  return `M ${x1} ${y1} L ${tipX} ${tipY} L ${x2} ${y2} Z`;
};

/**
 * Invisible hit area around the midpoint arrow. Kept deliberately larger than the
 * visible chevron so the click target stays comfortable on dense roadmaps even
 * though the drawn arrow is small — the padding here restores the ~14x11 half-size
 * the hit path had before the arrow was slimmed down.
 */
const buildArrowHitPathAtMid = (mid: { x: number; y: number; angle: number }): string => {
  const rad = (mid.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const len = DEPENDENCY_ARROW_LENGTH + 7;
  const h = DEPENDENCY_ARROW_HEIGHT + 6;

  const tipX = mid.x + cos * len;
  const tipY = mid.y + sin * len;
  const backX = mid.x - cos * len;
  const backY = mid.y - sin * len;
  const perpX = -sin * h;
  const perpY = cos * h;

  return `M ${backX + perpX} ${backY + perpY} L ${tipX} ${tipY} L ${backX - perpX} ${backY - perpY} Z`;
};

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

// Shared 3-cell duration used by both the click-to-create handler and the hover-preview
// ghost bar, so the preview always matches what a click will actually commit.
const addThreeCellSpan = (startDate: Date, mode: GanttViewMode): Date => {
  const endDate = new Date(startDate);
  switch (mode) {
    case 'day':
    case 'week':
      // Week zoom ticks by individual day (same as Day, just zoomed further out) rather
      // than one column per week, so "3 cells" means 3 days here too.
      endDate.setDate(endDate.getDate() + 2);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'month':
      endDate.setMonth(endDate.getMonth() + 3);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'quarter':
      endDate.setMonth(endDate.getMonth() + 9);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'year':
      endDate.setFullYear(endDate.getFullYear() + 3);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      endDate.setDate(endDate.getDate() + 2);
      endDate.setHours(23, 59, 59, 999);
  }
  return endDate;
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
  onCreateQuickTask?: (
    taskName: string,
    phaseId?: string,
    startDate?: Date,
    endDate?: Date,
    parentTaskId?: string
  ) => void;
  projectId?: string;
  onRefresh?: () => void;
  isAllCollapsed?: boolean;
  onExpandedTasksChange?: (expanded: Set<string>) => void;
}

interface GridColumnProps {
  index: number;
  columnWidth: number;
  highlight?: 'today' | 'weekend' | 'alt' | null;
}

const GridColumn: React.FC<GridColumnProps> = memo(({ columnWidth, highlight }) => {
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const backgroundColor =
    highlight === 'today'
      ? `${token.colorPrimary}1F`
      : highlight === 'weekend' || highlight === 'alt'
        ? token.colorFillQuaternary
        : undefined;
  // A full-height vertical line per day column reads as much busier/heavier in dark
  // mode than the same token color does for a single border elsewhere, so dim it down
  // instead of using colorBorderSecondary at full strength.
  const borderColor = themeMode === 'dark' ? `${token.colorBorderSecondary}40` : token.colorBorderSecondary;

  return (
    <div
      className="flex-shrink-0 h-full"
      style={{
        width: `${columnWidth}px`,
        borderRight: `1px solid ${borderColor}`,
        backgroundColor,
      }}
    />
  );
});

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
  setHighlightedDateRange?: (range: { start: Date; end: Date } | null) => void;
  onDependencyDragStart?: (
    sourceTaskId: string,
    type: 'finish_to_start' | 'start_to_finish',
    startPoint: { x: number; y: number }
  ) => void;
  onDependencyDragMove?: (position: { x: number; y: number }) => void;
  onDependencyDragEnd?: () => void;
  canCreateTask?: boolean;
  dependencySourceTaskId?: string | null;
  dependencyTargetTaskId?: string | null;
  expandedTasks?: Set<string>;
  onExpandedTasksChange?: (expanded: Set<string>) => void;
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
    setHighlightedDateRange,
    onDependencyDragStart,
    onDependencyDragMove,
    onDependencyDragEnd,
    canCreateTask = true,
    dependencySourceTaskId,
    dependencyTargetTaskId,
    expandedTasks,
    onExpandedTasksChange,
  }) => {
    const { t } = useTranslation('gantt');
    const { token } = theme.useToken();
    const isPhase = task.type === 'milestone' || task.is_milestone;
    const subtasks = task.children ?? task.sub_tasks ?? [];
    const hasSubtasks = subtasks.length > 0;
    // Collapsed by default: a task's own id (and a phase's) must be explicitly present
    // in expandedTasks to be considered expanded — never assume expanded when the set
    // itself happens to be missing, so subtasks never show open on first render.
    const isExpanded = expandedTasks ? expandedTasks.has(task.id) : false;

    const handleToggleSubtasks = useCallback(() => {
      if (!onExpandedTasksChange) return;
      const next = new Set(expandedTasks || []);
      if (isExpanded) {
        next.delete(task.id);
      } else {
        next.add(task.id);
      }
      onExpandedTasksChange(next);
    }, [expandedTasks, isExpanded, onExpandedTasksChange, task.id]);

    const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isCreatingDependency, setIsCreatingDependency] = useState(false);
    // Drives the resize grip / dependency handle reveal directly from state rather
    // than a CSS :hover selector, so visibility can never get stuck on from a stray
    // cascade match — it is set/cleared only by this bar's own mouse events.
    const [isBarHovered, setIsBarHovered] = useState(false);
    const [dependencyDragType, setDependencyDragType] = useState<'finish_to_start' | 'start_to_finish' | null>(null);
    const [dependencyDragPosition, setDependencyDragPosition] = useState<{ x: number; y: number } | null>(null);
    const [tempDates, setTempDates] = useState<{ start: Date | null; end: Date | null }>({
      start: task.start_date,
      end: task.end_date,
    });
    const taskRowRef = useRef<HTMLDivElement>(null);
    const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
    const dragStartRef = useRef<{
      x: number;
      originalStart: Date | null;
      originalEnd: Date | null;
    }>({
      x: 0,
      originalStart: null,
      originalEnd: null,
    });
    const dependencyDragStartRef = useRef<{
      x: number;
      y: number;
      type: 'finish_to_start' | 'start_to_finish';
    } | null>(null);
    const isActiveRef = useRef(false);
    const hasDraggedRef = useRef(false); // Track if the user actually dragged

    // Calculate effective dates: prefer the task's own start/end dates, but
    // fall back to aggregated subtask dates only when the task itself has no dates.
    const effectiveStart = useMemo(() => {
      if (tempDates.start) {
        return tempDates.start;
      }

      if (subtasks && subtasks.length > 0) {
        let earliest: Date | null = null;
        subtasks.forEach(child => {
          if (child.start_date) {
            const childStart = new Date(child.start_date);
            if (!earliest || childStart < earliest) {
              earliest = childStart;
            }
          }
        });
        if (earliest) return earliest;
      }

      return null;
    }, [subtasks, tempDates.start]);

    const effectiveEnd = useMemo(() => {
      if (tempDates.end) {
        return tempDates.end;
      }

      if (subtasks && subtasks.length > 0) {
        let latest: Date | null = null;
        subtasks.forEach(child => {
          if (child.end_date) {
            const childEnd = new Date(child.end_date);
            if (!latest || childEnd > latest) {
              latest = childEnd;
            }
          }
        });
        if (latest) return latest;
      }

      return null;
    }, [subtasks, tempDates.end]);

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

    // Update task row position when popup is shown

    // Create stable refs for current values
    const currentStateRef = useRef({
      isResizing,
      isDragging,
      tempDates,
      dateRange,
      viewMode,
      columnWidth,
      timelineCalculator,
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
        timelineCalculator,
      };
    });

    const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isActiveRef.current || !currentStateRef.current.dateRange) return;

      const {
        isResizing: currentResize,
        isDragging: currentDrag,
        tempDates: currentTempDates,
        columnWidth: currentColumnWidth,
        timelineCalculator: currentCalculator,
      } = currentStateRef.current;

      const deltaX = e.clientX - dragStartRef.current.x;

      // Mark that we've actually dragged if movement is significant (more than 5 pixels)
      if (Math.abs(deltaX) > 5) {
        hasDraggedRef.current = true;
      }

      // Delta is always in whole days, at the timeline's real pixels-per-day rate —
      // matching Planner > Timeline's drag math exactly (`deltaDays =
      // Math.round(deltaX / pxPerDay)`), valid uniformly across every zoom level since
      // pxPerDay is the actual per-day rate regardless of what unit the columns tick by
      // (a day in Month view is still 1/daysInThatMonth of its column's width).
      const pxPerDay = currentCalculator ? currentCalculator.getPxPerDay() : currentColumnWidth;
      const deltaUnits = Math.round(deltaX / pxPerDay);

      if (currentResize === 'left' && dragStartRef.current.originalStart) {
        // Resizing from left - adjust start date
        const newStart = new Date(dragStartRef.current.originalStart);
        newStart.setDate(newStart.getDate() + deltaUnits);

        // Don't allow start to go past end
        if (currentTempDates.end && newStart < currentTempDates.end) {
          setTempDates(prev => ({ ...prev, start: newStart }));
          // Update highlighted range while resizing left edge
          if (setHighlightedDateRange) {
            setHighlightedDateRange({ start: newStart, end: currentTempDates.end });
          }
        }
      } else if (currentResize === 'right' && dragStartRef.current.originalEnd) {
        // Resizing from right - adjust end date
        const newEnd = new Date(dragStartRef.current.originalEnd);
        newEnd.setDate(newEnd.getDate() + deltaUnits);

        // Don't allow end to go before start
        if (currentTempDates.start && newEnd > currentTempDates.start) {
          setTempDates(prev => ({ ...prev, end: newEnd }));
          // Update highlighted range while resizing right edge
          if (setHighlightedDateRange) {
            setHighlightedDateRange({ start: currentTempDates.start, end: newEnd });
          }
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
        // Update highlighted range while dragging
        if (setHighlightedDateRange) {
          setHighlightedDateRange({ start: newStart, end: newEnd });
        }
      }
    }, [setHighlightedDateRange]);

    const handleMouseUp = useCallback(() => {
      if (!isActiveRef.current) return;

      isActiveRef.current = false;

      // Remove global event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Remove body classes
      document.body.classList.remove('gantt-dragging', 'gantt-resizing');

      // The bar's rendered position snaps to whole-day columns while the mouse moves in raw
      // pixels, so at the exact instant of mouseup the cursor can sit just off the (snapped)
      // bar - meaning the native click event that follows mouseup lands on the empty row
      // underneath instead of the bar itself, bypassing the bar's own stopPropagation/
      // hasDraggedRef guard entirely (that guard only ever runs if the click actually
      // targets the bar). handleRowClick lives in a different component scope and has no
      // access to this bar's hasDraggedRef, so mark the drop on document.body instead and
      // clear it via a real setTimeout - click is dispatched synchronously right after
      // mouseup (before any queued timeout), so the row's click handler still sees this
      // flag set, and can bail out instead of opening the "add task" input.
      if (hasDraggedRef.current) {
        document.body.classList.add('gantt-just-dragged');
        setTimeout(() => {
          document.body.classList.remove('gantt-just-dragged');
        }, 0);
      }

      // Clear highlighted range when drag ends
      if (setHighlightedDateRange) {
        setHighlightedDateRange(null);
      }

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
    }, [handleMouseMove, onTaskDateUpdate, task.id, task.start_date, task.end_date, setHighlightedDateRange]);

    const handleDependencyMouseMove = useCallback((e: MouseEvent) => {
      // Guard on the ref, not the isCreatingDependency STATE: these listeners are attached
      // to `document` from inside handleDependencyMouseDown in the same synchronous call
      // that fires setIsCreatingDependency(true), and state updates are async - so the
      // exact function instances passed to addEventListener stay closed over the OLD
      // (false) state forever, making a state-based guard here permanently false and
      // silently no-op every mousemove/mouseup for the whole drag. dependencyDragStartRef
      // is a plain ref, set synchronously in handleDependencyMouseDown before these
      // listeners are attached, so reading .current here always sees the live value.
      if (!dependencyDragStartRef.current) return;
      const nextPosition = { x: e.clientX, y: e.clientY };
      setDependencyDragPosition(nextPosition);
      onDependencyDragMove?.(nextPosition);
    }, [onDependencyDragMove]);

    const handleDependencyMouseUp = useCallback(() => {
      if (!dependencyDragStartRef.current) return;

      document.removeEventListener('mousemove', handleDependencyMouseMove);
      document.removeEventListener('mouseup', handleDependencyMouseUp);
      document.body.classList.remove('gantt-dependency-creating');

      setIsCreatingDependency(false);
      setDependencyDragType(null);
      setDependencyDragPosition(null);
      dependencyDragStartRef.current = null;
      onDependencyDragEnd?.();
    }, [handleDependencyMouseMove, onDependencyDragEnd]);

    const handleDependencyMouseDown = useCallback(
      (e: React.MouseEvent, type: 'finish_to_start' | 'start_to_finish') => {
        if (!canCreateTask) return;
        e.stopPropagation();
        e.preventDefault();

        const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const startX = targetRect.left + targetRect.width / 2;
        const startY = targetRect.top + targetRect.height / 2;

        setIsCreatingDependency(true);
        setDependencyDragType(type);
        setDependencyDragPosition({ x: e.clientX, y: e.clientY });
        dependencyDragStartRef.current = {
          x: startX,
          y: startY,
          type,
        };

        onDependencyDragStart?.(task.id, type, { x: startX, y: startY });

        document.body.classList.add('gantt-dependency-creating');
        document.addEventListener('mousemove', handleDependencyMouseMove);
        document.addEventListener('mouseup', handleDependencyMouseUp);
      },
      [canCreateTask, handleDependencyMouseMove, handleDependencyMouseUp, onDependencyDragStart, task.id]
    );

    // Cleanup effect to remove body classes and event listeners on unmount
    useEffect(() => {
      return () => {
        isActiveRef.current = false;
        document.body.classList.remove('gantt-dragging', 'gantt-resizing', 'gantt-dependency-creating');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mousemove', handleDependencyMouseMove);
        document.removeEventListener('mouseup', handleDependencyMouseUp);
      };
    }, [handleMouseMove, handleMouseUp, handleDependencyMouseMove, handleDependencyMouseUp]);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent, type: 'left' | 'right' | 'drag') => {
        if (!canCreateTask) return;
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
          originalStart: effectiveStart,
          originalEnd: effectiveEnd,
        };

        // Add global mouse event listeners
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      },
      [canCreateTask, effectiveStart, effectiveEnd, handleMouseMove, handleMouseUp]
    );

    const renderMilestone = () => {
      // Hide section header bars (status, priority groups) and phase bars - don't render their bars
      if (task.id.startsWith('status-') || task.id.startsWith('priority-') || task.type === 'milestone' || task.is_milestone) {
        return null;
      }

      if (!dateRange) return null;

      // Use actual task dates, not tempDates for phase rendering
      const actualStartDate = task.start_date;
      const actualEndDate = task.end_date;

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
            className="h-full rounded-lg flex items-center text-xs text-white font-bold shadow-lg border-2 relative overflow-hidden"
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
              {subtasks.length > 0 && (
                <div className="flex-shrink-0 ml-2 text-xs gantt-phase-progress">
                  {Math.round(
                    (subtasks.filter((child: any) => child.progress === 100).length /
                      subtasks.length) *
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
      if (!effectiveStart || !effectiveEnd) {
        // For guests without edit permissions, show a read-only placeholder bar
        if (!onTaskDateUpdate) {
          const getDurationText = () => {
            switch (viewMode) {
              case 'day':
              case 'week':
                return '3 days';
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
              {/* Guest-view placeholder: show task name and default duration hint */}
              <div
                className="px-2 py-1 mt-1 rounded bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis cursor-default"
                title={t('task.undatedTaskReadOnly', 'Task without dates (read-only for guests)', {
                  name: task.name,
                  duration: getDurationText()
                })}
              >
                {task.name} ({getDurationText()})
              </div>
            </div>
          );
        }

        const getDurationText = () => {
          switch (viewMode) {
            case 'day':
            case 'week':
              // Week zoom ticks by individual day, same as Day — not one column per week.
              return '3 days';
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
            {/* Hover preview — a single dashed rollover pill that tracks the mouse and
                carries its own label, matching the "+ Add Task" ghost's look/behavior
                (GanttChart.tsx's .gantt-row-create-ghost) instead of pairing a moving
                box with a separate static hint, so dateless and already-dated rows read
                the same way on hover. */}
            <div
              className="gantt-task-preview-tracker"
              title={t(
                'task.setTaskDateHint',
                'Click on timeline to set a {{duration}} date range for this task',
                { duration: getDurationText() }
              )}
              onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;

                // Calculate which column the mouse is over
                const columnIndex = Math.floor(x / columnWidth);

                // Always show exactly 3 cells width
                const previewWidth = 3 * columnWidth;

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
                  previewElement.style.opacity = '1';
                }

                // Sync the date-header highlight with the previewed span
                if (calculateDateFromPosition && setHighlightedDateRange) {
                  const previewStart = calculateDateFromPosition(previewLeft, columnWidth);
                  previewStart.setHours(0, 0, 0, 0);
                  const previewEnd = addThreeCellSpan(previewStart, viewMode);
                  setHighlightedDateRange({ start: previewStart, end: previewEnd });
                }
              }}
              onMouseLeave={e => {
                const previewElement = e.currentTarget.querySelector(
                  '.gantt-task-preview-bar'
                ) as HTMLElement;
                if (previewElement) {
                  previewElement.style.opacity = '0';
                }
                if (setHighlightedDateRange) {
                  setHighlightedDateRange(null);
                }
              }}
            >
              <div
                className="gantt-task-preview-bar absolute top-1/2 -translate-y-1/2 h-6 rounded flex items-center justify-center pointer-events-none whitespace-nowrap overflow-hidden transition-opacity duration-100"
                style={{
                  left: '0px',
                  width: '0px', // Will be set dynamically
                  opacity: 0,
                  border: `1.5px dashed ${token.colorPrimary}`,
                  background: token.colorPrimaryBg,
                  color: token.colorPrimary,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                + {t('task.setTaskDate', 'Set Task Dates')}
              </div>
            </div>
          </div>
        );
      }

      // Use unified timeline calculator for consistent positioning
      let left = 0;
      let width = columnWidth;

      if (timelineCalculator && effectiveStart && effectiveEnd) {
        const position = timelineCalculator.calculateTaskPosition(effectiveStart, effectiveEnd);

        if (position.isValid) {
          left = position.left;
          width = position.width;
        }
      } else {
        // Fallback to percentage-based positioning
        const startOfRange = new Date(dateRange.start);
        startOfRange.setHours(0, 0, 0, 0);

        const startOfTask = new Date(effectiveStart);
        startOfTask.setHours(0, 0, 0, 0);

        const endOfTask = new Date(effectiveEnd);
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

      const showHoverControls = isBarHovered || isCreatingDependency || isDragging || !!isResizing;
      const handlePointerEvents = showHoverControls ? 'auto' : 'none';
      const accentColor = token.colorPrimary;

      return (
        <div
          className={`gantt-task-bar-hover-zone${showHoverControls ? ' is-hovered' : ''}`}
          onMouseEnter={() => setIsBarHovered(true)}
          onMouseLeave={() => setIsBarHovered(false)}
          style={{
            position: 'absolute',
            top: '50%',
            left: `${left - HOVER_CONTROL_SLOP}px`,
            width: `${width + HOVER_CONTROL_SLOP * 2}px`,
            height: `${TASK_BAR_HEIGHT_PX + HOVER_CONTROL_SLOP * 2}px`,
            transform: 'translateY(-50%)',
            zIndex: isDragging || isResizing ? 999 : showHoverControls ? 50 : 1,
            ['--gantt-bar-accent' as string]: accentColor,
          }}
        >
          {/* Asana-style dependency connectors — on hover zone so they sit above adjacent rows */}
          <button
            type="button"
            className="gantt-dependency-connector gantt-dependency-connector--start"
            style={{
              opacity: showHoverControls ? 1 : 0,
              pointerEvents: handlePointerEvents,
              top: `${(TASK_BAR_HEIGHT_PX + HOVER_CONTROL_SLOP * 2) / 2 - TASK_BAR_HEIGHT_PX / 2 - 16}px`,
              left: `${HOVER_CONTROL_SLOP - 14}px`,
            }}
            onMouseDown={e => handleDependencyMouseDown(e, 'start_to_finish')}
            title={t('task.startToFinishDependency', 'Start-to-Finish dependency')}
            aria-label={t('task.startToFinishDependency', 'Start-to-Finish dependency')}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="gantt-dependency-connector-svg">
              <path
                d="M12 19V9H4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="4" cy="9" r="4" fill="currentColor" />
            </svg>
          </button>

          <button
            type="button"
            className="gantt-dependency-connector gantt-dependency-connector--end"
            style={{
              opacity: showHoverControls ? 1 : 0,
              pointerEvents: handlePointerEvents,
              bottom: `${(TASK_BAR_HEIGHT_PX + HOVER_CONTROL_SLOP * 2) / 2 - TASK_BAR_HEIGHT_PX / 2 - 16}px`,
              right: `${HOVER_CONTROL_SLOP - 14}px`,
            }}
            onMouseDown={e => handleDependencyMouseDown(e, 'finish_to_start')}
            title={t('task.finishToStartDependency', 'Finish-to-Start dependency')}
            aria-label={t('task.finishToStartDependency', 'Finish-to-Start dependency')}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="gantt-dependency-connector-svg">
              <path
                d="M16 9V19H24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="24" cy="19" r="4" fill="currentColor" />
            </svg>
          </button>

          <div
            className={`absolute top-1/2 h-6 flex items-stretch text-xs font-medium shadow-sm group gantt-task-bar ${
              showHoverControls ? 'gantt-task-bar--asana-hover' : 'rounded-sm'
            } ${
              isCreatingDependency
                ? 'dependency-creating cursor-crosshair'
                : isDragging
                  ? 'dragging cursor-move'
                  : isResizing
                    ? 'resizing'
                    : 'cursor-grab hover:cursor-grab'
            }`}
            style={{
              left: `${HOVER_CONTROL_SLOP}px`,
              width: `${width}px`,
              backgroundColor: showHoverControls ? token.colorBgContainer : task.color || '#6b7280',
              color: showHoverControls ? token.colorText : '#ffffff',
              border: showHoverControls ? `2px solid ${accentColor}` : undefined,
              opacity: isResizing || isDragging ? 0.8 : 1,
              transform: `translateY(-50%) ${isDragging ? 'scale(1.05)' : 'scale(1)'}`,
              boxShadow: isDragging || isResizing ? '0 4px 12px rgba(0,0,0,0.3)' : undefined,
              ['--gantt-bar-accent' as string]: accentColor,
            }}
            title={t('task.taskTitle', '{{name}} - {{startDate}} to {{endDate}}', {
              name: task.name,
              startDate: tempDates.start?.toLocaleDateString() || t('common.noStart', 'No start'),
              endDate: tempDates.end?.toLocaleDateString() || t('common.noEnd', 'No end'),
            })}
          >
          {/* Live date readout shown while dragging/resizing, matching Planner Timeline's drag tooltip */}
          {(isDragging || isResizing) && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: 6,
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 1000,
                background: token.colorBgElevated,
                color: token.colorText,
                boxShadow: token.boxShadowSecondary,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              {isResizing === 'left'
                ? tempDates.start?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : isResizing === 'right'
                  ? tempDates.end?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  : `${tempDates.start?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${tempDates.end?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </div>
          )}

          {/* Left resize cap — Asana-style blue end bar with grip lines */}
          <div
            className={`gantt-bar-resize-cap left ${showHoverControls ? 'is-visible' : ''}`}
            style={{ pointerEvents: handlePointerEvents }}
            onMouseDown={e => handleMouseDown(e, 'left')}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
            title={t('task.resizeStartDate', 'Resize start date')}
            role="separator"
            aria-orientation="vertical"
          >
            <span className="gantt-bar-resize-cap-grip" aria-hidden="true">
              <span />
              <span />
            </span>
          </div>

          {/* Fallback edge hit-zone when caps are hidden */}
          {!showHoverControls && (
            <div
              className="gantt-bar-resize-handle left"
              onMouseDown={e => handleMouseDown(e, 'left')}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
              }}
              title={t('task.resizeStartDate', 'Resize start date')}
            />
          )}

          {/* Task content area - draggable */}
          <div
            className={`flex-1 flex items-center px-2 min-w-0 h-full ${
              isDragging
                ? 'cursor-move'
                : canCreateTask
                  ? 'cursor-pointer hover:cursor-grab'
                  : 'cursor-pointer'
            }`}
            onMouseDown={canCreateTask ? e => handleMouseDown(e, 'drag') : undefined}
            onMouseEnter={() => {
              // Highlight dates when hovering over task
              if (setHighlightedDateRange && effectiveStart && effectiveEnd) {
                setHighlightedDateRange({ start: effectiveStart, end: effectiveEnd });
              }
            }}
            onMouseLeave={() => {
              // Clear highlighting when mouse leaves task (only if not dragging)
              if (!isDragging && !isResizing && setHighlightedDateRange) {
                setHighlightedDateRange(null);
              }
            }}
            onClick={e => {
              e.stopPropagation();
              // Only trigger click if we haven't actually dragged. `isDragging`/`isResizing`
              // are set true synchronously on mousedown (before we know whether a real drag
              // will happen) and are only cleared ~50ms after mouseup, so gating on them here
              // would block the click on every mousedown+mouseup with no movement at all.
              // hasDraggedRef is the accurate "did the pointer move" signal.
              if (!hasDraggedRef.current && onTaskClick) {
                onTaskClick(task.id);
              }
            }}
            style={{ userSelect: 'none' }}
            title={canCreateTask ? t('task.dragToMove', 'Click to open task details, drag to move') : undefined}
          >
            {/* Task name */}
            <div className="truncate flex-1 select-none flex items-center gap-2">
              {hasSubtasks ? (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleToggleSubtasks();
                  }}
                  className={`w-5 h-5 inline-flex items-center justify-center rounded transition-transform text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                  title={isExpanded ? t('task.collapseSubtasks', 'Collapse subtasks') : t('task.expandSubtasks', 'Expand subtasks')}
                  aria-label={isExpanded ? t('task.collapseSubtasks', 'Collapse subtasks') : t('task.expandSubtasks', 'Expand subtasks')}
                >
                  <RightOutlined className="text-[10px] pointer-events-none" />
                </button>
              ) : (
                <div className="w-5 h-5" />
              )}
              <span className="pointer-events-none">{task.name}</span>
            </div>
          </div>

          {/* Progress bar */}
          {task.progress > 0 && (
            <div
              className="absolute top-0 left-0 h-full bg-black bg-opacity-20 rounded pointer-events-none z-10"
              style={{ width: `${task.progress}%` }}
            />
          )}

          {/* Right resize cap */}
          <div
            className={`gantt-bar-resize-cap right ${showHoverControls ? 'is-visible' : ''}`}
            style={{ pointerEvents: handlePointerEvents }}
            onMouseDown={e => handleMouseDown(e, 'right')}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
            title={t('task.resizeEndDate', 'Resize end date')}
            role="separator"
            aria-orientation="vertical"
          >
            <span className="gantt-bar-resize-cap-grip" aria-hidden="true">
              <span />
              <span />
            </span>
          </div>

          {!showHoverControls && (
            <div
              className="gantt-bar-resize-handle right"
              onMouseDown={e => handleMouseDown(e, 'right')}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
              }}
              title={t('task.resizeEndDate', 'Resize end date')}
            />
          )}
        </div>
        </div>
      );
    };

    const dependencyLineOverlay =
      isCreatingDependency && dependencyDragStartRef.current && dependencyDragPosition
        ? ReactDOM.createPortal(
            <div className="gantt-dependency-line-overlay">
              <svg className="w-full h-full" viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`} preserveAspectRatio="none">
                {(() => {
                  const x1 = dependencyDragStartRef.current!.x;
                  const y1 = dependencyDragStartRef.current!.y;
                  const x2 = dependencyDragPosition.x;
                  const y2 = dependencyDragPosition.y;
                  const gapX = Math.abs(x2 - x1);
                  const cpOffset = Math.max(24, gapX * 0.4);
                  const isBackward = x2 < x1;
                  const cp1x = x1 + (isBackward ? -cpOffset : cpOffset);
                  const cp2x = x2 - (isBackward ? -cpOffset : cpOffset);
                  const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;

                  return (
                    <path
                      d={d}
                      stroke={token.colorPrimary}
                      strokeWidth={2}
                      strokeLinecap="round"
                      fill="none"
                      opacity={0.95}
                    />
                  );
                })()}
              </svg>
            </div>,
            document.body
          )
        : null;

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

        const endDate = addThreeCellSpan(startDate, viewMode);

        setTempDates({ start: startDate, end: endDate });
        onTaskDateUpdate(task.id, startDate, endDate);
      }
      // Removed phase click and task click handlers - no drawer opening
    };

    return (
      <>
        <div
          ref={taskRowRef}
          data-dependency-task-id={task.id}
          className={`h-12 relative border-b border-gray-100 dark:border-gray-700 transition-colors ${
            !isPhase
              ? '' // Removed hover background for tasks
              : '' // Removed cursor pointer for phases
          } ${animationClass} ${dependencyTargetTaskId === task.id && dependencySourceTaskId !== task.id ? 'gantt-dependency-target' : ''}`}
          onClick={handleClick}
          style={{
            // Set lower z-index when no phase click handler so parent can receive clicks
            ...(isPhase && !onPhaseClick ? { position: 'relative', zIndex: 1 } : {}),
          }}
        >
          {isPhase ? renderMilestone() : renderTaskBar()}
        </div>
        
      </>
    );
  }
);

TaskBarRow.displayName = 'TaskBarRow';

// Per-section "Add Task" filler row on the timeline side — mirrors Planner > Timeline's
// undated-project placeholder row (TimelineProjectPlaceholderRow in PlannerTimelineView.tsx):
// hovering tracks the mouse and shows a dashed rollover ghost bar spanning a fixed span
// (3 cells, matching this file's own dateless-task hover preview), plus a whole-row tint;
// clicking opens the quick-add name popover for this row's phase/status section.
interface AddTaskTimelineRowProps {
  parentSectionId: string;
  columnWidth: number;
  canCreateTask: boolean;
  calculateDateFromPosition: (x: number, columnWidth: number) => Date;
  setHighlightedDateRange?: (range: { start: Date; end: Date } | null) => void;
  onOpenPopover: (e: React.MouseEvent<HTMLDivElement>, parentSectionId: string) => void;
  animationClass?: string;
}

const AddTaskTimelineRow: React.FC<AddTaskTimelineRowProps> = memo(
  ({
    parentSectionId,
    columnWidth,
    canCreateTask,
    calculateDateFromPosition,
    setHighlightedDateRange,
    onOpenPopover,
    animationClass = '',
  }) => {
    const { t } = useTranslation('gantt');
    const { token } = theme.useToken();
    const [hoverLeft, setHoverLeft] = useState<number | null>(null);
    const isClickable = canCreateTask;

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const columnIndex = Math.floor(x / columnWidth);
        const previewWidth = 3 * columnWidth;
        let left = columnIndex * columnWidth;
        if (left + previewWidth > rect.width) {
          left = Math.max(0, rect.width - previewWidth);
        }
        setHoverLeft(left);

        if (setHighlightedDateRange) {
          const previewStart = calculateDateFromPosition(left, columnWidth);
          previewStart.setHours(0, 0, 0, 0);
          const previewEnd = addThreeCellSpan(previewStart, 'day');
          setHighlightedDateRange({ start: previewStart, end: previewEnd });
        }
      },
      [columnWidth, calculateDateFromPosition, setHighlightedDateRange]
    );

    const handleMouseLeave = useCallback(() => {
      setHoverLeft(null);
      if (setHighlightedDateRange) {
        setHighlightedDateRange(null);
      }
    }, [setHighlightedDateRange]);

    return (
      <div
        className={`relative border-b border-gray-100 dark:border-gray-700 transition-colors ${animationClass}`}
        style={{
          // Inline height (not the h-12 utility class) to exactly match the inline
          // height:'3rem' used by every other row in this file (Parent Task Row,
          // Subtasks Rows) — guarantees an identical computed value with nothing that
          // could resolve differently between a class and an inline style.
          height: '3rem',
          cursor: isClickable ? 'pointer' : 'default',
          background: isClickable && hoverLeft !== null ? token.colorFillQuaternary : undefined,
        }}
        onMouseMove={isClickable ? handleMouseMove : undefined}
        onMouseLeave={isClickable ? handleMouseLeave : undefined}
        onClick={isClickable ? e => onOpenPopover(e, parentSectionId) : undefined}
      >
        {isClickable && hoverLeft !== null && (
          <div
            style={{
              position: 'absolute',
              left: hoverLeft,
              width: 3 * columnWidth,
              top: '50%',
              transform: 'translateY(-50%)',
              height: 24,
              borderRadius: 4,
              border: `1.5px dashed ${token.colorPrimary}`,
              background: token.colorPrimaryBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: token.colorPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            + {t('task.addTask', 'Add Task')}
          </div>
        )}
      </div>
    );
  }
);

AddTaskTimelineRow.displayName = 'AddTaskTimelineRow';

// Task Creation Popover Component
const TaskCreationPopover: React.FC<{
  taskPopover: {
    taskName: string;
    date: Date;
    phaseId: string | null;
    isSubtask?: boolean;
    position: { x: number; y: number };
    visible: boolean;
  };
  showUnscheduledTasks: boolean;
  unscheduledTasks: ITask[];
  unscheduledTasksLoading: boolean;
  unscheduledTasksError: string | null;
  onTaskNameChange: (name: string) => void;
  onCreateTask: () => void;
  onCancel: () => void;
  onToggleUnscheduledTasks: () => void;
  onSelectUnscheduledTask: (taskId: string) => void;
}> = ({
  taskPopover,
  showUnscheduledTasks,
  unscheduledTasks,
  unscheduledTasksLoading,
  unscheduledTasksError,
  onTaskNameChange,
  onCreateTask,
  onCancel,
  onToggleUnscheduledTasks,
  onSelectUnscheduledTask,
}) => {
  const { t } = useTranslation('gantt');

  if (!taskPopover.visible) {
    return null;
  }

  return ReactDOM.createPortal(
    <>
      {/* Click outside overlay to close popover */}
      <div className="fixed inset-0 z-[9999] bg-black/5" onClick={onCancel} />

      {/* Popover - the input itself IS the box (no separate padded card wrapper
          around it), so its own border/focus ring fills the full width and height
          of the popover instead of sitting as a smaller control inside a bigger box. */}
      <div
        className="fixed z-[10000]"
        style={{
          left: `${taskPopover.position.x - 100}px`,
          top: `${taskPopover.position.y - 30}px`,
        }}
      >
        <Input
          value={taskPopover.taskName}
          onChange={e => onTaskNameChange(e.target.value)}
          maxLength={250}
          onPressEnter={onCreateTask}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              onCancel();
            }
          }}
          placeholder={
            taskPopover.isSubtask
              ? t('task.writeSubtaskName', 'Write a subtask name')
              : t('task.writeTaskName', 'Write a task name')
          }
          autoFocus
          style={{ width: 220, height: 36, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
        />
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
      dateRange,
      phases,
      expandedTasks,
      animatingTasks,
      onCreateQuickTask,
      projectId,
      onRefresh,
      isAllCollapsed = false,
      onExpandedTasksChange,
    },
    ref
  ) => {
    const { t } = useTranslation('gantt');
    const { token } = theme.useToken();
    const { canCreateTask } = useTaskCreationPermission();
    // Get timeline calculator, grouping mode, highlighted date range, and shouldScroll from context
    const contextValue = useGanttContext();
    const { timelineCalculator, groupingMode, setHighlightedDateRange, shouldScroll } = contextValue;
    const totalWidth = timelineCalculator ? timelineCalculator.getTotalWidth() : 0;
    // State for popover task creation
    const [taskPopover, setTaskPopover] = useState<{
      taskName: string;
      date: Date;
      phaseId: string | null;
      statusId?: string;
      parentTaskId?: string;
      isSubtask?: boolean;
      position: { x: number; y: number };
      visible: boolean;
    } | null>(null);
    // Tracks dates set on a previously-dateless task/subtask optimistically, the moment
    // the user clicks to set them — mirrors TaskBarRow's own local `tempDates` so the
    // row-level "+ Add Task" rollover ghost (computed from the `tasks` prop, which only
    // catches up after the update mutation round-trips and onRefresh() re-fetches) can
    // treat the row as dated immediately instead of waiting on that round-trip.
    const [pendingTaskDates, setPendingTaskDates] = useState<Map<string, { start: Date; end: Date }>>(
      new Map()
    );
    const [showUnscheduledTasks, setShowUnscheduledTasks] = useState(false);
    const [unscheduledTasks, setUnscheduledTasks] = useState<ITask[]>([]);
    const [unscheduledTasksLoading, setUnscheduledTasksLoading] = useState(false);
    const [unscheduledTasksError, setUnscheduledTasksError] = useState<string | null>(null);
    const [dependencySourceTaskId, setDependencySourceTaskId] = useState<string | null>(null);
    const [dependencyTargetTaskId, setDependencyTargetTaskId] = useState<string | null>(null);
    const [dependencyDragStartPoint, setDependencyDragStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [dependencyDragPosition, setDependencyDragPosition] = useState<{ x: number; y: number } | null>(null);
    const [dependencyDragType, setDependencyDragType] = useState<'finish_to_start' | 'start_to_finish' | null>(null);
    const [isCreatingDependency, setIsCreatingDependency] = useState(false);
    const [dependencyLines, setDependencyLines] = useState<DependencyLineSegment[]>([]);
    const [removedDependencyIds, setRemovedDependencyIds] = useState<Set<string>>(new Set());
    const [hoveredDependencyControl, setHoveredDependencyControl] = useState<HoveredDependencyControl | null>(null);
    const [isDeletingDependency, setIsDeletingDependency] = useState(false);
    const dependencyHoverClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dependencySourceTaskIdRef = useRef<string | null>(null);
    const dependencyTargetTaskIdRef = useRef<string | null>(null);
    const dependencyDragPositionRef = useRef<{ x: number; y: number } | null>(null);
    const taskMap = useMemo(() => buildTaskMap(tasks), [tasks]);
    const chartContainerRef = useRef<HTMLDivElement | null>(null);
    const setChartContainerRef = useCallback(
      (node: HTMLDivElement | null) => {
        chartContainerRef.current = node;
        if (!ref) return;

        if (typeof ref === 'function') {
          ref(node);
        } else {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref]
    );

    const isMissingDate = useCallback((value: unknown) => {
      if (value === null || value === undefined) {
        return true;
      }
      if (value instanceof Date) {
        return Number.isNaN(value.getTime());
      }
      if (typeof value !== 'string') {
        return false;
      }
      const normalized = value.trim().toLowerCase();
      return (
        normalized === '' ||
        normalized === 'null' ||
        normalized === 'undefined' ||
        normalized === '0000-00-00' ||
        normalized === '0000-00-00t00:00:00' ||
        normalized === '0000-00-00t00:00:00z'
      );
    }, []);

    const getTaskDateValue = useCallback((task: Partial<ITask> & { startDate?: unknown; endDate?: unknown; dueDate?: unknown }, type: 'start' | 'end') => {
      const candidateKeys = type === 'start' ? ['start_date', 'startDate'] : ['end_date', 'dueDate', 'endDate'];
      for (const key of candidateKeys) {
        const value = task[key as keyof typeof task];
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
      return undefined;
    }, []);

    const fetchUnscheduledTasks = useCallback(async () => {
      if (!projectId) {
        setUnscheduledTasks([]);
        setUnscheduledTasksError('Project is not selected');
        return;
      }

      setUnscheduledTasksLoading(true);
      setUnscheduledTasksError(null);

      try {
        const response = await tasksApiService.getTaskListV3({
          id: projectId,
          field: null,
          order: null,
          search: null,
          statuses: null,
          members: null,
          projects: null,
          isSubtasksInclude: false,
        });

        const allTasks: ITask[] = response.body?.allTasks || [];
        const unscheduled = allTasks.filter(task => {
          const startValue = getTaskDateValue(task as Partial<ITask> & { startDate?: unknown; endDate?: unknown; dueDate?: unknown }, 'start');
          const endValue = getTaskDateValue(task as Partial<ITask> & { startDate?: unknown; endDate?: unknown; dueDate?: unknown }, 'end');
          return isMissingDate(startValue) && isMissingDate(endValue);
        });

        setUnscheduledTasks(unscheduled);
      } catch (error) {
        console.error('Failed to load unscheduled tasks', error);
        setUnscheduledTasksError('Failed to load unscheduled tasks');
      } finally {
        setUnscheduledTasksLoading(false);
      }
    }, [projectId, isMissingDate]);

    useEffect(() => {
      if (showUnscheduledTasks) {
        fetchUnscheduledTasks();
      }
    }, [showUnscheduledTasks, fetchUnscheduledTasks]);

    const handleDependencyDragStart = useCallback(
      (
        sourceTaskId: string,
        type: 'finish_to_start' | 'start_to_finish',
        startPoint: { x: number; y: number }
      ) => {
        dependencySourceTaskIdRef.current = sourceTaskId;
        dependencyTargetTaskIdRef.current = null;
        dependencyDragPositionRef.current = startPoint;
        setDependencySourceTaskId(sourceTaskId);
        setDependencyDragType(type);
        setDependencyDragStartPoint(startPoint);
        setDependencyDragPosition(startPoint);
        setDependencyTargetTaskId(null);
      },
      []
    );

    const handleDependencyDragMove = useCallback((position: { x: number; y: number }) => {
      dependencyDragPositionRef.current = position;
      setDependencyDragPosition(position);

      const element = document.elementFromPoint(position.x, position.y) as HTMLElement | null;
      const rowElement = element?.closest('[data-dependency-task-id]') as HTMLElement | null;
      const targetId = rowElement?.dataset?.dependencyTaskId || null;
      const sourceId = dependencySourceTaskIdRef.current;
      const resolvedTargetId = targetId && targetId !== sourceId ? targetId : null;

      dependencyTargetTaskIdRef.current = resolvedTargetId;
      setDependencyTargetTaskId(resolvedTargetId);
    }, []);

    const validateDependencySelection = useCallback(
      (sourceTaskId: string | null, targetTaskId: string | null) => {
        if (!sourceTaskId || !targetTaskId) {
          return { isValid: false, shouldCreate: false };
        }

        if (sourceTaskId === targetTaskId) {
          return { isValid: false, shouldCreate: false };
        }

        if (wouldCreateCircularDependency(taskMap, sourceTaskId, targetTaskId)) {
          return { isValid: false, shouldCreate: false };
        }

        return { isValid: true, shouldCreate: true };
      },
      [taskMap]
    );

    const handleDependencyDragEnd = useCallback(async () => {
      const sourceTaskId = dependencySourceTaskIdRef.current;
      const targetTaskId = dependencyTargetTaskIdRef.current;
      const lastDragPosition = dependencyDragPositionRef.current;
      let resolvedTargetTaskId = targetTaskId;
      let invalidDependency = false;
      let shouldCreateDependency = false;

      if (sourceTaskId && !resolvedTargetTaskId && lastDragPosition) {
        const element = document.elementFromPoint(lastDragPosition.x, lastDragPosition.y) as HTMLElement | null;
        const rowElement = element?.closest('[data-dependency-task-id]') as HTMLElement | null;
        const rawTargetTaskId = rowElement?.dataset?.dependencyTaskId || null;

        if (rawTargetTaskId) {
          resolvedTargetTaskId = rawTargetTaskId;
        }
      }

      if (sourceTaskId && resolvedTargetTaskId) {
        const validation = validateDependencySelection(sourceTaskId, resolvedTargetTaskId);
        shouldCreateDependency = validation.shouldCreate;
        invalidDependency = !validation.isValid;
      } else if (sourceTaskId && lastDragPosition) {
        const element = document.elementFromPoint(lastDragPosition.x, lastDragPosition.y) as HTMLElement | null;
        const rowElement = element?.closest('[data-dependency-task-id]') as HTMLElement | null;
        const rawTargetTaskId = rowElement?.dataset?.dependencyTaskId || null;

        if (rawTargetTaskId && rawTargetTaskId === sourceTaskId) {
          invalidDependency = true;
        }
      }

      if (invalidDependency) {
        message.error(t('task.circularDependencyError', 'This would create a circular dependency.'));
        dependencySourceTaskIdRef.current = null;
        dependencyTargetTaskIdRef.current = null;
        dependencyDragPositionRef.current = null;
        setDependencySourceTaskId(null);
        setDependencyTargetTaskId(null);
        setDependencyDragType(null);
        setDependencyDragStartPoint(null);
        setDependencyDragPosition(null);
        return;
      }

      if (shouldCreateDependency && sourceTaskId && resolvedTargetTaskId) {
        setIsCreatingDependency(true);
        try {
          const body: ITaskDependency = {
            task_id: sourceTaskId,
            related_task_id: resolvedTargetTaskId,
            dependency_type: IDependencyType.BLOCKED_BY,
          };
          const res = await taskDependenciesApiService.createTaskDependency(body);
          if (res.done) {
            message.success(t('task.dependencyCreatedSuccessfully', 'Dependency created successfully.'));
            if (onRefresh) {
              onRefresh();
            }
          } else {
            console.error('Failed to create dependency:', res);
            message.error(t('task.failedToCreateDependency', 'Failed to create dependency.'));
          }
        } catch (error) {
          console.error('Failed to create dependency:', error);
          message.error(t('task.failedToCreateDependency', 'Failed to create dependency.'));
        } finally {
          setIsCreatingDependency(false);
        }
      }

      dependencySourceTaskIdRef.current = null;
      dependencyTargetTaskIdRef.current = null;
      dependencyDragPositionRef.current = null;
      setDependencySourceTaskId(null);
      setDependencyTargetTaskId(null);
      setDependencyDragType(null);
      setDependencyDragStartPoint(null);
      setDependencyDragPosition(null);
    }, [message, onRefresh, taskMap, t, validateDependencySelection]);

    // API mutation for updating task dates
    const [updateTaskDates, { isLoading: isUpdatingDates }] = useUpdateTaskDatesMutation();

    const computeDependencyLines = useCallback(() => {
      const chartEl = chartContainerRef.current;
      if (!chartEl) {
        setDependencyLines([]);
        return;
      }

      const containerRect = chartEl.getBoundingClientRect();
      const rows = Array.from(
        chartEl.querySelectorAll<HTMLElement>('[data-dependency-task-id]')
      );
      const positions = new Map<
        string,
        { left: number; right: number; centerY: number }
      >();

      rows.forEach(row => {
        const taskId = row.dataset.dependencyTaskId;
        if (!taskId) return;

        const barElement = row.querySelector<HTMLElement>('.gantt-task-bar, .gantt-phase-bar');
        if (!barElement) return;

        const barRect = barElement.getBoundingClientRect();
        positions.set(taskId, {
          left: barRect.left - containerRect.left,
          right: barRect.right - containerRect.left,
          centerY: barRect.top - containerRect.top + barRect.height / 2,
        });
      });

      const segments: DependencyLineSegment[] = [];
      const seenDependencyIds = new Set<string>();
      const getDependenciesForTask = (task: GanttTask) => {
        return (
          task.dependencyRecords?.length
            ? task.dependencyRecords
            : task.dependencies?.map(depId => ({
                id: `${task.id}-${depId}`,
                task_id: task.id,
                related_task_id: depId,
                dependency_type: 'blocked_by' as any,
              })) || []
        );
      };

      const traverseTask = (task: GanttTask) => {
        const dependencies = getDependenciesForTask(task);

        if (dependencies.length > 0) {
          const source = positions.get(task.id);
          if (source) {
            dependencies.forEach(dep => {
              const dependencyId = dep.id;
              if (!dependencyId || !UUID_REGEX.test(dependencyId)) return;
              if (removedDependencyIds.has(dependencyId) || seenDependencyIds.has(dependencyId)) return;
              const target = positions.get(dep.related_task_id);
              if (!target) return;
              seenDependencyIds.add(dependencyId);
              const isBackward = target.left < source.left;
              segments.push({
                dependencyId,
                sourceTaskId: task.id,
                targetTaskId: dep.related_task_id,
                x1: isBackward ? source.left : source.right,
                y1: source.centerY,
                x2: isBackward ? target.right : target.left,
                y2: target.centerY,
                type: 'finish_to_start',
              });
            });
          }
        }

        if (task.children) {
          task.children.forEach(traverseTask);
        }
        if (task.sub_tasks) {
          task.sub_tasks.forEach(traverseTask);
        }
      };

      tasks.forEach(traverseTask);
      setDependencyLines(segments);
    }, [tasks, removedDependencyIds]);

    useLayoutEffect(() => {
      const chartEl = chartContainerRef.current;
      if (!chartEl || !timelineCalculator || totalWidth === 0) {
        setDependencyLines([]);
        return;
      }

      let cancelled = false;
      let pendingRafId: number | null = null;

      const scheduleCompute = () => {
        if (cancelled) return;
        if (pendingRafId !== null) cancelAnimationFrame(pendingRafId);
        pendingRafId = requestAnimationFrame(() => {
          pendingRafId = null;
          if (cancelled) return;
          computeDependencyLines();
          // Second frame catches post-paint layout (container width measure, pxPerDay stretch, slide-in).
          requestAnimationFrame(() => {
            if (!cancelled) computeDependencyLines();
          });
        });
      };

      scheduleCompute();

      const resizeObserver = new ResizeObserver(() => {
        scheduleCompute();
      });
      resizeObserver.observe(chartEl);

      // Watch for style attribute changes on task bars — this fires on every
      // mousemove during drag/resize (TaskBarRow updates its .gantt-task-bar's
      // left/width style via tempDates), so dependency lines track the bar in
      // real-time instead of only updating after the drag ends.
      const mutationObserver = new MutationObserver(mutations => {
        const hasBarStyleChange = mutations.some(m => {
          if (m.type !== 'attributes' || m.attributeName !== 'style') return false;
          const el = m.target as Element;
          return el.classList.contains('gantt-task-bar') || el.classList.contains('gantt-phase-bar');
        });
        if (!hasBarStyleChange) return;
        scheduleCompute();
      });
      mutationObserver.observe(chartEl, {
        attributes: true,
        attributeFilter: ['style'],
        subtree: true,
      });

      const handleAnimationEnd = (event: Event) => {
        const target = event.target as HTMLElement;
        if (target.classList?.contains('gantt-task-slide-in')) {
          scheduleCompute();
        }
      };
      chartEl.addEventListener('animationend', handleAnimationEnd);

      return () => {
        cancelled = true;
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        chartEl.removeEventListener('animationend', handleAnimationEnd);
        if (pendingRafId !== null) cancelAnimationFrame(pendingRafId);
      };
    }, [
      computeDependencyLines,
      tasks,
      dateRange,
      viewMode,
      groupingMode,
      expandedTasks,
      removedDependencyIds,
      timelineCalculator,
      totalWidth,
      animatingTasks,
    ]);

    useEffect(() => {
      return () => {
        if (dependencyHoverClearTimeoutRef.current) {
          clearTimeout(dependencyHoverClearTimeoutRef.current);
        }
      };
    }, []);

    const clearHoveredDependencyControl = useCallback(() => {
      if (dependencyHoverClearTimeoutRef.current) {
        clearTimeout(dependencyHoverClearTimeoutRef.current);
        dependencyHoverClearTimeoutRef.current = null;
      }
      setHoveredDependencyControl(null);
    }, []);

    const scheduleClearHoveredDependencyControl = useCallback(() => {
      if (dependencyHoverClearTimeoutRef.current) {
        clearTimeout(dependencyHoverClearTimeoutRef.current);
      }
      dependencyHoverClearTimeoutRef.current = setTimeout(() => {
        setHoveredDependencyControl(null);
        dependencyHoverClearTimeoutRef.current = null;
      }, 120);
    }, []);

    const handleDependencyLineMouseEnter = useCallback(
      (line: DependencyLineSegment, mid: { x: number; y: number; angle: number }) => {
        if (dependencyHoverClearTimeoutRef.current) {
          clearTimeout(dependencyHoverClearTimeoutRef.current);
          dependencyHoverClearTimeoutRef.current = null;
        }
        setHoveredDependencyControl({ line, mid });
      },
      []
    );

    const resolveDependencyId = useCallback(async (line: DependencyLineSegment): Promise<string | null> => {
      if (UUID_REGEX.test(line.dependencyId)) {
        return line.dependencyId;
      }

      try {
        const depsRes = await taskDependenciesApiService.getTaskDependencies(line.sourceTaskId);
        const match = depsRes.body?.find(dep => dep.related_task_id === line.targetTaskId);
        return match?.id ?? null;
      } catch (error) {
        console.error('Failed to resolve dependency id:', error);
        return null;
      }
    }, []);

    const handleRemoveDependency = useCallback(
      async (line: DependencyLineSegment) => {
        setIsDeletingDependency(true);
        try {
          const dependencyId = await resolveDependencyId(line);
          if (!dependencyId) {
            message.error(
              t('task.failedToRemoveDependency', { defaultValue: 'Failed to remove dependency.' })
            );
            return;
          }

          const res = await taskDependenciesApiService.deleteTaskDependency(dependencyId);
          if (res.done) {
            message.success(
              t('task.dependencyRemovedSuccessfully', {
                defaultValue: 'Dependency removed successfully.',
              })
            );
            setRemovedDependencyIds(prev => new Set(prev).add(dependencyId));
            clearHoveredDependencyControl();
            if (onRefresh) {
              onRefresh();
            }
          } else {
            message.error(
              t('task.failedToRemoveDependency', { defaultValue: 'Failed to remove dependency.' })
            );
          }
        } catch (error) {
          console.error('Failed to delete dependency:', error);
          message.error(
            t('task.failedToRemoveDependency', { defaultValue: 'Failed to remove dependency.' })
          );
        } finally {
          setIsDeletingDependency(false);
        }
      },
      [t, onRefresh, clearHoveredDependencyControl, resolveDependencyId]
    );

    const columnsCount = useMemo(() => {
      // Defer to the same timelineCalculator instance the header (GanttTimeline) reads its
      // columns from via getColumns() — that's the single source of truth for how many
      // columns exist, so the grid and header can never end up with a different count.
      if (timelineCalculator) {
        return timelineCalculator.getColumns().length;
      }

      // Default counts if no date range/calculator yet
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
    }, [viewMode, timelineCalculator]);

    // Calculate exact date from mouse position within the timeline — delegates to
    // timelineCalculator.pixelPositionToDate(), the same continuous
    // daysSinceRangeStart-times-pxPerDay formula used to position every column and task
    // bar, so a clicked/dragged pixel always maps back to exactly the date that pixel
    // visually sits on regardless of zoom level. The columnWidth parameter is kept only
    // for call-site compatibility (every caller already has it on hand); it's no longer
    // used internally now that the calculator owns pxPerDay itself.
    const calculateDateFromPosition = useCallback(
      (x: number, _columnWidth: number): Date => {
        if (!dateRange) return new Date();
        if (!timelineCalculator) return new Date(dateRange.start);

        const targetDate = timelineCalculator.pixelPositionToDate(x);
        if (isNaN(targetDate.getTime())) {
          return new Date(dateRange.start);
        }
        return targetDate;
      },
      [dateRange, timelineCalculator]
    );

    // totalWidth is derived once above from the shared timelineCalculator instance.
    const effectiveColumnsCount = columnsCount;

    // Representative single column width for features that don't need per-column
    // precision (the 3-cell hover/rollover preview span, drag-snap granularity) — Day/Week
    // columns are genuinely uniform so this is their exact width; Month's columns vary by
    // real day count, so this is an average. Grid lines and task bars never use this — they
    // read each column's own real width, or pxPerDay directly, from timelineCalculator.
    const actualColumnWidth = effectiveColumnsCount > 0 ? totalWidth / effectiveColumnsCount : 0;

    const gridColumns = useMemo(
      () => Array.from({ length: effectiveColumnsCount }).map((_, index) => index),
      [effectiveColumnsCount]
    );

    // Flatten tasks to match the same hierarchy as task list
    // This should be synchronized with the task list component's expand/collapse state
    const flattenedTasks = useMemo(() => {
      const result: Array<
        GanttTask | { id: string; isEmptyRow: boolean; isAddPhaseRow?: boolean; parentSectionId?: string }
      > = [];
      const processedIds = new Set<string>(); // Track processed task IDs to prevent duplicates

      // For Status/Priority/Phase views, tasks are flattened with parent references
      // Build a quick lookup for determining parent section of each task
      const taskParentMap = new Map<string, string>(); // taskId -> parentSectionId
      
      tasks.forEach(task => {
        const taskIsPhase = task.type === 'milestone' || task.is_milestone;
        
        if (!taskIsPhase) {
          // Determine parent section for non-phase tasks
          let parentId = '';
          
          // Priority view: parent_priority contains the priority NAME (e.g., "Critical")
          // Need to find the matching priority section ID (priority-{value})
          if ((task as any).parent_priority !== undefined) {
            // Search through tasks to find the priority group with matching name
            const priorityGroup = tasks.find(
              t => (t.type === 'milestone' || t.is_milestone) && t.priority === (task as any).parent_priority
            );
            if (priorityGroup) {
              parentId = priorityGroup.id; // Will be priority-${value}
            }
          }
          // Status view: parent_status_id is the status ID
          else if ((task as any).parent_status_id !== undefined) {
            parentId = `status-${(task as any).parent_status_id}`;
          }
          // Phase view: parent_phase_id is the phase ID
          else if ((task as any).parent_phase_id !== undefined) {
            const phaseId = (task as any).parent_phase_id;
            if (phaseId === null || phaseId === 'null') {
              parentId = 'phase-unmapped';
            } else {
              parentId = `phase-${phaseId}`;
            }
          }
          
          if (parentId) {
            taskParentMap.set(task.id, parentId);
          }
        }
      });

      const processTask = (task: GanttTask, level: number = 0) => {
        const isPhase = task.type === 'milestone' || task.is_milestone;
        
        // Determine section ID for expand/collapse state checking
        let sectionId = task.id;

        const isExpanded = expandedTasks ? expandedTasks.has(sectionId) : task.expanded !== false;

        // Avoid processing the same task multiple times
        if (processedIds.has(task.id)) {
          return;
        }
        processedIds.add(task.id);

        // For child tasks in Status/Priority/Phase views, check if parent is expanded
        const parentId = taskParentMap.get(task.id);
        if (parentId && expandedTasks && !expandedTasks.has(parentId)) {
          // This is a child task and its parent section is collapsed, skip it
          return;
        }

        // Set the correct level for nested tasks
        const taskWithLevel = { ...task, level };
        result.push(taskWithLevel);

        // Only show children if section is expanded (for phase view with hierarchical children)
        if (isPhase && isExpanded) {
          if (task.children && task.children.length > 0) {
            task.children.forEach(child => processTask(child, level + 1));
          }

          // Add a trailing "Add Task" row at the end of every expanded section, even
          // ones with no tasks yet — matching GanttTaskList.tsx's flattenTasks exactly
          // so the two panels stay aligned.
          const addTaskId = `add-task-${task.id}-timeline`;
          if (!processedIds.has(addTaskId)) {
            processedIds.add(addTaskId);
            result.push({ id: addTaskId, isEmptyRow: true, parentSectionId: task.id });
          }
        }
      };

      tasks.forEach(task => processTask(task, 0));

      // Add the "Add Phase" row at the end
      result.push({ id: 'add-phase-timeline', isEmptyRow: true, isAddPhaseRow: true });

      return result;
    }, [tasks, expandedTasks]);

    // Use flattenedTasks directly since we're using popover instead of inline rows
    const finalTasks = flattenedTasks;

    // Handle timeline click - defined after flattenedTasks. Enabled for Phase, Status,
    // and Priority views alike — clicking empty space anywhere within a section's
    // timeline content (not just the dedicated trailing "Add Task" row) creates a task
    // under that section.
    const handleTimelineClick = useCallback(
      (e: React.MouseEvent, rowIndex: number) => {
        if (!dateRange || !onCreateQuickTask) return;

        if (groupingMode !== 'status' && groupingMode !== 'phase' && groupingMode !== 'priority') {
          return;
        }

        const sectionPrefix =
          groupingMode === 'status' ? 'status-' : groupingMode === 'priority' ? 'priority-' : 'phase-';

        // Get the click position relative to the timeline
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;

        // Calculate which date was clicked based on column position
        const clickedDate = calculateDateFromPosition(x, actualColumnWidth);

        // Find which section this row belongs to (looking for the nearest section
        // header above with a matching id prefix)
        let sectionId: string | null = null;

        for (let i = rowIndex - 1; i >= 0; i--) {
          const prevTask = flattenedTasks[i];
          if (prevTask && 'id' in prevTask && typeof prevTask.id === 'string' && prevTask.id.startsWith(sectionPrefix)) {
            sectionId = prevTask.id;
            break;
          }
        }

        // Also check if this row itself is a section header
        const currentTask = finalTasks[rowIndex];
        if (currentTask && 'id' in currentTask && typeof currentTask.id === 'string' && currentTask.id.startsWith(sectionPrefix)) {
          sectionId = currentTask.id;
        }

        if (!sectionId) return;

        // If all rows are collapsed, don't allow any interaction (including highlighting)
        if (isAllCollapsed) {
          return;
        }

        // Same 3-cell span as addThreeCellSpan/the hover-preview ghost, so this
        // highlight matches the span handleCreateTask will actually create.
        const highlightStart = new Date(clickedDate);
        highlightStart.setHours(0, 0, 0, 0);

        const highlightEnd = addThreeCellSpan(highlightStart, viewMode);

        // Set highlighted date range in context
        const { setHighlightedDateRange } = contextValue;
        if (setHighlightedDateRange) {
          setHighlightedDateRange({ start: highlightStart, end: highlightEnd });
        }

        // Get the click position relative to the viewport for popover positioning
        const clickX = e.clientX;
        const clickY = e.clientY;

        const isStatusSection = groupingMode === 'status';
        const isUnmappedPhase = sectionId === 'phase-unmapped';
        const phaseId = isUnmappedPhase ? null : sectionId.replace('phase-', '');

        const newPopoverState: typeof taskPopover = {
          taskName: '',
          date: clickedDate,
          phaseId: isStatusSection ? null : phaseId,
          ...(isStatusSection ? { statusId: sectionId } : {}),
          position: { x: clickX, y: clickY },
          visible: true,
        };
        setTaskPopover(newPopoverState);
      },
      [dateRange, onCreateQuickTask, flattenedTasks, finalTasks, calculateDateFromPosition, actualColumnWidth, groupingMode, contextValue, isAllCollapsed, viewMode]
    );

    // Click handler for the dedicated per-section "Add Task" filler row (works across
    // every grouping mode — Phase, Status, and Priority — unlike handleTimelineClick
    // above which is a narrower click-anywhere-in-content variant) — opens the same
    // floating name-input popover, pinned at the clicked position, with the
    // phase/status/priority id derived from the section this row belongs to.
    const handleAddTaskRowClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>, parentSectionId: string) => {
        if (!dateRange || !onCreateQuickTask || !canCreateTask) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickedDate = calculateDateFromPosition(x, actualColumnWidth);

        const highlightStart = new Date(clickedDate);
        highlightStart.setHours(0, 0, 0, 0);
        // Same 3-cell span as addThreeCellSpan/the hover-preview ghost.
        const highlightEnd = addThreeCellSpan(highlightStart, viewMode);

        const { setHighlightedDateRange: setHighlight } = contextValue;
        if (setHighlight) {
          setHighlight({ start: highlightStart, end: highlightEnd });
        }

        const isStatusSection = parentSectionId.startsWith('status-');
        const isUnmappedPhase = parentSectionId === 'phase-unmapped';
        const phaseId = isUnmappedPhase ? null : parentSectionId.replace('phase-', '');

        setTaskPopover({
          taskName: '',
          date: clickedDate,
          phaseId: isStatusSection ? null : phaseId,
          ...(isStatusSection ? { statusId: parentSectionId } : {}),
          position: { x: e.clientX, y: e.clientY },
          visible: true,
        });
      },
      [dateRange, onCreateQuickTask, canCreateTask, calculateDateFromPosition, actualColumnWidth, contextValue, viewMode]
    );

    // Click handler for the rollover shown on an expanded task's subtask rows — creates
    // a sibling subtask under the same parent task (parentTaskId), instead of a top-level
    // task under a phase/status/priority section. Opens the identical name-input popover,
    // just flagged isSubtask so it shows "subtask" copy and forwards parentTaskId through.
    const handleAddSubtaskRowClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>, parentTaskId: string) => {
        if (!dateRange || !onCreateQuickTask || !canCreateTask) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickedDate = calculateDateFromPosition(x, actualColumnWidth);

        const highlightStart = new Date(clickedDate);
        highlightStart.setHours(0, 0, 0, 0);
        // Same 3-cell span as addThreeCellSpan/the hover-preview ghost.
        const highlightEnd = addThreeCellSpan(highlightStart, viewMode);

        const { setHighlightedDateRange: setHighlight } = contextValue;
        if (setHighlight) {
          setHighlight({ start: highlightStart, end: highlightEnd });
        }

        setTaskPopover({
          taskName: '',
          date: clickedDate,
          phaseId: null,
          parentTaskId,
          isSubtask: true,
          position: { x: e.clientX, y: e.clientY },
          visible: true,
        });
      },
      [dateRange, onCreateQuickTask, canCreateTask, calculateDateFromPosition, actualColumnWidth, contextValue, viewMode]
    );

    // Handle task creation
    const handleCreateTask = useCallback(() => {
      if (taskPopover && onCreateQuickTask && taskPopover.taskName.trim()) {
        // Same 3-cell span as the hover-preview ghost that led to this popover (see
        // addThreeCellSpan) — this used to hardcode its own +4/5-day span here, out of
        // sync with the 3-day ghost the user actually saw and clicked on.
        const startDate = new Date(taskPopover.date);
        startDate.setHours(0, 0, 0, 0);

        const endDate = addThreeCellSpan(startDate, viewMode);

        // For Status view, pass statusId as phaseId (the API will handle it appropriately)
        const parentId = taskPopover.statusId || taskPopover.phaseId;
        
        onCreateQuickTask(
          taskPopover.taskName.trim(),
          parentId || undefined,
          startDate,
          endDate,
          taskPopover.parentTaskId
        );
        setTaskPopover(null);
        setShowUnscheduledTasks(false);
        
        // Clear highlighted date range
        const { setHighlightedDateRange } = contextValue;
        if (setHighlightedDateRange) {
          setHighlightedDateRange(null);
        }
      }
    }, [taskPopover, onCreateQuickTask, contextValue, viewMode]);

    // Handle cancel
    const handleCancel = useCallback(() => {
      setTaskPopover(null);
      setShowUnscheduledTasks(false);
      
      // Clear highlighted date range
      const { setHighlightedDateRange } = contextValue;
      if (setHighlightedDateRange) {
        setHighlightedDateRange(null);
      }
    }, [contextValue]);

    const handleToggleUnscheduledTasks = useCallback(() => {
      setShowUnscheduledTasks(prev => !prev);
    }, []);

    const handleSelectUnscheduledTask = useCallback(
      async (taskId: string) => {
        const selectedTask = unscheduledTasks.find(task => task.id === taskId);

        if (!selectedTask) {
          message.error(t('task.unscheduledTaskNotFound', 'Unable to find the selected task.'));
          setTaskPopover(null);
          setShowUnscheduledTasks(false);
          return;
        }

        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 4);
        endDate.setHours(23, 59, 59, 999);

        try {
          await updateTaskDates({
            task_id: taskId,
            start_date: formatDateLocal(startDate),
            end_date: formatDateLocal(endDate),
          }).unwrap();

          message.success(
            t('task.taskAddedToRoadmap', 'Task added to the roadmap for the next 5 days.')
          );

          if (onRefresh) {
            setTimeout(() => {
              onRefresh();
            }, 100);
          }
        } catch (error) {
          console.error('Failed to add unscheduled task to roadmap', error);
          message.error(t('task.failedToAddTaskToRoadmap', 'Failed to add the task to the roadmap.'));
        }

        setTaskPopover(null);
        setShowUnscheduledTasks(false);
      },
      [unscheduledTasks, updateTaskDates, onRefresh, t]
    );

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

        // Record the new dates as pending immediately (before the round-trip below),
        // matching TaskBarRow's own optimistic `tempDates` — so a row that just went
        // from dateless to dated re-enables its "+ Add Task" rollover ghost right away
        // instead of waiting for the mutation + onRefresh() to catch up the `tasks` prop.
        setPendingTaskDates(prev => {
          const next = new Map(prev);
          next.set(taskId, { start: startDate, end: endDate });
          return next;
        });

        try {
          await updateTaskDates({
            task_id: taskId,
            start_date: formatDateLocal(startDate),
            end_date: formatDateLocal(endDate),
          }).unwrap();

          message.success(t('task.datesUpdatedSuccessfully', 'Task dates updated successfully'));

          // Delay the refresh slightly to allow the UI to settle
          // This prevents the task bar from jumping back
          if (onRefresh) {
            setTimeout(() => {
              onRefresh();
            }, 100);
          }
        } catch (error) {
          console.error('Failed to update task dates:', error);
          message.error(t('task.failedToUpdateDates', 'Failed to update task dates'));
          // Roll back the optimistic pending dates so the row reverts to dateless.
          setPendingTaskDates(prev => {
            const next = new Map(prev);
            next.delete(taskId);
            return next;
          });
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
          className={`flex-1 relative overflow-y-auto ${
            shouldScroll ? 'overflow-x-auto' : 'overflow-x-hidden'
          } gantt-chart-scroll`}
          style={{ backgroundColor: token.colorBgContainer }}
          onScroll={onScroll}
          onClick={() => clearHoveredDependencyControl()}
        >
          <div
            ref={setChartContainerRef}
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
              {/* Grid columns for timeline — each uses its own real width from
                  timelineCalculator (uniform for Day/Week's day-ticks, variable per real
                  month for Month), the same column list the header renders from, so the
                  grid can never drift out of alignment with it. */}
              {gridColumns.map(index => {
                const column = timelineCalculator ? timelineCalculator.getColumn(index) : null;
                const columnWidth = column ? column.width : actualColumnWidth;

                // Check if this column represents today, and (in Day/Week view) a real weekend
                let isToday = false;
                let isWeekend = false;
                if (column) {
                  const columnDate = new Date(column.date);
                  columnDate.setHours(0, 0, 0, 0);
                  const columnEndDate = new Date(column.endDate);
                  columnEndDate.setHours(23, 59, 59, 999);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  isToday = today.getTime() >= columnDate.getTime() && today.getTime() <= columnEndDate.getTime();
                  if (viewMode === 'day' || viewMode === 'week') {
                    const day = columnDate.getDay();
                    isWeekend = day === 0 || day === 6;
                  }
                }
                const isDayTick = viewMode === 'day' || viewMode === 'week';
                const highlight: 'today' | 'weekend' | 'alt' | null = isToday
                  ? 'today'
                  : isWeekend
                    ? 'weekend'
                    : !isDayTick && index % 2 === 1
                      ? 'alt'
                      : null;
                return (
                  <GridColumn
                    key={`grid-col-${index}`}
                    index={index}
                    columnWidth={columnWidth}
                    highlight={highlight}
                  />
                );
              })}
            </div>
            <div className="relative z-10">
              {finalTasks.map((item, index) => {
                if ('isEmptyRow' in item && item.isEmptyRow) {
                  // Check if this is the Add Phase row
                  if ('isAddPhaseRow' in item && item.isAddPhaseRow) {
                    return (
                      <div
                        key={item.id}
                        className="border-b border-gray-100 dark:border-gray-700"
                        style={{ height: '3rem' }}
                      />
                    );
                  }

                  // Regular add-task row - determine animation classes
                  const parentSectionId =
                    (item as any).parentSectionId ||
                    item.id.replace('add-task-', '').replace('-timeline', '');
                  const shouldAnimate = animatingTasks ? animatingTasks.has(parentSectionId) : false;
                  const staggerIndex = Math.min((index - 1) % 5, 4);
                  const animationClass = shouldAnimate
                    ? `gantt-task-slide-in gantt-task-stagger-${staggerIndex + 1}`
                    : '';

                  return (
                    <AddTaskTimelineRow
                      key={item.id}
                      parentSectionId={parentSectionId}
                      columnWidth={actualColumnWidth}
                      canCreateTask={canCreateTask}
                      calculateDateFromPosition={calculateDateFromPosition}
                      setHighlightedDateRange={contextValue.setHighlightedDateRange}
                      onOpenPopover={handleAddTaskRowClick}
                      animationClass={animationClass}
                    />
                  );
                }

                const task = item as GanttTask;
                const isPhase = task.type === 'milestone' || task.is_milestone;
                const subtasks = task.children ?? task.sub_tasks ?? [];
                const hasSubtasks = subtasks.length > 0;
                // Collapsed by default: a task's own id (and a phase's) must be explicitly present
    // in expandedTasks to be considered expanded — never assume expanded when the set
    // itself happens to be missing, so subtasks never show open on first render.
    const isExpanded = expandedTasks ? expandedTasks.has(task.id) : false;

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

                // Rollover "add task" ghost preview shown on hover for every row in this
                // section — including rows that already have their own timeline bar, not
                // just empty ones. It renders beneath the bar (lower z-index) so it's only
                // ever visible in the row's empty space, never overlapping the real bar.
                // Gated on the row's own task already having dates: a dateless task has no
                // bar to protect, so without this check the ghost would cover the whole row
                // and fight with that task's own "click timeline to add dates" placeholder
                // (rendered by TaskBarRow itself) instead of deferring to it. Falls back to
                // pendingTaskDates (set synchronously on click, before the update mutation
                // round-trips) so the ghost reappears immediately once a bar is created,
                // rather than waiting on the `tasks` prop to catch up via onRefresh().
                const pendingDates = pendingTaskDates.get(task.id);
                const effectiveTaskStart = task.start_date ?? pendingDates?.start ?? null;
                const effectiveTaskEnd = task.end_date ?? pendingDates?.end ?? null;
                const hasOwnDates = isPhase || (!!effectiveTaskStart && !!effectiveTaskEnd);
                const showCreateOverlay =
                  (groupingMode === 'phase' || groupingMode === 'status' || groupingMode === 'priority') &&
                  canCreateTask &&
                  hasOwnDates;

                // This row's own bar occupies [left, right] in pixels — the ghost/click-to-add
                // must never appear or fire on top of it, only in the row's empty space.
                // Phase/section header rows never render a bar (renderMilestone bails out for
                // them), so barRange stays null there and the whole row is treated as empty.
                let barRange: { left: number; right: number } | null = null;
                if (!isPhase && timelineCalculator && effectiveTaskStart && effectiveTaskEnd) {
                  const position = timelineCalculator.calculateTaskPosition(effectiveTaskStart, effectiveTaskEnd);
                  if (position?.isValid) {
                    barRange = { left: position.left, right: position.left + position.width };
                  }
                }

                const computeGhostRange = (clientX: number, rect: DOMRect) => {
                  const x = clientX - rect.left;
                  const columnIndex = Math.floor(x / actualColumnWidth);
                  const previewWidth = 3 * actualColumnWidth;
                  let left = columnIndex * actualColumnWidth;
                  if (left + previewWidth > rect.width) {
                    left = Math.max(0, rect.width - previewWidth);
                  }
                  return { left, right: left + previewWidth };
                };

                const overlapsBar = (range: { left: number; right: number }) =>
                  !!barRange && range.left < barRange.right && range.right > barRange.left;

                const handleRowHoverMove = (e: React.MouseEvent<HTMLDivElement>) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const range = computeGhostRange(e.clientX, rect);
                  const ghost = e.currentTarget.querySelector('.gantt-row-create-ghost') as HTMLElement | null;

                  if (overlapsBar(range)) {
                    if (ghost) ghost.style.opacity = '0';
                    if (setHighlightedDateRange) setHighlightedDateRange(null);
                    return;
                  }

                  if (ghost) {
                    ghost.style.left = `${range.left}px`;
                    ghost.style.width = `${range.right - range.left}px`;
                    ghost.style.opacity = '1';
                  }

                  const previewStart = calculateDateFromPosition(range.left, actualColumnWidth);
                  previewStart.setHours(0, 0, 0, 0);
                  const previewEnd = addThreeCellSpan(previewStart, viewMode);
                  if (setHighlightedDateRange) setHighlightedDateRange({ start: previewStart, end: previewEnd });
                };

                const handleRowHoverLeave = (e: React.MouseEvent<HTMLDivElement>) => {
                  const ghost = e.currentTarget.querySelector('.gantt-row-create-ghost') as HTMLElement | null;
                  if (ghost) {
                    ghost.style.opacity = '0';
                  }
                  if (setHighlightedDateRange) setHighlightedDateRange(null);
                };

                const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
                  // Swallow the click that trails a real drag/resize drop - see the
                  // 'gantt-just-dragged' comment in TaskBarRow's handleMouseUp for why this
                  // can't just be a hasDraggedRef check (that ref lives on the bar, not here).
                  if (document.body.classList.contains('gantt-just-dragged')) {
                    return;
                  }
                  if (barRange) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const range = computeGhostRange(e.clientX, rect);
                    if (overlapsBar(range)) return;
                  }
                  handleTimelineClick(e, index);
                };

                return (
                  <div key={item.id}>
                    {/* Parent Task Row — border-bottom hidden while an expanded phase row
                        blends into its first child, matching GanttTaskList.tsx's TaskRow
                        (`isExpanded && isPhase ? 'border-b-0' : ''`) exactly. */}
                    <div
                      key={item.id}
                      className={`gantt-timeline-task-row relative transition-colors border-b border-gray-100 dark:border-gray-700 ${
                        isPhase && isExpanded ? 'border-b-0' : ''
                      } ${isPhase ? 'cursor-pointer' : ''} ${animationClass}`}
                      onClick={showCreateOverlay ? handleRowClick : undefined}
                      onMouseMove={showCreateOverlay ? handleRowHoverMove : undefined}
                      onMouseLeave={showCreateOverlay ? handleRowHoverLeave : undefined}
                      style={{
                        height: '3rem',
                        zIndex: 10,
                        cursor: showCreateOverlay ? 'pointer' : undefined,
                      }}
                    >
                      {showCreateOverlay && (
                        <div
                          className="gantt-row-create-ghost absolute top-1/2 -translate-y-1/2 h-6 rounded flex items-center justify-center pointer-events-none whitespace-nowrap overflow-hidden"
                          style={{
                            left: 0,
                            width: 0,
                            opacity: 0,
                            border: `1.5px dashed ${token.colorPrimary}`,
                            background: token.colorPrimaryBg,
                            color: token.colorPrimary,
                            fontSize: 12,
                            fontWeight: 600,
                            transition: 'opacity 0.1s ease',
                            zIndex: 0,
                          }}
                        >
                          + {t('task.addTask', 'Add Task')}
                        </div>
                      )}
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
                          onTaskDateUpdate={canCreateTask ? handleTaskDateUpdate : undefined}
                          calculateDateFromPosition={calculateDateFromPosition}
                          timelineCalculator={timelineCalculator}
                          setHighlightedDateRange={setHighlightedDateRange}
                          canCreateTask={canCreateTask}
                          onDependencyDragStart={canCreateTask ? handleDependencyDragStart : undefined}
                          onDependencyDragMove={canCreateTask ? handleDependencyDragMove : undefined}
                          onDependencyDragEnd={canCreateTask ? handleDependencyDragEnd : undefined}
                          dependencySourceTaskId={dependencySourceTaskId}
                          dependencyTargetTaskId={dependencyTargetTaskId}
                          expandedTasks={expandedTasks}
                          onExpandedTasksChange={onExpandedTasksChange}
                        />
                      </div>
                    </div>

                    {/* Subtasks Rows — each gets the same hover rollover as a top-level
                        task row, except it creates a sibling subtask under this same
                        parent task (task.id) rather than a top-level task, and its
                        ghost reads "Add Subtask". */}
                    {!isPhase && hasSubtasks && isExpanded && (
                      <>
                        {subtasks.map((subtask: GanttTask) => {
                          // See pendingTaskDates above — same optimistic fallback so a
                          // just-dated subtask's row re-enables its ghost immediately.
                          const pendingSubtaskDates = pendingTaskDates.get(subtask.id);
                          const effectiveSubtaskStart =
                            subtask.start_date ?? pendingSubtaskDates?.start ?? null;
                          const effectiveSubtaskEnd =
                            subtask.end_date ?? pendingSubtaskDates?.end ?? null;
                          const showSubtaskCreateOverlay =
                            (groupingMode === 'phase' ||
                              groupingMode === 'status' ||
                              groupingMode === 'priority') &&
                            canCreateTask &&
                            !!effectiveSubtaskStart &&
                            !!effectiveSubtaskEnd;

                          let subtaskBarRange: { left: number; right: number } | null = null;
                          if (timelineCalculator && effectiveSubtaskStart && effectiveSubtaskEnd) {
                            const position = timelineCalculator.calculateTaskPosition(
                              effectiveSubtaskStart,
                              effectiveSubtaskEnd
                            );
                            if (position?.isValid) {
                              subtaskBarRange = {
                                left: position.left,
                                right: position.left + position.width,
                              };
                            }
                          }

                          const computeSubtaskGhostRange = (clientX: number, rect: DOMRect) => {
                            const x = clientX - rect.left;
                            const columnIndex = Math.floor(x / actualColumnWidth);
                            const previewWidth = 3 * actualColumnWidth;
                            let left = columnIndex * actualColumnWidth;
                            if (left + previewWidth > rect.width) {
                              left = Math.max(0, rect.width - previewWidth);
                            }
                            return { left, right: left + previewWidth };
                          };

                          const subtaskOverlapsBar = (range: { left: number; right: number }) =>
                            !!subtaskBarRange &&
                            range.left < subtaskBarRange.right &&
                            range.right > subtaskBarRange.left;

                          const handleSubtaskRowHoverMove = (e: React.MouseEvent<HTMLDivElement>) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const range = computeSubtaskGhostRange(e.clientX, rect);
                            const ghost = e.currentTarget.querySelector(
                              '.gantt-row-create-ghost'
                            ) as HTMLElement | null;

                            if (subtaskOverlapsBar(range)) {
                              if (ghost) ghost.style.opacity = '0';
                              if (setHighlightedDateRange) setHighlightedDateRange(null);
                              return;
                            }

                            if (ghost) {
                              ghost.style.left = `${range.left}px`;
                              ghost.style.width = `${range.right - range.left}px`;
                              ghost.style.opacity = '1';
                            }

                            const previewStart = calculateDateFromPosition(range.left, actualColumnWidth);
                            previewStart.setHours(0, 0, 0, 0);
                            const previewEnd = addThreeCellSpan(previewStart, viewMode);
                            if (setHighlightedDateRange) setHighlightedDateRange({ start: previewStart, end: previewEnd });
                          };

                          const handleSubtaskRowHoverLeave = (e: React.MouseEvent<HTMLDivElement>) => {
                            const ghost = e.currentTarget.querySelector(
                              '.gantt-row-create-ghost'
                            ) as HTMLElement | null;
                            if (ghost) ghost.style.opacity = '0';
                            if (setHighlightedDateRange) setHighlightedDateRange(null);
                          };

                          const handleSubtaskRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
                            if (subtaskBarRange) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const range = computeSubtaskGhostRange(e.clientX, rect);
                              if (subtaskOverlapsBar(range)) return;
                            }
                            handleAddSubtaskRowClick(e, task.id);
                          };

                          return (
                            <div
                              key={`subtask-${subtask.id}`}
                              className="relative transition-colors border-b border-gray-100 dark:border-gray-700"
                              onClick={showSubtaskCreateOverlay ? handleSubtaskRowClick : undefined}
                              onMouseMove={showSubtaskCreateOverlay ? handleSubtaskRowHoverMove : undefined}
                              onMouseLeave={showSubtaskCreateOverlay ? handleSubtaskRowHoverLeave : undefined}
                              style={{
                                height: '3rem',
                                zIndex: 9,
                                marginLeft: '20px',
                                opacity: 0.85,
                                cursor: showSubtaskCreateOverlay ? 'pointer' : undefined,
                              }}
                            >
                              {showSubtaskCreateOverlay && (
                                <div
                                  className="gantt-row-create-ghost absolute top-1/2 -translate-y-1/2 h-6 rounded flex items-center justify-center pointer-events-none whitespace-nowrap overflow-hidden"
                                  style={{
                                    left: 0,
                                    width: 0,
                                    opacity: 0,
                                    border: `1.5px dashed ${token.colorPrimary}`,
                                    background: token.colorPrimaryBg,
                                    color: token.colorPrimary,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    transition: 'opacity 0.1s ease',
                                    zIndex: 0,
                                  }}
                                >
                                  + {t('task.addSubtask', 'Add Subtask')}
                                </div>
                              )}
                              <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                                <TaskBarRow
                                  task={subtask}
                                  viewMode={viewMode}
                                  columnWidth={actualColumnWidth}
                                  columnsCount={effectiveColumnsCount}
                                  dateRange={dateRange}
                                  animationClass=""
                                  onPhaseClick={undefined}
                                  onTaskClick={onTaskClick}
                                  onTaskDateUpdate={canCreateTask ? handleTaskDateUpdate : undefined}
                                  calculateDateFromPosition={calculateDateFromPosition}
                                  timelineCalculator={timelineCalculator}
                                  setHighlightedDateRange={setHighlightedDateRange}
                                  canCreateTask={canCreateTask}
                                  onDependencyDragStart={canCreateTask ? handleDependencyDragStart : undefined}
                                  onDependencyDragMove={canCreateTask ? handleDependencyDragMove : undefined}
                                  onDependencyDragEnd={canCreateTask ? handleDependencyDragEnd : undefined}
                                  dependencySourceTaskId={dependencySourceTaskId}
                                  dependencyTargetTaskId={dependencyTargetTaskId}
                                  expandedTasks={expandedTasks}
                                  onExpandedTasksChange={onExpandedTasksChange}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
              {finalTasks.length === 0 && (
                <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
                  No tasks to display
                </div>
              )}
            </div>
            {/* Dependency lines render above row border-b lines (z-10 task rows) so
                horizontal grid borders don't cut through the connector and look like
                two separate segments. pointer-events:none on the shell — only paths
                capture clicks so task bars underneath stay interactive. */}
            <div className="gantt-dependency-lines-overlay">
              <svg width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                {(() => {
                  const sourceCounts = new Map<string, number>();
                  const targetCounts = new Map<string, number>();

                  dependencyLines.forEach(line => {
                    sourceCounts.set(line.sourceTaskId, (sourceCounts.get(line.sourceTaskId) || 0) + 1);
                    targetCounts.set(line.targetTaskId, (targetCounts.get(line.targetTaskId) || 0) + 1);
                  });

                  const sortedLines = [...dependencyLines].sort((a, b) => {
                    if (a.sourceTaskId !== b.sourceTaskId) {
                      return a.sourceTaskId.localeCompare(b.sourceTaskId);
                    }
                    if (a.y2 !== b.y2) {
                      return a.y2 - b.y2;
                    }
                    return a.targetTaskId.localeCompare(b.targetTaskId);
                  });

                  const sourceIndexMap = new Map<string, number>();
                  const targetIndexMap = new Map<string, number>();

                  return sortedLines.map((line, index) => {
                    const sourceGroupIndex = sourceIndexMap.get(line.sourceTaskId) || 0;
                    sourceIndexMap.set(line.sourceTaskId, sourceGroupIndex + 1);

                    const targetGroupIndex = targetIndexMap.get(line.targetTaskId) || 0;
                    targetIndexMap.set(line.targetTaskId, targetGroupIndex + 1);

                    const sourceCount = sourceCounts.get(line.sourceTaskId) || 1;
                    const targetCount = targetCounts.get(line.targetTaskId) || 1;
                    const offsetStep = 14;
                    const sourceOffset = (sourceGroupIndex - (sourceCount - 1) / 2) * offsetStep;
                    const targetOffset = (targetGroupIndex - (targetCount - 1) / 2) * offsetStep;

                    const startX = line.x1;
                    const endX = line.x2;
                    const y1 = line.y1 + sourceOffset;
                    const y2 = line.y2 + targetOffset;

                    const { d, points } = buildDependencyPath(
                      startX,
                      y1,
                      endX,
                      y2,
                      sourceGroupIndex,
                      sourceCount
                    );
                    const mid = interpolateAlongPath(points, getPolylineLength(points) / 2);
                    const arrowD = buildArrowPathAtMid(mid);
                    const arrowHitD = buildArrowHitPathAtMid(mid);
                    const isHovered = hoveredDependencyControl?.line.dependencyId === line.dependencyId;
                    const strokeColor = isHovered ? token.colorPrimaryActive : token.colorPrimary;

                    return (
                      <g
                        key={`dependency-line-${line.dependencyId}`}
                        className="gantt-dependency-line-group"
                        onMouseEnter={() => handleDependencyLineMouseEnter(line, mid)}
                        onMouseLeave={scheduleClearHoveredDependencyControl}
                      >
                        <path
                          d={d}
                          stroke={strokeColor}
                          strokeWidth={isHovered ? 2 : 1.5}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={isHovered ? 1 : 0.9}
                          className="gantt-dependency-line-path"
                        />
                        <path
                          d={arrowHitD}
                          fill="transparent"
                          stroke="none"
                          className="gantt-dependency-line-hit"
                        />
                        <path
                          d={arrowD}
                          fill={strokeColor}
                          stroke={strokeColor}
                          strokeWidth={0.5}
                          strokeLinejoin="round"
                          style={{ pointerEvents: 'none' }}
                        />
                      </g>
                    );
                  });
                })()}
              </svg>
              {hoveredDependencyControl && (
                <div
                  className="gantt-dependency-remove-control"
                  style={{
                    left: `${hoveredDependencyControl.mid.x}px`,
                    top: `${hoveredDependencyControl.mid.y}px`,
                  }}
                  onMouseEnter={() =>
                    handleDependencyLineMouseEnter(
                      hoveredDependencyControl.line,
                      hoveredDependencyControl.mid
                    )
                  }
                  onMouseLeave={scheduleClearHoveredDependencyControl}
                  onClick={e => e.stopPropagation()}
                >
                  <span className="gantt-dependency-remove-tooltip">
                    {t('task.removeDependencyTooltip', { defaultValue: 'Remove dependency' })}
                  </span>
                  <button
                    type="button"
                    className="gantt-dependency-remove-btn"
                    aria-label={t('task.removeDependencyTooltip', { defaultValue: 'Remove dependency' })}
                    disabled={isDeletingDependency}
                    onClick={() => handleRemoveDependency(hoveredDependencyControl.line)}
                  >
                    <CloseOutlined />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Creation Popover */}
        {taskPopover && taskPopover.visible && (
          <TaskCreationPopover
            taskPopover={taskPopover}
            showUnscheduledTasks={showUnscheduledTasks}
            unscheduledTasks={unscheduledTasks}
            unscheduledTasksLoading={unscheduledTasksLoading}
            unscheduledTasksError={unscheduledTasksError}
            onTaskNameChange={name =>
              setTaskPopover(prev => (prev ? { ...prev, taskName: name } : null))
            }
            onCreateTask={handleCreateTask}
            onCancel={handleCancel}
            onToggleUnscheduledTasks={handleToggleUnscheduledTasks}
            onSelectUnscheduledTask={handleSelectUnscheduledTask}
          />
        )}
      </>
    );
  }
);

GanttChart.displayName = 'GanttChart';

export default memo(GanttChart);
