import React, { useReducer, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { 
  GanttTask, 
  ColumnConfig, 
  TimelineConfig, 
  VirtualScrollConfig,
  ZoomLevel,
  GanttState,
  GanttAction,
  AdvancedGanttProps,
  SelectionState,
  GanttViewState,
  DragState
} from '../../types/advanced-gantt.types';
import GanttGrid from './GanttGrid';
import DraggableTaskBar from './DraggableTaskBar';
import TimelineMarkers, { holidayPresets, workingDayPresets } from './TimelineMarkers';
import VirtualScrollContainer, { VirtualTimeline } from './VirtualScrollContainer';
import { 
  usePerformanceMonitoring, 
  useTaskCalculations, 
  useDateCalculations,
  useDebounce,
  useThrottle
} from '../../utils/gantt-performance';
import { useAppSelector } from '../../hooks/useAppSelector';
import { themeWiseColor } from '../../utils/themeWiseColor';

// Default configurations
const defaultColumns: ColumnConfig[] = [
  { 
    field: 'name', 
    title: 'Task Name', 
    width: 250, 
    minWidth: 150, 
    resizable: true, 
    sortable: true, 
    fixed: true,
    editor: 'text'
  },
  { 
    field: 'startDate', 
    title: 'Start Date', 
    width: 120, 
    minWidth: 100, 
    resizable: true, 
    sortable: true, 
    fixed: true,
    editor: 'date'
  },
  { 
    field: 'endDate', 
    title: 'End Date', 
    width: 120, 
    minWidth: 100, 
    resizable: true, 
    sortable: true, 
    fixed: true,
    editor: 'date'
  },
  { 
    field: 'duration', 
    title: 'Duration', 
    width: 80, 
    minWidth: 60, 
    resizable: true, 
    sortable: false, 
    fixed: true 
  },
  { 
    field: 'progress', 
    title: 'Progress', 
    width: 100, 
    minWidth: 80, 
    resizable: true, 
    sortable: true, 
    fixed: true,
    editor: 'number'
  },
];

const defaultTimelineConfig: TimelineConfig = {
  topTier: { unit: 'month', format: 'MMM yyyy', height: 30 },
  bottomTier: { unit: 'day', format: 'dd', height: 25 },
  showWeekends: true,
  showNonWorkingDays: true,
  holidays: holidayPresets.US,
  workingDays: workingDayPresets.standard,
  workingHours: { start: 9, end: 17 },
  dayWidth: 30,
};

const defaultVirtualScrollConfig: VirtualScrollConfig = {
  enableRowVirtualization: true,
  enableTimelineVirtualization: true,
  bufferSize: 10,
  itemHeight: 40,
  overscan: 5,
};

const defaultZoomLevels: ZoomLevel[] = [
  { 
    name: 'Year', 
    dayWidth: 2, 
    scale: 0.1,
    topTier: { unit: 'year', format: 'yyyy' },
    bottomTier: { unit: 'month', format: 'MMM' }
  },
  { 
    name: 'Month', 
    dayWidth: 8, 
    scale: 0.5,
    topTier: { unit: 'month', format: 'MMM yyyy' },
    bottomTier: { unit: 'week', format: 'w' }
  },
  { 
    name: 'Week', 
    dayWidth: 25, 
    scale: 1,
    topTier: { unit: 'week', format: 'MMM dd' },
    bottomTier: { unit: 'day', format: 'dd' }
  },
  { 
    name: 'Day', 
    dayWidth: 50, 
    scale: 2,
    topTier: { unit: 'day', format: 'MMM dd' },
    bottomTier: { unit: 'hour', format: 'HH' }
  },
];

// Gantt state reducer
function ganttReducer(state: GanttState, action: GanttAction): GanttState {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload };
    
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id
            ? { ...task, ...action.payload.updates }
            : task
        ),
      };
    
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };
    
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload),
      };
    
    case 'SET_SELECTION':
      return {
        ...state,
        selectionState: { ...state.selectionState, selectedTasks: action.payload },
      };
    
    case 'SET_DRAG_STATE':
      return { ...state, dragState: action.payload };
    
    case 'SET_ZOOM_LEVEL':
      const newZoomLevel = Math.max(0, Math.min(state.zoomLevels.length - 1, action.payload));
      return {
        ...state,
        viewState: { ...state.viewState, zoomLevel: newZoomLevel },
        timelineConfig: {
          ...state.timelineConfig,
          dayWidth: state.zoomLevels[newZoomLevel].dayWidth,
          topTier: state.zoomLevels[newZoomLevel].topTier,
          bottomTier: state.zoomLevels[newZoomLevel].bottomTier,
        },
      };
    
    case 'SET_SCROLL_POSITION':
      return {
        ...state,
        viewState: { ...state.viewState, scrollPosition: action.payload },
      };
    
    case 'SET_SPLITTER_POSITION':
      return {
        ...state,
        viewState: { ...state.viewState, splitterPosition: action.payload },
      };
    
    case 'TOGGLE_TASK_EXPANSION':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload
            ? { ...task, isExpanded: !task.isExpanded }
            : task
        ),
      };
    
    case 'SET_VIEW_STATE':
      return {
        ...state,
        viewState: { ...state.viewState, ...action.payload },
      };
    
    case 'UPDATE_COLUMN_WIDTH':
      return {
        ...state,
        columns: state.columns.map(col =>
          col.field === action.payload.field
            ? { ...col, width: action.payload.width }
            : col
        ),
      };
    
    default:
      return state;
  }
}

