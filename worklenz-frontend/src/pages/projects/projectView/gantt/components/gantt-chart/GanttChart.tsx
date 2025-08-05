import React, { memo, useMemo, forwardRef, RefObject } from 'react';
import { GanttTask, GanttViewMode, GanttPhase } from '../../types/gantt-types';
import { useGanttDimensions } from '../../hooks/useGanttDimensions';

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
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange?: { start: Date; end: Date };
  phases?: GanttPhase[];
  expandedTasks?: Set<string>;
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
}

const TaskBarRow: React.FC<TaskBarRowProps> = memo(({ task, viewMode, columnWidth, columnsCount, dateRange }) => {
  const renderMilestone = () => {
    if (!task.start_date || !dateRange) return null;
    
    // Calculate position for milestone diamond
    const totalDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const daysFromStart = Math.floor((task.start_date.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const left = Math.max(0, (daysFromStart / totalDays) * (columnsCount * columnWidth));
    
    return (
      <div 
        className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 rotate-45 z-10 shadow-sm"
        style={{ 
          left: `${left}px`,
          backgroundColor: task.color || '#3b82f6'
        }}
        title={`${task.name} - ${task.start_date.toLocaleDateString()}`}
      />
    );
  };

  const renderTaskBar = () => {
    if (!task.start_date || !task.end_date || !dateRange) return null;
    
    // Calculate position and width for task bar
    const totalDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const daysFromStart = Math.floor((task.start_date.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const taskDuration = Math.ceil((task.end_date.getTime() - task.start_date.getTime()) / (1000 * 60 * 60 * 24));
    
    const left = Math.max(0, (daysFromStart / totalDays) * (columnsCount * columnWidth));
    const width = Math.max(10, (taskDuration / totalDays) * (columnsCount * columnWidth));
    
    return (
      <div 
        className="absolute top-1/2 transform -translate-y-1/2 h-6 rounded flex items-center px-2 text-xs text-white font-medium shadow-sm"
        style={{ 
          left: `${left}px`,
          width: `${width}px`,
          backgroundColor: task.color || '#6b7280'
        }}
        title={`${task.name} - ${task.start_date.toLocaleDateString()} to ${task.end_date.toLocaleDateString()}`}
      >
        <div className="truncate">{task.name}</div>
        {task.progress > 0 && (
          <div 
            className="absolute top-0 left-0 h-full bg-black bg-opacity-20 rounded"
            style={{ width: `${task.progress}%` }}
          />
        )}
      </div>
    );
  };

  const isPhase = task.type === 'milestone' || task.is_milestone;
  
  return (
    <div 
      className={`${isPhase ? 'min-h-[4.5rem]' : 'h-9'} relative border-b border-gray-100 dark:border-gray-700 transition-colors ${
        !isPhase ? 'hover:bg-gray-50 dark:hover:bg-gray-750' : ''
      }`}
      style={isPhase && task.color ? {
        backgroundColor: addAlphaToHex(task.color, 0.15),
      } : {}}
    >
      {isPhase ? renderMilestone() : renderTaskBar()}
    </div>
  );
});

TaskBarRow.displayName = 'TaskBarRow';

const GanttChart = forwardRef<HTMLDivElement, GanttChartProps>(({ tasks, viewMode, onScroll, containerRef, dateRange, phases, expandedTasks }, ref) => {
  const columnsCount = useMemo(() => {
    if (!dateRange) {
      // Default counts if no date range
      switch (viewMode) {
        case 'day': return 30;
        case 'week': return 12;
        case 'month': return 12;
        case 'quarter': return 8;
        case 'year': return 5;
        default: return 12;
      }
    }
    
    const { start, end } = dateRange;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    switch (viewMode) {
      case 'day': 
        return diffDays;
      case 'week':
        return Math.ceil(diffDays / 7);
      case 'month':
        const startYear = start.getFullYear();
        const startMonth = start.getMonth();
        const endYear = end.getFullYear();
        const endMonth = end.getMonth();
        return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
      case 'quarter':
        const qStartYear = start.getFullYear();
        const qStartQuarter = Math.ceil((start.getMonth() + 1) / 3);
        const qEndYear = end.getFullYear();
        const qEndQuarter = Math.ceil((end.getMonth() + 1) / 3);
        return (qEndYear - qStartYear) * 4 + (qEndQuarter - qStartQuarter) + 1;
      case 'year':
        return end.getFullYear() - start.getFullYear() + 1;
      default:
        return 12;
    }
  }, [viewMode, dateRange]);

  const { actualColumnWidth, totalWidth, shouldScroll } = useGanttDimensions(
    viewMode,
    containerRef,
    columnsCount
  );

  const gridColumns = useMemo(() => 
    Array.from({ length: columnsCount }).map((_, index) => index)
  , [columnsCount]);

  // Flatten tasks to match the same hierarchy as task list
  // This should be synchronized with the task list component's expand/collapse state
  const flattenedTasks = useMemo(() => {
    const result: Array<GanttTask | { id: string; isEmptyRow: boolean }> = [];
    
    const processTask = (task: GanttTask) => {
      result.push(task);
      
      // Check if this is an expanded phase with no children
      const isPhase = task.type === 'milestone' || task.is_milestone;
      const isEmpty = isPhase && (!task.children || task.children.length === 0);
      const isExpanded = expandedTasks ? expandedTasks.has(task.id) : (task.expanded !== false);
      
      if (isEmpty && isExpanded) {
        // Add an empty row for the "Add Task" button
        result.push({ id: `${task.id}-empty`, isEmptyRow: true });
      } else if (task.children && isExpanded) {
        task.children.forEach(child => processTask(child));
      }
    };
    
    tasks.forEach(processTask);
    return result;
  }, [tasks, expandedTasks]);

  return (
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
          minWidth: shouldScroll ? 'auto' : '100%'
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
          {flattenedTasks.map(item => {
            if ('isEmptyRow' in item && item.isEmptyRow) {
              // Render empty row without "Add Task" button
              return (
                <div 
                  key={item.id} 
                  className="h-9 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                />
              );
            }
            return (
              <TaskBarRow 
                key={item.id} 
                task={item as GanttTask} 
                viewMode={viewMode}
                columnWidth={actualColumnWidth}
                columnsCount={columnsCount}
                dateRange={dateRange}
              />
            );
          })}
          {flattenedTasks.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
              No tasks to display
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

GanttChart.displayName = 'GanttChart';

export default memo(GanttChart);