import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSelector } from 'react-redux';
import { taskManagementSelectors } from '@/features/task-management/task-management.slice';
import { Task } from '@/types/task-management.types';
import TaskRow from './task-row';
import AddTaskListRow from '@/pages/projects/projectView/taskList/task-list-table/task-list-table-rows/add-task-list-row';
import { RootState } from '@/app/store';
import { TaskListField } from '@/features/task-management/taskListFields.slice';
import { Checkbox } from '@/components';

interface VirtualizedTaskListProps {
  group: any;
  projectId: string;
  currentGrouping: 'status' | 'priority' | 'phase';
  selectedTaskIds: string[];
  onSelectTask: (taskId: string, selected: boolean) => void;
  onToggleSubtasks: (taskId: string) => void;
  height: number;
  width: number;
}

const VirtualizedTaskList: React.FC<VirtualizedTaskListProps> = React.memo(({
  group,
  projectId,
  currentGrouping,
  selectedTaskIds,
  onSelectTask,
  onToggleSubtasks,
  height,
  width
}) => {
  const allTasks = useSelector(taskManagementSelectors.selectAll);
  
  // Get theme from Redux store
  const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');
  
  // Get field visibility from taskListFields slice
  const taskListFields = useSelector((state: RootState) => state.taskManagementFields) as TaskListField[];
  
  // Debug logging
  useEffect(() => {
    console.log('VirtualizedTaskList Debug:', {
      taskListFields,
      fieldsLength: taskListFields?.length,
      fieldsState: taskListFields?.map(f => ({ key: f.key, visible: f.visible }))
    });
  }, [taskListFields]);

  // Get tasks for this group using memoization for performance
  const groupTasks = useMemo(() => {
    return group.taskIds
      .map((taskId: string) => allTasks.find((task: Task) => task.id === taskId))
      .filter((task: Task | undefined): task is Task => task !== undefined);
  }, [group.taskIds, allTasks]);

  // Calculate selection state for the group checkbox
  const { isAllSelected, isIndeterminate } = useMemo(() => {
    if (groupTasks.length === 0) {
      return { isAllSelected: false, isIndeterminate: false };
    }
    
    const selectedTasksInGroup = groupTasks.filter(task => selectedTaskIds.includes(task.id));
    const isAllSelected = selectedTasksInGroup.length === groupTasks.length;
    const isIndeterminate = selectedTasksInGroup.length > 0 && selectedTasksInGroup.length < groupTasks.length;
    
    return { isAllSelected, isIndeterminate };
  }, [groupTasks, selectedTaskIds]);

  // Handle select all tasks in group
  const handleSelectAllInGroup = useCallback((checked: boolean) => {
    if (checked) {
      // Select all tasks in the group
      groupTasks.forEach(task => {
        if (!selectedTaskIds.includes(task.id)) {
          onSelectTask(task.id, true);
        }
      });
    } else {
      // Deselect all tasks in the group
      groupTasks.forEach(task => {
        if (selectedTaskIds.includes(task.id)) {
          onSelectTask(task.id, false);
        }
      });
    }
  }, [groupTasks, selectedTaskIds, onSelectTask]);

  const TASK_ROW_HEIGHT = 40;
  const HEADER_HEIGHT = 40;
  const COLUMN_HEADER_HEIGHT = 40;
  const ADD_TASK_ROW_HEIGHT = 40;

  // Calculate dynamic height for the group
  const taskRowsHeight = groupTasks.length * TASK_ROW_HEIGHT;
  const groupHeight = HEADER_HEIGHT + COLUMN_HEADER_HEIGHT + taskRowsHeight + ADD_TASK_ROW_HEIGHT;

  // Define all possible columns
  const allFixedColumns = [
    { key: 'drag', label: '', width: 40, alwaysVisible: true },
    { key: 'select', label: '', width: 40, alwaysVisible: true },
    { key: 'key', label: 'KEY', width: 80, fieldKey: 'KEY' },
    { key: 'task', label: 'TASK', width: 474, alwaysVisible: true },
  ];

  const allScrollableColumns = [
    { key: 'progress', label: 'Progress', width: 90, fieldKey: 'PROGRESS' },
    { key: 'members', label: 'Members', width: 150, fieldKey: 'ASSIGNEES' },
    { key: 'labels', label: 'Labels', width: 200, fieldKey: 'LABELS' },
    { key: 'status', label: 'Status', width: 100, fieldKey: 'STATUS' },
    { key: 'priority', label: 'Priority', width: 100, fieldKey: 'PRIORITY' },
    { key: 'timeTracking', label: 'Time Tracking', width: 120, fieldKey: 'TIME_TRACKING' },
  ];

  // Filter columns based on field visibility
  const fixedColumns = useMemo(() => {
    return allFixedColumns.filter(col => {
      // Always show columns marked as alwaysVisible
      if (col.alwaysVisible) return true;
      
      // For other columns, check field visibility
      if (col.fieldKey) {
        const field = taskListFields.find(f => f.key === col.fieldKey);
        return field?.visible ?? false;
      }
      
      return false;
    });
  }, [taskListFields, allFixedColumns]);

  const scrollableColumns = useMemo(() => {
    return allScrollableColumns.filter(col => {
      // For scrollable columns, check field visibility
      if (col.fieldKey) {
        const field = taskListFields.find(f => f.key === col.fieldKey);
        return field?.visible ?? false;
      }
      
      return false;
    });
  }, [taskListFields, allScrollableColumns]);

  const fixedWidth = fixedColumns.reduce((sum, col) => sum + col.width, 0);
  const scrollableWidth = scrollableColumns.reduce((sum, col) => sum + col.width, 0);
  const totalTableWidth = fixedWidth + scrollableWidth;

  // Row renderer for virtualization (only task rows)
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const task: Task | undefined = groupTasks[index];
    if (!task) return null;
    return (
      <div 
        className="task-row-container"
        style={{ 
          ...style, 
          '--group-color': group.color || '#f0f0f0'
        } as React.CSSProperties}
      >
        <TaskRow
          task={task}
          projectId={projectId}
          groupId={group.id}
          currentGrouping={currentGrouping}
          isSelected={selectedTaskIds.includes(task.id)}
          index={index}
          onSelect={onSelectTask}
          onToggleSubtasks={onToggleSubtasks}
          fixedColumns={fixedColumns}
          scrollableColumns={scrollableColumns}
        />
      </div>
    );
  }, [group, groupTasks, projectId, currentGrouping, selectedTaskIds, onSelectTask, onToggleSubtasks, fixedColumns, scrollableColumns]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  // Synchronize header scroll with body scroll
  useEffect(() => {
    const handleScroll = () => {
      if (headerScrollRef.current && scrollContainerRef.current) {
        headerScrollRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
      }
    };
    const scrollDiv = scrollContainerRef.current;
    if (scrollDiv) {
      scrollDiv.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (scrollDiv) {
        scrollDiv.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const VIRTUALIZATION_THRESHOLD = 20;
  const shouldVirtualize = groupTasks.length > VIRTUALIZATION_THRESHOLD;

  return (
    <div className="virtualized-task-list" style={{ height: groupHeight }}>
      {/* Group Header */}
      <div className="task-group-header" style={{ height: HEADER_HEIGHT }}>
        <div className="task-group-header-row">
          <div 
            className="task-group-header-content"
            style={{ 
              backgroundColor: group.color || '#f0f0f0',
              borderLeft: `4px solid ${group.color || '#f0f0f0'}`
            }}
          >
            <span className="task-group-header-text">
              {group.title} ({groupTasks.length})
            </span>
          </div>
        </div>
      </div>
      {/* Column Headers (sync scroll) */}
      <div 
        className="task-group-column-headers-scroll" 
        ref={headerScrollRef}
        style={{ overflowX: 'auto', overflowY: 'hidden', height: COLUMN_HEADER_HEIGHT }}
      >
        <div 
          className="task-group-column-headers" 
          style={{ borderLeft: `4px solid ${group.color || '#f0f0f0'}`, minWidth: totalTableWidth, display: 'flex', position: 'relative' }}
        >
          <div className="fixed-columns-header" style={{ display: 'flex', position: 'sticky', left: 0, zIndex: 2, background: 'inherit', width: fixedWidth }}>
            {fixedColumns.map(col => (
              <div
                key={col.key}
                className="task-table-cell task-table-header-cell fixed-column"
                style={{ width: col.width }}
              >
                {col.key === 'select' ? (
                  <div className="flex items-center justify-center h-full">
                    <Checkbox
                      checked={isAllSelected}
                      onChange={handleSelectAllInGroup}
                      isDarkMode={isDarkMode}
                      indeterminate={isIndeterminate}
                    />
                  </div>
                ) : (
                  <span className="column-header-text">{col.label}</span>
                )}
              </div>
            ))}
          </div>
          <div className="scrollable-columns-header" style={{ display: 'flex', minWidth: scrollableWidth }}>
            {scrollableColumns.map(col => (
              <div
                key={col.key}
                className="task-table-cell task-table-header-cell"
                style={{ width: col.width }}
              >
                <span className="column-header-text">{col.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Scrollable List - only task rows */}
      <div 
        className="task-list-scroll-container" 
        ref={scrollContainerRef}
        style={{
          overflowX: 'auto',
          overflowY: 'auto',
          width: '100%',
          minWidth: totalTableWidth,
          height: groupTasks.length > 0 ? taskRowsHeight : 'auto',
        }}
      >
        <SortableContext items={group.taskIds} strategy={verticalListSortingStrategy}>
          {shouldVirtualize ? (
            <List
              height={taskRowsHeight}
              width={width}
              itemCount={groupTasks.length}
              itemSize={TASK_ROW_HEIGHT}
              overscanCount={50}
              className="react-window-list"
              style={{ minWidth: totalTableWidth }}
            >
              {Row}
            </List>
          ) : (
            groupTasks.map((task: Task, index: number) => (
              <div
                key={task.id}
                className="task-row-container"
                style={{
                  height: TASK_ROW_HEIGHT,
                  '--group-color': group.color || '#f0f0f0',
                } as React.CSSProperties}
              >
                <TaskRow
                  task={task}
                  projectId={projectId}
                  groupId={group.id}
                  currentGrouping={currentGrouping}
                  isSelected={selectedTaskIds.includes(task.id)}
                  index={index}
                  onSelect={onSelectTask}
                  onToggleSubtasks={onToggleSubtasks}
                  fixedColumns={fixedColumns}
                  scrollableColumns={scrollableColumns}
                />
              </div>
            ))
          )}
        </SortableContext>
      </div>
      {/* Add Task Row - Always show at the bottom */}
      <div 
        className="task-group-add-task"
        style={{ borderLeft: `4px solid ${group.color || '#f0f0f0'}`, height: ADD_TASK_ROW_HEIGHT }}
      >
        <AddTaskListRow groupId={group.id} />
      </div>
      <style>{`
        .virtualized-task-list {
          border: 1px solid var(--task-border-primary, #e8e8e8);
          border-radius: 8px;
          margin-bottom: 16px;
          background: var(--task-bg-primary, white);
          box-shadow: 0 1px 3px var(--task-shadow, rgba(0, 0, 0, 0.1));
          overflow: hidden;
          transition: all 0.3s ease;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .task-group-header {
          position: relative;
          z-index: 20;
        }
        .task-group-column-headers-scroll {
          width: 100%;
        }
        .task-group-column-headers {
          background: var(--task-bg-secondary, #f5f5f5);
          border-bottom: 1px solid var(--task-border-tertiary, #d9d9d9);
          margin: 0;
          padding: 0;
          min-width: 1200px;
        }
        .task-list-scroll-container {
          scrollbar-width: none; /* Firefox */
        }
        .task-list-scroll-container::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
        .react-window-list {
          outline: none;
          flex: 1;
          min-height: 0;
          margin: 0;
          padding: 0;
        }
        .react-window-list-item {
          contain: layout style;
          margin: 0;
          padding: 0;
        }
        /* Task row container styles */
        .task-row-container {
          position: relative;
          background: var(--task-bg-primary, white);
        }
        .task-row-container::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background-color: var(--group-color, #f0f0f0);
          z-index: 10;
        }
        /* Ensure no gaps between list items */
        .react-window-list > div {
          margin: 0;
          padding: 0;
        }
        /* Task group header styles */
        .task-group-header-row {
          display: inline-flex;
          height: inherit;
          max-height: none;
          overflow: hidden;
          margin: 0;
          padding: 0;
        }
        .task-group-header-content {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 6px 6px 0 0;
          color: white;
          font-weight: 500;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
          margin: 0;
          border: none;
        }
        .task-group-header-text {
          color: white !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          margin: 0 !important;
        }
        /* Column headers styles */
        .task-table-header-cell {
          background: var(--task-bg-secondary, #f5f5f5);
          font-weight: 600;
          color: var(--task-text-secondary, #595959);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--task-border-tertiary, #d9d9d9);
          height: 32px;
          max-height: 32px;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .column-header-text {
          font-size: 11px;
          font-weight: 600;
          color: var(--task-text-secondary, #595959);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: color 0.3s ease;
        }
        /* Add task row styles */
        .task-group-add-task {
          background: var(--task-bg-primary, white);
          border-top: 1px solid var(--task-border-secondary, #f0f0f0);
          transition: all 0.3s ease;
          padding: 0 12px;
          width: 100%;
          min-height: 40px;
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .task-group-add-task:hover {
          background: var(--task-hover-bg, #fafafa);
        }
        .task-table-fixed-columns {
          display: flex;
          background: var(--task-bg-secondary, #f5f5f5);
          position: sticky;
          left: 0;
          z-index: 11;
          border-right: 2px solid var(--task-border-primary, #e8e8e8);
          box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
        }
        .task-table-scrollable-columns {
          display: flex;
          flex: 1;
          min-width: 0;
        }
        .task-table-cell {
          display: flex;
          align-items: center;
          padding: 0 12px;
          border-right: 1px solid var(--task-border-secondary, #f0f0f0);
          font-size: 12px;
          white-space: nowrap;
          height: 40px;
          max-height: 40px;
          min-height: 40px;
          overflow: hidden;
          color: var(--task-text-primary, #262626);
          transition: all 0.3s ease;
        }
        .task-table-cell:last-child {
          border-right: none;
        }
        /* Performance optimizations */
        .virtualized-task-list {
          contain: layout style paint;
        }
        /* Dark mode support */
        :root {
          --task-bg-primary: #ffffff;
          --task-bg-secondary: #f5f5f5;
          --task-bg-tertiary: #f8f9fa;
          --task-border-primary: #e8e8e8;
          --task-border-secondary: #f0f0f0;
          --task-border-tertiary: #d9d9d9;
          --task-text-primary: #262626;
          --task-text-secondary: #595959;
          --task-text-tertiary: #8c8c8c;
          --task-shadow: rgba(0, 0, 0, 0.1);
          --task-hover-bg: #fafafa;
          --task-selected-bg: #e6f7ff;
          --task-selected-border: #1890ff;
          --task-drag-over-bg: #f0f8ff;
          --task-drag-over-border: #40a9ff;
        }
        .dark .virtualized-task-list,
        [data-theme="dark"] .virtualized-task-list {
          --task-bg-primary: #1f1f1f;
          --task-bg-secondary: #141414;
          --task-bg-tertiary: #262626;
          --task-border-primary: #303030;
          --task-border-secondary: #404040;
          --task-border-tertiary: #505050;
          --task-text-primary: #ffffff;
          --task-text-secondary: #d9d9d9;
          --task-text-tertiary: #8c8c8c;
          --task-shadow: rgba(0, 0, 0, 0.3);
          --task-hover-bg: #2a2a2a;
          --task-selected-bg: #1a2332;
          --task-selected-border: #1890ff;
          --task-drag-over-bg: #1a2332;
          --task-drag-over-border: #40a9ff;
        }
      `}</style>
    </div>
  );
});

export default VirtualizedTaskList; 