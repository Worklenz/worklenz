import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSelector } from 'react-redux';
import { taskManagementSelectors } from '@/features/task-management/task-management.slice';
import { Task } from '@/types/task-management.types';
import TaskRow from './task-row';
import AddTaskListRow from '@/pages/projects/projectView/taskList/task-list-table/task-list-table-rows/add-task-list-row';

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
  
  // Get tasks for this group using memoization for performance
  const groupTasks = useMemo(() => {
    return group.taskIds
      .map((taskId: string) => allTasks.find((task: Task) => task.id === taskId))
      .filter((task: Task | undefined): task is Task => task !== undefined);
  }, [group.taskIds, allTasks]);

  const TASK_ROW_HEIGHT = 40;
  const HEADER_HEIGHT = 40;
  const COLUMN_HEADER_HEIGHT = 40;

  // Calculate the actual height needed for the virtualized list
  const actualContentHeight = HEADER_HEIGHT + COLUMN_HEADER_HEIGHT + (groupTasks.length * TASK_ROW_HEIGHT);
  const listHeight = Math.min(height - 40, actualContentHeight);

  // Calculate item count - only include actual content
  const getItemCount = () => {
    return groupTasks.length + 2; // +2 for header and column headers only
  };

  // Debug logging
  useEffect(() => {
    console.log('VirtualizedTaskList:', {
      groupId: group.id,
      groupTasks: groupTasks.length,
      height,
      listHeight,
      itemCount: getItemCount(),
      isVirtualized: groupTasks.length > 10, // Show if virtualization should be active
      minHeight: 300,
      maxHeight: 600
    });
  }, [group.id, groupTasks.length, height, listHeight]);

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

  // Define columns array for alignment
  const columns = [
    { key: 'drag', label: '', width: 40, fixed: true },
    { key: 'select', label: '', width: 40, fixed: true },
    { key: 'key', label: 'KEY', width: 80, fixed: true },
    { key: 'task', label: 'TASK', width: 475, fixed: true },
    { key: 'progress', label: 'PROGRESS', width: 90 },
    { key: 'members', label: 'MEMBERS', width: 150 },
    { key: 'labels', label: 'LABELS', width: 200 },
    { key: 'status', label: 'STATUS', width: 100 },
    { key: 'priority', label: 'PRIORITY', width: 100 },
    { key: 'timeTracking', label: 'TIME TRACKING', width: 120 },
  ];
  const fixedColumns = columns.filter(col => col.fixed);
  const scrollableColumns = columns.filter(col => !col.fixed);
  const fixedWidth = fixedColumns.reduce((sum, col) => sum + col.width, 0);
  const scrollableWidth = scrollableColumns.reduce((sum, col) => sum + col.width, 0);
  const totalTableWidth = fixedWidth + scrollableWidth;

  // Row renderer for virtualization (remove header/column header rows)
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const task = groupTasks[index];
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
  }, [group, groupTasks, projectId, currentGrouping, selectedTaskIds, onSelectTask, onToggleSubtasks]);

  return (
    <div className="virtualized-task-list" style={{ height: height }}>
      {/* Group Header */}
      <div className="task-group-header">
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
        style={{ overflowX: 'auto', overflowY: 'hidden' }}
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
                <span className="column-header-text">{col.label}</span>
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
      {/* Scrollable List */}
      <div 
        className="task-list-scroll-container" 
        ref={scrollContainerRef}
        style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%', minWidth: totalTableWidth }}
      >
        <SortableContext items={group.taskIds} strategy={verticalListSortingStrategy}>
          <List
            height={listHeight}
            width={width}
            itemCount={groupTasks.length}
            itemSize={TASK_ROW_HEIGHT}
            overscanCount={15}
            className="react-window-list"
            style={{ minWidth: totalTableWidth }}
          >
            {Row}
          </List>
        </SortableContext>
      </div>
      {/* Add Task Row - Always show at the bottom */}
      <div 
        className="task-group-add-task"
        style={{ borderLeft: `4px solid ${group.color || '#f0f0f0'}` }}
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
          width: 100%;
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
          height: auto;
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