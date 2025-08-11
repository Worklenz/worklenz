import React, { useState, useRef, useCallback, useMemo } from 'react';
import { GanttTask, DragState } from '../../types/advanced-gantt.types';
import { useAppSelector } from '../../hooks/useAppSelector';
import { themeWiseColor } from '../../utils/themeWiseColor';
import { useDateCalculations } from '../../utils/gantt-performance';

interface DraggableTaskBarProps {
  task: GanttTask;
  timelineStart: Date;
  dayWidth: number;
  rowHeight: number;
  index: number;
  onTaskMove?: (taskId: string, newDates: { start: Date; end: Date }) => void;
  onTaskResize?: (taskId: string, newDates: { start: Date; end: Date }) => void;
  onProgressChange?: (taskId: string, progress: number) => void;
  onTaskClick?: (task: GanttTask) => void;
  onTaskDoubleClick?: (task: GanttTask) => void;
  enableDragDrop?: boolean;
  enableResize?: boolean;
  enableProgressEdit?: boolean;
  readOnly?: boolean;
}

const DraggableTaskBar: React.FC<DraggableTaskBarProps> = ({
  task,
  timelineStart,
  dayWidth,
  rowHeight,
  index,
  onTaskMove,
  onTaskResize,
  onProgressChange,
  onTaskClick,
  onTaskDoubleClick,
  enableDragDrop = true,
  enableResize = true,
  enableProgressEdit = true,
  readOnly = false,
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverState, setHoverState] = useState<string | null>(null);
  const taskBarRef = useRef<HTMLDivElement>(null);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { getDaysBetween, addDays } = useDateCalculations();

  // Calculate task position and dimensions
  const taskPosition = useMemo(() => {
    const startDays = getDaysBetween(timelineStart, task.startDate);
    const duration = getDaysBetween(task.startDate, task.endDate);
    
    return {
      x: startDays * dayWidth,
      width: Math.max(dayWidth * 0.5, duration * dayWidth),
      y: index * rowHeight + 8, // 8px padding
      height: rowHeight - 16, // 16px total padding
    };
  }, [task.startDate, task.endDate, timelineStart, dayWidth, rowHeight, index, getDaysBetween]);

  // Theme-aware colors
  const colors = useMemo(() => {
    const baseColor = task.color || getDefaultTaskColor(task.status);
    return {
      background: themeWiseColor(baseColor, adjustColorForDarkMode(baseColor), themeMode),
      border: themeWiseColor(darkenColor(baseColor, 0.2), lightenColor(baseColor, 0.2), themeMode),
      progress: themeWiseColor('#52c41a', '#34d399', themeMode),
      text: themeWiseColor('#ffffff', '#f9fafb', themeMode),
      hover: themeWiseColor(lightenColor(baseColor, 0.1), darkenColor(baseColor, 0.1), themeMode),
    };
  }, [task.color, task.status, themeMode]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, dragType: DragState['dragType']) => {
    if (readOnly || !enableDragDrop) return;
    
    e.preventDefault();
    e.stopPropagation();

    const rect = taskBarRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragState({
      isDragging: true,
      dragType,
      taskId: task.id,
      initialPosition: { x: e.clientX, y: e.clientY },
      currentPosition: { x: e.clientX, y: e.clientY },
      initialDates: { start: task.startDate, end: task.endDate },
      initialProgress: task.progress,
      snapToGrid: true,
    });

    // Add global mouse event listeners
    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleMouseMove_Internal(moveEvent, dragType);
    };

    const handleMouseUp = () => {
      handleMouseUp_Internal();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [readOnly, enableDragDrop, task]);

  const handleMouseMove_Internal = useCallback((e: MouseEvent, dragType: DragState['dragType']) => {
    if (!dragState) return;

    const deltaX = e.clientX - dragState.initialPosition.x;
    const deltaDays = Math.round(deltaX / dayWidth);

    let newStartDate = task.startDate;
    let newEndDate = task.endDate;

    switch (dragType) {
      case 'move':
        newStartDate = addDays(dragState.initialDates.start, deltaDays);
        newEndDate = addDays(dragState.initialDates.end, deltaDays);
        break;
      
      case 'resize-start':
        newStartDate = addDays(dragState.initialDates.start, deltaDays);
        // Ensure minimum duration
        if (newStartDate >= newEndDate) {
          newStartDate = addDays(newEndDate, -1);
        }
        break;
      
      case 'resize-end':
        newEndDate = addDays(dragState.initialDates.end, deltaDays);
        // Ensure minimum duration
        if (newEndDate <= newStartDate) {
          newEndDate = addDays(newStartDate, 1);
        }
        break;
      
      case 'progress':
        if (enableProgressEdit) {
          const progressDelta = deltaX / taskPosition.width;
          const newProgress = Math.max(0, Math.min(100, (dragState.initialProgress || 0) + progressDelta * 100));
          onProgressChange?.(task.id, newProgress);
        }
        return;
    }

    // Update drag state
    setDragState(prev => prev ? {
      ...prev,
      currentPosition: { x: e.clientX, y: e.clientY },
    } : null);

    // Call appropriate handler
    if (dragType === 'move') {
      onTaskMove?.(task.id, { start: newStartDate, end: newEndDate });
    } else if (dragType.startsWith('resize')) {
      onTaskResize?.(task.id, { start: newStartDate, end: newEndDate });
    }
  }, [dragState, dayWidth, task, taskPosition.width, enableProgressEdit, onTaskMove, onTaskResize, onProgressChange, addDays]);

  const handleMouseUp_Internal = useCallback(() => {
    setDragState(null);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onTaskClick?.(task);
  }, [task, onTaskClick]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onTaskDoubleClick?.(task);
  }, [task, onTaskDoubleClick]);

  // Render task bar with handles
  const renderTaskBar = () => {
    const isSelected = false; // TODO: Get from selection state
    const isDragging = dragState?.isDragging || false;

    return (
      <div
        ref={taskBarRef}
        className={`task-bar relative cursor-pointer select-none transition-all duration-200 ${
          isDragging ? 'z-10 shadow-lg' : ''
        } ${isSelected ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
        style={{
          position: 'absolute',
          left: taskPosition.x,
          top: taskPosition.y,
          width: taskPosition.width,
          height: taskPosition.height,
          backgroundColor: dragState?.isDragging ? colors.hover : colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: '4px',
          transform: isDragging ? 'translateY(-2px)' : 'none',
          boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.1)',
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setHoverState('task')}
        onMouseLeave={() => setHoverState(null)}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        {/* Progress bar */}
        <div
          className="progress-bar absolute inset-0 rounded-l"
          style={{
            width: `${task.progress}%`,
            backgroundColor: colors.progress,
            opacity: 0.7,
            borderRadius: '3px 0 0 3px',
          }}
        />

        {/* Task content */}
        <div className="task-content relative z-10 h-full flex items-center px-2">
          <span
            className="task-name text-xs font-medium truncate"
            style={{ color: colors.text }}
          >
            {task.name}
          </span>
          
          {/* Duration display for smaller tasks */}
          {taskPosition.width < 100 && (
            <span
              className="task-duration text-xs ml-auto"
              style={{ color: colors.text, opacity: 0.8 }}
            >
              {getDaysBetween(task.startDate, task.endDate)}d
            </span>
          )}
        </div>

        {/* Resize handles */}
        {enableResize && !readOnly && hoverState === 'task' && (
          <>
            {/* Left resize handle */}
            <div
              className="resize-handle-left absolute left-0 top-0 w-1 h-full cursor-ew-resize bg-white bg-opacity-50 hover:bg-opacity-80"
              onMouseDown={(e) => handleMouseDown(e, 'resize-start')}
              onMouseEnter={() => setHoverState('resize-start')}
            />
            
            {/* Right resize handle */}
            <div
              className="resize-handle-right absolute right-0 top-0 w-1 h-full cursor-ew-resize bg-white bg-opacity-50 hover:bg-opacity-80"
              onMouseDown={(e) => handleMouseDown(e, 'resize-end')}
              onMouseEnter={() => setHoverState('resize-end')}
            />
          </>
        )}

        {/* Progress handle */}
        {enableProgressEdit && !readOnly && hoverState === 'task' && (
          <div
            className="progress-handle absolute top-0 h-full w-1 cursor-ew-resize bg-blue-500 opacity-75"
            style={{ left: `${task.progress}%` }}
            onMouseDown={(e) => handleMouseDown(e, 'progress')}
            onMouseEnter={() => setHoverState('progress')}
          />
        )}

        {/* Task type indicator */}
        {task.type === 'milestone' && (
          <div
            className="milestone-indicator absolute -top-1 -right-1 w-3 h-3 transform rotate-45"
            style={{ backgroundColor: colors.border }}
          />
        )}
      </div>
    );
  };

  return renderTaskBar();
};

// Helper functions
function getDefaultTaskColor(status: GanttTask['status']): string {
  switch (status) {
    case 'completed': return '#52c41a';
    case 'in-progress': return '#1890ff';
    case 'overdue': return '#ff4d4f';
    case 'on-hold': return '#faad14';
    default: return '#d9d9d9';
  }
}

function darkenColor(color: string, amount: number): string {
  // Simple color darkening - in a real app, use a proper color manipulation library
  return color;
}

function lightenColor(color: string, amount: number): string {
  // Simple color lightening - in a real app, use a proper color manipulation library
  return color;
}

function adjustColorForDarkMode(color: string): string {
  // Adjust color for dark mode - in a real app, use a proper color manipulation library
  return color;
}

export default DraggableTaskBar;