const AdvancedGanttChart: React.FC<AdvancedGanttProps> = ({
  tasks: initialTasks,
  columns = defaultColumns,
  timelineConfig = {},
  virtualScrollConfig = {},
  zoomLevels = defaultZoomLevels,
  initialViewState = {},
  initialSelection = [],
  onTaskUpdate,
  onTaskCreate,
  onTaskDelete,
  onTaskMove,
  onTaskResize,
  onProgressChange,
  onSelectionChange,
  onColumnResize,
  onDependencyCreate,
  onDependencyDelete,
  className = '',
  style = {},
  theme = 'auto',
  enableDragDrop = true,
  enableResize = true,
  enableProgressEdit = true,
  enableInlineEdit = true,
  enableVirtualScrolling = true,
  enableDebouncing = true,
  debounceDelay = 300,
  maxVisibleTasks = 1000,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { startMeasure, endMeasure, metrics } = usePerformanceMonitoring();
  const { getDaysBetween } = useDateCalculations();

  // Initialize state
  const initialState: GanttState = {
    tasks: initialTasks,
    columns,
    timelineConfig: { ...defaultTimelineConfig, ...timelineConfig },
    virtualScrollConfig: { ...defaultVirtualScrollConfig, ...virtualScrollConfig },
    dragState: null,
    selectionState: {
      selectedTasks: initialSelection,
      selectedRows: [],
      focusedTask: undefined,
    },
    viewState: {
      zoomLevel: 2, // Week view by default
      scrollPosition: { x: 0, y: 0 },
      viewportSize: { width: 0, height: 0 },
      splitterPosition: 40, // 40% for grid, 60% for timeline
      showCriticalPath: false,
      showBaseline: false,
      showProgress: true,
      showDependencies: true,
      autoSchedule: false,
      readOnly: false,
      ...initialViewState,
    },
    zoomLevels,
    performanceMetrics: {
      renderTime: 0,
      taskCount: initialTasks.length,
      visibleTaskCount: 0,
    },
  };

  const [state, dispatch] = useReducer(ganttReducer, initialState);
  const { taskMap, parentChildMap, totalTasks } = useTaskCalculations(state.tasks);

  // Calculate project timeline bounds
  const projectBounds = useMemo(() => {
    if (state.tasks.length === 0) {
      const today = new Date();
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: new Date(today.getFullYear(), today.getMonth() + 3, 0),
      };
    }

    const startDates = state.tasks.map(task => task.startDate);
    const endDates = state.tasks.map(task => task.endDate);
    const minStart = new Date(Math.min(...startDates.map(d => d.getTime())));
    const maxEnd = new Date(Math.max(...endDates.map(d => d.getTime())));

    // Add some padding
    minStart.setDate(minStart.getDate() - 7);
    maxEnd.setDate(maxEnd.getDate() + 7);

    return { start: minStart, end: maxEnd };
  }, [state.tasks]);

  // Debounced event handlers
  const debouncedTaskUpdate = useDebounce(
    useCallback((taskId: string, updates: Partial<GanttTask>) => {
      dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, updates } });
      onTaskUpdate?.(taskId, updates);
    }, [onTaskUpdate]),
    enableDebouncing ? debounceDelay : 0
  );

  const debouncedTaskMove = useDebounce(
    useCallback((taskId: string, newDates: { start: Date; end: Date }) => {
      dispatch({ type: 'UPDATE_TASK', payload: { 
        id: taskId, 
        updates: { startDate: newDates.start, endDate: newDates.end } 
      }});
      onTaskMove?.(taskId, newDates);
    }, [onTaskMove]),
    enableDebouncing ? debounceDelay : 0
  );

  const debouncedProgressChange = useDebounce(
    useCallback((taskId: string, progress: number) => {
      dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, updates: { progress } }});
      onProgressChange?.(taskId, progress);
    }, [onProgressChange]),
    enableDebouncing ? debounceDelay : 0
  );

  // Throttled scroll handler
  const throttledScrollHandler = useThrottle(
    useCallback((scrollLeft: number, scrollTop: number) => {
      dispatch({ type: 'SET_SCROLL_POSITION', payload: { x: scrollLeft, y: scrollTop } });
    }, []),
    16 // 60fps
  );

  // Container size observer
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
        dispatch({ 
          type: 'SET_VIEW_STATE', 
          payload: { viewportSize: { width, height } } 
        });
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Calculate grid and timeline dimensions
  const gridWidth = useMemo(() => {
    return Math.floor(containerSize.width * (state.viewState.splitterPosition / 100));
  }, [containerSize.width, state.viewState.splitterPosition]);

  const timelineWidth = useMemo(() => {
    return containerSize.width - gridWidth;
  }, [containerSize.width, gridWidth]);

  // Handle zoom changes
  const handleZoomChange = useCallback((direction: 'in' | 'out') => {
    const currentZoom = state.viewState.zoomLevel;
    const newZoom = direction === 'in' 
      ? Math.min(state.zoomLevels.length - 1, currentZoom + 1)
      : Math.max(0, currentZoom - 1);
    
    dispatch({ type: 'SET_ZOOM_LEVEL', payload: newZoom });
  }, [state.viewState.zoomLevel, state.zoomLevels.length]);

  // Theme-aware colors
  const colors = useMemo(() => ({
    background: themeWiseColor('#ffffff', '#1f2937', themeMode),
    border: themeWiseColor('#e5e7eb', '#4b5563', themeMode),
    timelineBackground: themeWiseColor('#f8f9fa', '#374151', themeMode),
  }), [themeMode]);

  // Render timeline header
  const renderTimelineHeader = () => {
    const currentZoom = state.zoomLevels[state.viewState.zoomLevel];
    const totalDays = getDaysBetween(projectBounds.start, projectBounds.end);
    const totalWidth = totalDays * state.timelineConfig.dayWidth;

    return (
      <div className="timeline-header border-b" style={{ 
        height: (currentZoom.topTier.height || 30) + (currentZoom.bottomTier.height || 25),
        backgroundColor: colors.timelineBackground,
        borderColor: colors.border,
      }}>
        <VirtualTimeline
          startDate={projectBounds.start}
          endDate={projectBounds.end}
          dayWidth={state.timelineConfig.dayWidth}
          containerWidth={timelineWidth}
          containerHeight={(currentZoom.topTier.height || 30) + (currentZoom.bottomTier.height || 25)}
          onScroll={throttledScrollHandler}
        >
          {(date, index, style) => (
            <div className="timeline-cell flex flex-col border-r text-xs text-center" style={{
              ...style,
              borderColor: colors.border,
            }}>
              <div className="top-tier border-b px-1 py-1" style={{
                height: currentZoom.topTier.height || 30,
                borderColor: colors.border,
              }}>
                {formatDateForUnit(date, currentZoom.topTier.unit)}
              </div>
              <div className="bottom-tier px-1 py-1" style={{
                height: currentZoom.bottomTier.height || 25,
              }}>
                {formatDateForUnit(date, currentZoom.bottomTier.unit)}
              </div>
            </div>
          )}
        </VirtualTimeline>
      </div>
    );
  };

  // Render timeline content
  const renderTimelineContent = () => {
    const headerHeight = (state.zoomLevels[state.viewState.zoomLevel].topTier.height || 30) + 
                        (state.zoomLevels[state.viewState.zoomLevel].bottomTier.height || 25);
    const contentHeight = containerSize.height - headerHeight;

    return (
      <div className="timeline-content relative" style={{ height: contentHeight }}>
        {/* Timeline markers (weekends, holidays, etc.) */}
        <TimelineMarkers
          startDate={projectBounds.start}
          endDate={projectBounds.end}
          dayWidth={state.timelineConfig.dayWidth}
          containerHeight={contentHeight}
          timelineConfig={state.timelineConfig}
          holidays={state.timelineConfig.holidays}
          showWeekends={state.timelineConfig.showWeekends}
          showHolidays={true}
          showToday={true}
        />

        {/* Task bars */}
        <VirtualScrollContainer
          items={state.tasks}
          itemHeight={state.virtualScrollConfig.itemHeight}
          containerHeight={contentHeight}
          containerWidth={timelineWidth}
          overscan={state.virtualScrollConfig.overscan}
          onScroll={throttledScrollHandler}
        >
          {(task, index, style) => (
            <DraggableTaskBar
              key={task.id}
              task={task}
              timelineStart={projectBounds.start}
              dayWidth={state.timelineConfig.dayWidth}
              rowHeight={state.virtualScrollConfig.itemHeight}
              index={index}
              onTaskMove={debouncedTaskMove}
              onTaskResize={debouncedTaskMove}
              onProgressChange={debouncedProgressChange}
              enableDragDrop={enableDragDrop}
              enableResize={enableResize}
              enableProgressEdit={enableProgressEdit}
              readOnly={state.viewState.readOnly}
            />
          )}
        </VirtualScrollContainer>
      </div>
    );
  };

  // Render toolbar
  const renderToolbar = () => (
    <div className="gantt-toolbar flex items-center justify-between p-2 border-b bg-gray-50 dark:bg-gray-800" style={{
      borderColor: colors.border,
    }}>
      <div className="toolbar-left flex items-center space-x-2">
        <button
          onClick={() => handleZoomChange('out')}
          disabled={state.viewState.zoomLevel === 0}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          Zoom Out
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {state.zoomLevels[state.viewState.zoomLevel].name}
        </span>
        <button
          onClick={() => handleZoomChange('in')}
          disabled={state.viewState.zoomLevel === state.zoomLevels.length - 1}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          Zoom In
        </button>
      </div>
      
      <div className="toolbar-right flex items-center space-x-2 text-xs text-gray-500">
        <span>Tasks: {state.tasks.length}</span>
        <span>•</span>
        <span>Render: {Math.round(metrics.renderTime)}ms</span>
      </div>
    </div>
  );

  // Performance monitoring
  useEffect(() => {
    startMeasure('render');
    return () => endMeasure('render');
  });

  return (
    <div
      ref={containerRef}
      className={`advanced-gantt-chart flex flex-col ${className}`}
      style={{
        height: '100%',
        backgroundColor: colors.background,
        ...style,
      }}
    >
      {/* Toolbar */}
      {renderToolbar()}

      {/* Main content */}
      <div className="gantt-content flex flex-1 overflow-hidden">
        {/* Grid */}
        <div className="gantt-grid-container" style={{ width: gridWidth }}>
          <GanttGrid
            tasks={state.tasks}
            columns={state.columns}
            rowHeight={state.virtualScrollConfig.itemHeight}
            containerHeight={containerSize.height - 50} // Subtract toolbar height
            selection={state.selectionState}
            enableInlineEdit={enableInlineEdit}
            onTaskClick={(task) => {
              // Handle task selection
              const newSelection = { ...state.selectionState, selectedTasks: [task.id] };
              dispatch({ type: 'SET_SELECTION', payload: [task.id] });
              onSelectionChange?.(newSelection);
            }}
            onTaskExpand={(taskId) => {
              dispatch({ type: 'TOGGLE_TASK_EXPANSION', payload: taskId });
            }}
            onColumnResize={(field, width) => {
              dispatch({ type: 'UPDATE_COLUMN_WIDTH', payload: { field, width } });
              onColumnResize?.(field, width);
            }}
            onTaskUpdate={debouncedTaskUpdate}
          />
        </div>

        {/* Timeline */}
        <div className="gantt-timeline-container border-l" style={{ 
          width: timelineWidth,
          borderColor: colors.border,
        }}>
          {renderTimelineHeader()}
          {renderTimelineContent()}
        </div>
      </div>
    </div>
  );
};

// Helper function to format dates based on unit
function formatDateForUnit(date: Date, unit: string): string {
  switch (unit) {
    case 'year':
      return date.getFullYear().toString();
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    case 'week':
      return `W${getWeekNumber(date)}`;
    case 'day':
      return date.getDate().toString();
    case 'hour':
      return date.getHours().toString().padStart(2, '0');
    default:
      return '';
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default AdvancedGanttChart;