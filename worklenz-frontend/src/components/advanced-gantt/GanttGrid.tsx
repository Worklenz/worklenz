import React, { useMemo, useRef, useState, useCallback } from 'react';
import { GanttTask, ColumnConfig, SelectionState } from '../../types/advanced-gantt.types';
import { useAppSelector } from '../../hooks/useAppSelector';
import { themeWiseColor } from '../../utils/themeWiseColor';
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { CalendarIcon, UserIcon, FlagIcon } from '@heroicons/react/24/solid';

interface GanttGridProps {
  tasks: GanttTask[];
  columns: ColumnConfig[];
  rowHeight: number;
  containerHeight: number;
  selection: SelectionState;
  enableInlineEdit?: boolean;
  enableMultiSelect?: boolean;
  onTaskClick?: (task: GanttTask, event: React.MouseEvent) => void;
  onTaskDoubleClick?: (task: GanttTask) => void;
  onTaskExpand?: (taskId: string) => void;
  onSelectionChange?: (selection: SelectionState) => void;
  onColumnResize?: (columnField: string, newWidth: number) => void;
  onTaskUpdate?: (taskId: string, field: string, value: any) => void;
  className?: string;
}

const GanttGrid: React.FC<GanttGridProps> = ({
  tasks,
  columns,
  rowHeight,
  containerHeight,
  selection,
  enableInlineEdit = true,
  enableMultiSelect = true,
  onTaskClick,
  onTaskDoubleClick,
  onTaskExpand,
  onSelectionChange,
  onColumnResize,
  onTaskUpdate,
  className = '',
}) => {
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: string } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    columns.reduce((acc, col) => ({ ...acc, [col.field]: col.width }), {})
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Theme-aware colors
  const colors = useMemo(() => ({
    background: themeWiseColor('#ffffff', '#1f2937', themeMode),
    alternateRow: themeWiseColor('#f9fafb', '#374151', themeMode),
    border: themeWiseColor('#e5e7eb', '#4b5563', themeMode),
    text: themeWiseColor('#111827', '#f9fafb', themeMode),
    textSecondary: themeWiseColor('#6b7280', '#d1d5db', themeMode),
    selected: themeWiseColor('#eff6ff', '#1e3a8a', themeMode),
    hover: themeWiseColor('#f3f4f6', '#4b5563', themeMode),
    headerBg: themeWiseColor('#f8f9fa', '#374151', themeMode),
  }), [themeMode]);

  // Calculate total grid width
  const totalWidth = useMemo(() => {
    return columns.reduce((sum, col) => sum + columnWidths[col.field], 0);
  }, [columns, columnWidths]);

  // Handle column resize
  const handleColumnResize = useCallback((columnField: string, deltaX: number) => {
    const column = columns.find(col => col.field === columnField);
    if (!column) return;

    const currentWidth = columnWidths[columnField];
    const newWidth = Math.max(column.minWidth || 60, Math.min(column.maxWidth || 400, currentWidth + deltaX));
    
    setColumnWidths(prev => ({ ...prev, [columnField]: newWidth }));
    onColumnResize?.(columnField, newWidth);
  }, [columns, columnWidths, onColumnResize]);

  // Handle task selection
  const handleTaskSelection = useCallback((task: GanttTask, event: React.MouseEvent) => {
    const { ctrlKey, shiftKey } = event;
    let newSelectedTasks = [...selection.selectedTasks];

    if (shiftKey && enableMultiSelect && selection.selectedTasks.length > 0) {
      // Range selection
      const lastSelectedIndex = tasks.findIndex(t => t.id === selection.selectedTasks[selection.selectedTasks.length - 1]);
      const currentIndex = tasks.findIndex(t => t.id === task.id);
      const [start, end] = [Math.min(lastSelectedIndex, currentIndex), Math.max(lastSelectedIndex, currentIndex)];
      
      newSelectedTasks = tasks.slice(start, end + 1).map(t => t.id);
    } else if (ctrlKey && enableMultiSelect) {
      // Multi selection
      if (newSelectedTasks.includes(task.id)) {
        newSelectedTasks = newSelectedTasks.filter(id => id !== task.id);
      } else {
        newSelectedTasks.push(task.id);
      }
    } else {
      // Single selection
      newSelectedTasks = [task.id];
    }

    onSelectionChange?.({
      ...selection,
      selectedTasks: newSelectedTasks,
      focusedTask: task.id,
    });

    onTaskClick?.(task, event);
  }, [tasks, selection, enableMultiSelect, onSelectionChange, onTaskClick]);

  // Handle cell editing
  const handleCellDoubleClick = useCallback((task: GanttTask, column: ColumnConfig) => {
    if (!enableInlineEdit || !column.editor) return;
    
    setEditingCell({ taskId: task.id, field: column.field });
  }, [enableInlineEdit]);

  const handleCellEditComplete = useCallback((value: any) => {
    if (!editingCell) return;
    
    onTaskUpdate?.(editingCell.taskId, editingCell.field, value);
    setEditingCell(null);
  }, [editingCell, onTaskUpdate]);

  // Render cell content
  const renderCellContent = useCallback((task: GanttTask, column: ColumnConfig) => {
    const value = task[column.field as keyof GanttTask];
    const isEditing = editingCell?.taskId === task.id && editingCell?.field === column.field;

    if (isEditing) {
      return renderCellEditor(value, column, handleCellEditComplete);
    }

    if (column.renderer) {
      return column.renderer(value, task);
    }

    // Default renderers
    switch (column.field) {
      case 'name':
        return (
          <div className="flex items-center space-x-2">
            {task.hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskExpand?.(task.id);
                }}
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                {task.isExpanded ? (
                  <ChevronDownIcon className="w-3 h-3" />
                ) : (
                  <ChevronRightIcon className="w-3 h-3" />
                )}
              </button>
            )}
            <div 
              className="flex items-center space-x-2"
              style={{ paddingLeft: `${(task.level || 0) * 16}px` }}
            >
              {getTaskTypeIcon(task.type)}
              <span className="truncate font-medium">{task.name}</span>
            </div>
          </div>
        );
      
      case 'startDate':
      case 'endDate':
        return (
          <div className="flex items-center space-x-1">
            <CalendarIcon className="w-3 h-3 text-gray-400" />
            <span>{(value as Date)?.toLocaleDateString() || '-'}</span>
          </div>
        );
      
      case 'assignee':
        return task.assignee ? (
          <div className="flex items-center space-x-2">
            {task.assignee.avatar ? (
              <img 
                src={task.assignee.avatar} 
                alt={task.assignee.name}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <UserIcon className="w-6 h-6 text-gray-400" />
            )}
            <span className="truncate">{task.assignee.name}</span>
          </div>
        ) : (
          <span className="text-gray-400">Unassigned</span>
        );
      
      case 'progress':
        return (
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <span className="text-xs w-8 text-right">{task.progress}%</span>
          </div>
        );
      
      case 'status':
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
            {task.status.replace('-', ' ')}
          </span>
        );
      
      case 'priority':
        return (
          <div className="flex items-center space-x-1">
            <FlagIcon className={`w-3 h-3 ${getPriorityColor(task.priority)}`} />
            <span className="capitalize">{task.priority}</span>
          </div>
        );
      
      case 'duration':
        const duration = task.duration || Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24));
        return <span>{duration}d</span>;
      
      default:
        return <span>{String(value || '')}</span>;
    }
  }, [editingCell, onTaskExpand, handleCellEditComplete]);

  // Render header
  const renderHeader = () => (
    <div 
      className="grid-header flex border-b sticky top-0 z-10"
      style={{ 
        backgroundColor: colors.headerBg,
        borderColor: colors.border,
        height: rowHeight,
      }}
    >
      {columns.map((column, index) => (
        <div
          key={column.field}
          className="column-header flex items-center px-3 py-2 font-medium text-sm border-r relative group"
          style={{
            width: columnWidths[column.field],
            borderColor: colors.border,
            color: colors.text,
          }}
        >
          <span className="truncate" title={column.title}>
            {column.title}
          </span>
          
          {/* Resize handle */}
          {column.resizable && (
            <ResizeHandle
              onResize={(deltaX) => handleColumnResize(column.field, deltaX)}
              className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
            />
          )}
        </div>
      ))}
    </div>
  );

  // Render task rows
  const renderRows = () => (
    <div className="grid-body">
      {tasks.map((task, rowIndex) => {
        const isSelected = selection.selectedTasks.includes(task.id);
        const isFocused = selection.focusedTask === task.id;
        
        return (
          <div
            key={task.id}
            className={`grid-row flex border-b cursor-pointer hover:bg-opacity-75 ${
              isSelected ? 'bg-blue-50 dark:bg-blue-900 bg-opacity-50' : 
              rowIndex % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-800 bg-opacity-30'
            }`}
            style={{
              height: rowHeight,
              borderColor: colors.border,
              backgroundColor: isSelected ? colors.selected : 
                              rowIndex % 2 === 0 ? 'transparent' : colors.alternateRow,
            }}
            onClick={(e) => handleTaskSelection(task, e)}
            onDoubleClick={() => onTaskDoubleClick?.(task)}
          >
            {columns.map((column) => (
              <div
                key={`${task.id}-${column.field}`}
                className="grid-cell flex items-center px-3 py-1 border-r overflow-hidden"
                style={{
                  width: columnWidths[column.field],
                  borderColor: colors.border,
                  textAlign: column.align || 'left',
                }}
                onDoubleClick={() => handleCellDoubleClick(task, column)}
              >
                {renderCellContent(task, column)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      ref={gridRef}
      className={`gantt-grid border-r ${className}`}
      style={{
        width: totalWidth,
        height: containerHeight,
        backgroundColor: colors.background,
        borderColor: colors.border,
      }}
    >
      {renderHeader()}
      <div 
        className="grid-content overflow-auto"
        style={{ height: containerHeight - rowHeight }}
      >
        {renderRows()}
      </div>
    </div>
  );
};

// Resize handle component
interface ResizeHandleProps {
  onResize: (deltaX: number) => void;
  className?: string;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize, className }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      onResize(deltaX);
      startXRef.current = moveEvent.clientX;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize]);

  return (
    <div
      className={`resize-handle ${className} ${isDragging ? 'bg-blue-500' : ''}`}
      onMouseDown={handleMouseDown}
    />
  );
};

// Cell editor component
const renderCellEditor = (value: any, column: ColumnConfig, onComplete: (value: any) => void) => {
  const [editValue, setEditValue] = useState(value);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onComplete(editValue);
    } else if (e.key === 'Escape') {
      onComplete(value); // Cancel editing
    }
  };

  const handleBlur = () => {
    onComplete(editValue);
  };

  switch (column.editor) {
    case 'text':
      return (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full px-1 py-0.5 border rounded text-sm"
          autoFocus
        />
      );
    
    case 'date':
      return (
        <input
          type="date"
          value={editValue instanceof Date ? editValue.toISOString().split('T')[0] : editValue}
          onChange={(e) => setEditValue(new Date(e.target.value))}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full px-1 py-0.5 border rounded text-sm"
          autoFocus
        />
      );
    
    case 'number':
      return (
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(parseFloat(e.target.value))}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full px-1 py-0.5 border rounded text-sm"
          autoFocus
        />
      );
    
    case 'select':
      return (
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full px-1 py-0.5 border rounded text-sm"
          autoFocus
        >
          {column.editorOptions?.map((option: any) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    
    default:
      return <span>{String(value)}</span>;
  }
};

// Helper functions
const getTaskTypeIcon = (type: GanttTask['type']) => {
  switch (type) {
    case 'project':
      return <div className="w-3 h-3 bg-blue-500 rounded-sm" />;
    case 'milestone':
      return <div className="w-3 h-3 bg-yellow-500 rotate-45" />;
    default:
      return <div className="w-3 h-3 bg-gray-400 rounded-full" />;
  }
};

const getStatusColor = (status: GanttTask['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'in-progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'on-hold':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
};

const getPriorityColor = (priority: GanttTask['priority']) => {
  switch (priority) {
    case 'critical':
      return 'text-red-600';
    case 'high':
      return 'text-orange-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-green-500';
    default:
      return 'text-gray-400';
  }
};

export default GanttGrid;