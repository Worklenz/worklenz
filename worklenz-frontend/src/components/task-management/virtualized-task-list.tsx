import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList as List, FixedSizeList } from 'react-window';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Empty, Button, Input } from '@/shared/antd-imports';
import { RightOutlined, DownOutlined } from '@/shared/antd-imports';
import {
  taskManagementSelectors,
  toggleTaskExpansion,
  fetchSubTasks,
  selectAllTasks,
  selectTaskIds,
  selectGroups,
  selectGrouping,
  selectLoading,
  selectError,
  selectSelectedPriorities,
  selectSearch,
} from '@/features/task-management/task-management.slice';
import { toggleGroupCollapsed } from '@/features/task-management/grouping.slice';
import { Task } from '@/types/task-management.types';
import TaskRow from './task-row';
import AddTaskListRow from '@/pages/projects/projectView/taskList/task-list-table/task-list-table-rows/add-task-list-row';
import { RootState } from '@/app/store';
import { TaskListField } from '@/features/task-management/taskListFields.slice';
import { Checkbox } from '@/components';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

interface VirtualizedTaskListProps {
  group: any;
  projectId: string;
  currentGrouping: 'status' | 'priority' | 'phase';
  selectedTaskIds: string[];
  onSelectTask: (taskId: string, selected: boolean) => void;
  onToggleSubtasks: (taskId: string) => void;
  height: number;
  width: number;
  tasksById: Record<string, Task>;
}

const VirtualizedTaskList: React.FC<VirtualizedTaskListProps> = React.memo(
  ({
    group,
    projectId,
    currentGrouping,
    selectedTaskIds,
    onSelectTask,
    onToggleSubtasks,
    height,
    width,
    tasksById,
  }) => {
    const dispatch = useDispatch();
    const { t } = useTranslation('task-management');

    // Get theme from Redux store
    const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');

    // Get field visibility from taskListFields slice
    const taskListFields = useSelector(
      (state: RootState) => state.taskManagementFields
    ) as TaskListField[];

    // Get group collapse state from Redux
    const groupStates = useSelector((state: RootState) => state.grouping.groupStates);
    const isCollapsed = groupStates[group.id]?.collapsed || false;

    // PERFORMANCE OPTIMIZATION: Improved virtualization for better user experience
    const VIRTUALIZATION_THRESHOLD = 25; // Increased threshold - virtualize when there are more tasks
    const TASK_ROW_HEIGHT = 40;
    const HEADER_HEIGHT = 40;
    const COLUMN_HEADER_HEIGHT = 40;
    const ADD_TASK_ROW_HEIGHT = 40;

    // PERFORMANCE OPTIMIZATION: Batch rendering to prevent long tasks
    const RENDER_BATCH_SIZE = 5; // Render max 5 tasks per frame
    const FRAME_BUDGET_MS = 8;

    const [showAddSubtaskForTaskId, setShowAddSubtaskForTaskId] = React.useState<string | null>(
      null
    );
    const [newSubtaskName, setNewSubtaskName] = React.useState('');
    const addSubtaskInputRef = React.useRef<any>(null);

    const { socket, connected } = useSocket();

    const handleAddSubtask = (parentTaskId: string) => {
      if (!newSubtaskName.trim() || !connected || !socket) return;
      const currentSession = JSON.parse(localStorage.getItem('session') || '{}');
      const requestBody = {
        project_id: group.project_id || group.projectId || projectId,
        name: newSubtaskName.trim(),
        reporter_id: currentSession.id,
        team_id: currentSession.team_id,
        parent_task_id: parentTaskId,
      };
      socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(requestBody));
      // Listen for the response and clear input/collapse row
      socket.once(SocketEvents.QUICK_TASK.toString(), (response: any) => {
        setNewSubtaskName('');
        setShowAddSubtaskForTaskId(null);
        // Optionally: trigger a refresh or update tasks in parent
      });
    };
    const handleCancelAddSubtask = () => {
      setNewSubtaskName('');
      setShowAddSubtaskForTaskId(null);
    };

    // Handle collapse/expand toggle
    const handleToggleCollapse = useCallback(() => {
      dispatch(toggleGroupCollapsed(group.id));
    }, [dispatch, group.id]);

    // PERFORMANCE OPTIMIZATION: Add early return for empty groups
    if (!group || !group.taskIds || group.taskIds.length === 0) {
      const emptyGroupHeight = HEADER_HEIGHT + COLUMN_HEADER_HEIGHT + 120 + ADD_TASK_ROW_HEIGHT; // 120px for empty state

      return (
        <div
          className="virtualized-task-list empty-group"
          style={{ height: emptyGroupHeight, position: 'relative' }}
        >
          {/* Sticky Group Color Border */}
          <div
            className="sticky-group-border"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              backgroundColor: group?.color || '#f0f0f0',
              zIndex: 15,
              pointerEvents: 'none',
            }}
          />

          <div className="task-group-header" style={{ height: HEADER_HEIGHT }}>
            <div className="task-group-header-row">
              <div
                className="task-group-header-content"
                style={{
                  backgroundColor: group?.color || '#f0f0f0',
                  // No margin - header should overlap the sticky border
                }}
              >
                <Button
                  type="text"
                  icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
                  onClick={handleToggleCollapse}
                  className="task-group-collapse-button"
                  style={{
                    color: 'white',
                    border: 'none',
                    background: 'transparent',
                    padding: '4px',
                    marginRight: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
                <span className="task-group-header-text">{group?.title || 'Empty Group'} (0)</span>
              </div>
            </div>
          </div>

          {/* Column Headers */}
          <div
            style={{
              marginLeft: '4px', // Account for sticky border
              height: COLUMN_HEADER_HEIGHT,
              background: 'var(--task-bg-secondary, #f5f5f5)',
              borderBottom: '1px solid var(--task-border-tertiary, #d9d9d9)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: '12px',
            }}
          >
            <span
              className="column-header-text"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--task-text-secondary, #595959)',
              }}
            >
              TASKS
            </span>
          </div>

          {/* Empty State */}
          <div
            className="empty-tasks-container"
            style={{
              height: '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '4px', // Account for sticky border
              backgroundColor: 'var(--task-bg-primary, white)',
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--task-text-primary, #262626)',
                      marginBottom: '4px',
                    }}
                  >
                    {t('noTasksInGroup')}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--task-text-secondary, #595959)' }}>
                    {t('noTasksInGroupDescription')}
                  </div>
                </div>
              }
              style={{
                margin: 0,
                padding: '12px',
              }}
            />
          </div>

          <div
            className="task-group-add-task"
            style={{ marginLeft: '4px', height: ADD_TASK_ROW_HEIGHT }}
          >
            <AddTaskListRow groupId={group?.id} />
          </div>
        </div>
      );
    }

    // Get tasks for this group using memoization for performance
    const groupTasks = useMemo(() => {
      return group.taskIds
        .map((taskId: string) => tasksById[taskId])
        .filter((task: Task | undefined): task is Task => task !== undefined);
    }, [group.taskIds, tasksById, group.id]);

    // Calculate selection state for the group checkbox
    const selectionState = useMemo(() => {
      if (groupTasks.length === 0) {
        return { isAllSelected: false, isIndeterminate: false };
      }

      const selectedTasksInGroup = groupTasks.filter((task: Task) =>
        selectedTaskIds.includes(task.id)
      );
      const isAllSelected = selectedTasksInGroup.length === groupTasks.length;
      const isIndeterminate =
        selectedTasksInGroup.length > 0 && selectedTasksInGroup.length < groupTasks.length;

      return { isAllSelected, isIndeterminate };
    }, [groupTasks, selectedTaskIds]);

    // Handle select all tasks in group - optimized with useCallback
    const handleSelectAllInGroup = useCallback(
      (checked: boolean) => {
        // PERFORMANCE OPTIMIZATION: Batch selection updates
        const tasksToUpdate: Array<{ taskId: string; selected: boolean }> = [];

        if (checked) {
          // Select all tasks in the group
          for (let i = 0; i < groupTasks.length; i++) {
            const task = groupTasks[i];
            if (!selectedTaskIds.includes(task.id)) {
              tasksToUpdate.push({ taskId: task.id, selected: true });
            }
          }
        } else {
          // Deselect all tasks in the group
          for (let i = 0; i < groupTasks.length; i++) {
            const task = groupTasks[i];
            if (selectedTaskIds.includes(task.id)) {
              tasksToUpdate.push({ taskId: task.id, selected: false });
            }
          }
        }

        // Batch update all selections
        tasksToUpdate.forEach(({ taskId, selected }) => {
          onSelectTask(taskId, selected);
        });
      },
      [groupTasks, selectedTaskIds, onSelectTask]
    );

    // PERFORMANCE OPTIMIZATION: Use passed height prop and calculate available space for tasks
    const taskRowsHeight = groupTasks.length * TASK_ROW_HEIGHT;
    const groupHeight = height; // Use the height passed from parent
    const availableTaskRowsHeight = Math.max(
      0,
      groupHeight - HEADER_HEIGHT - COLUMN_HEADER_HEIGHT - ADD_TASK_ROW_HEIGHT
    );

    // PERFORMANCE OPTIMIZATION: Limit visible columns for large lists
    const maxVisibleColumns = groupTasks.length > 50 ? 6 : 12; // Further reduce columns for large lists

    // Define all possible columns
    const allFixedColumns = [
      { key: 'drag', label: '', width: 40, alwaysVisible: true },
      { key: 'select', label: '', width: 40, alwaysVisible: true },
      { key: 'key', label: 'KEY', width: 80, fieldKey: 'KEY' },
      { key: 'task', label: 'TASK', width: 474, alwaysVisible: true },
    ];

    const allScrollableColumns = [
      { key: 'description', label: 'Description', width: 200, fieldKey: 'DESCRIPTION' },
      { key: 'progress', label: 'Progress', width: 90, fieldKey: 'PROGRESS' },
      { key: 'status', label: 'Status', width: 140, fieldKey: 'STATUS' },
      { key: 'members', label: 'Members', width: 150, fieldKey: 'ASSIGNEES' },
      { key: 'labels', label: 'Labels', width: 200, fieldKey: 'LABELS' },
      { key: 'phase', label: 'Phase', width: 100, fieldKey: 'PHASE' },
      { key: 'priority', label: 'Priority', width: 100, fieldKey: 'PRIORITY' },
      { key: 'timeTracking', label: 'Time Tracking', width: 120, fieldKey: 'TIME_TRACKING' },
      { key: 'estimation', label: 'Estimation', width: 100, fieldKey: 'ESTIMATION' },
      { key: 'startDate', label: 'Start Date', width: 120, fieldKey: 'START_DATE' },
      { key: 'dueDate', label: 'Due Date', width: 120, fieldKey: 'DUE_DATE' },
      { key: 'dueTime', label: 'Due Time', width: 100, fieldKey: 'DUE_TIME' },
      { key: 'completedDate', label: 'Completed Date', width: 130, fieldKey: 'COMPLETED_DATE' },
      { key: 'createdDate', label: 'Created Date', width: 120, fieldKey: 'CREATED_DATE' },
      { key: 'lastUpdated', label: 'Last Updated', width: 130, fieldKey: 'LAST_UPDATED' },
      { key: 'reporter', label: 'Reporter', width: 100, fieldKey: 'REPORTER' },
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
      const filtered = allScrollableColumns.filter(col => {
        // For scrollable columns, check field visibility
        if (col.fieldKey) {
          const field = taskListFields.find(f => f.key === col.fieldKey);
          return field?.visible ?? false;
        }

        return false;
      });

      // PERFORMANCE OPTIMIZATION: Limit columns for large lists
      return filtered.slice(0, maxVisibleColumns);
    }, [taskListFields, allScrollableColumns, maxVisibleColumns]);

    const fixedWidth = fixedColumns.reduce((sum, col) => sum + col.width, 0);
    const scrollableWidth = scrollableColumns.reduce((sum, col) => sum + col.width, 0);
    const totalTableWidth = fixedWidth + scrollableWidth;

    // PERFORMANCE OPTIMIZATION: Enhanced overscan for smoother scrolling experience
    const shouldVirtualize = groupTasks.length > VIRTUALIZATION_THRESHOLD;
    const overscanCount = useMemo(() => {
      if (groupTasks.length <= 20) return 5; // Small lists: 5 items overscan
      if (groupTasks.length <= 100) return 10; // Medium lists: 10 items overscan
      if (groupTasks.length <= 500) return 15; // Large lists: 15 items overscan
      return 20; // Very large lists: 20 items overscan for smooth scrolling
    }, [groupTasks.length]);

    // Build displayRows array
    const buildDisplayRows = (
      tasks: Task[],
      level: number = 0
    ): Array<
      | { type: 'task'; task: Task; level: number }
      | { type: 'add-subtask'; parentTask: Task; level: number }
    > => {
      let rows: Array<
        | { type: 'task'; task: Task; level: number }
        | { type: 'add-subtask'; parentTask: Task; level: number }
      > = [];
      tasks.forEach(task => {
        rows.push({ type: 'task', task, level });
        if (showAddSubtaskForTaskId === task.id) {
          rows.push({ type: 'add-subtask', parentTask: task, level: level + 1 });
        }
        if (task.show_sub_tasks && task.sub_tasks && task.sub_tasks.length > 0) {
          rows = rows.concat(buildDisplayRows(task.sub_tasks, level + 1));
        }
      });
      return rows;
    };

    const displayRows = useMemo(
      () => buildDisplayRows(groupTasks),
      [groupTasks, showAddSubtaskForTaskId]
    );

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const headerScrollRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<FixedSizeList>(null);

    // PERFORMANCE OPTIMIZATION: Throttled scroll handler
    const handleScroll = useCallback(() => {
      if (headerScrollRef.current && scrollContainerRef.current) {
        headerScrollRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
      }
    }, []);

    // Synchronize header scroll with body scroll
    useEffect(() => {
      const scrollDiv = scrollContainerRef.current;
      if (scrollDiv) {
        scrollDiv.addEventListener('scroll', handleScroll, { passive: true });
      }
      return () => {
        if (scrollDiv) {
          scrollDiv.removeEventListener('scroll', handleScroll);
        }
      };
    }, [handleScroll]);

    // If group is collapsed, show only header
    if (isCollapsed) {
      return (
        <div
          className="virtualized-task-list collapsed"
          style={{ height: HEADER_HEIGHT, position: 'relative' }}
        >
          {/* Sticky Group Color Border */}
          <div
            className="sticky-group-border"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              backgroundColor: group.color || '#f0f0f0',
              zIndex: 15,
              pointerEvents: 'none',
            }}
          />

          {/* Group Header */}
          <div className="task-group-header" style={{ height: HEADER_HEIGHT }}>
            <div className="task-group-header-row">
              <div
                className="task-group-header-content"
                style={{
                  backgroundColor: group.color || '#f0f0f0',
                  // No margin - header should overlap the sticky border
                }}
              >
                <Button
                  type="text"
                  icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
                  onClick={handleToggleCollapse}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToggleCollapse();
                    }
                  }}
                  className="task-group-collapse-button"
                  aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                  title={isCollapsed ? 'Click to expand group' : 'Click to collapse group'}
                  style={{
                    color: 'white',
                    border: 'none',
                    background: 'transparent',
                    padding: '4px',
                    marginRight: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
                <span className="task-group-header-text">
                  {group.title} ({groupTasks.length})
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="virtualized-task-list" style={{ height: groupHeight, position: 'relative' }}>
        {/* Sticky Group Color Border */}
        <div
          className="sticky-group-border"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '4px',
            backgroundColor: group.color || '#f0f0f0',
            zIndex: 15,
            pointerEvents: 'none',
          }}
        />

        {/* Group Header */}
        <div className="task-group-header" style={{ height: HEADER_HEIGHT }}>
          <div className="task-group-header-row">
            <div
              className="task-group-header-content"
              style={{
                backgroundColor: group.color || '#f0f0f0',
                // No margin - header should overlap the sticky border
              }}
            >
              <Button
                type="text"
                icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
                onClick={handleToggleCollapse}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggleCollapse();
                  }
                }}
                className="task-group-collapse-button"
                aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                title={isCollapsed ? 'Click to expand group' : 'Click to collapse group'}
                style={{
                  color: 'white',
                  border: 'none',
                  background: 'transparent',
                  padding: '4px',
                  marginRight: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
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
            style={{
              marginLeft: '4px',
              minWidth: totalTableWidth,
              display: 'flex',
              position: 'relative',
            }}
          >
            <div
              className="task-table-fixed-columns fixed-columns-header"
              style={{
                display: 'flex',
                position: 'sticky',
                left: 0,
                zIndex: 12,
                background: isDarkMode
                  ? 'var(--task-bg-secondary, #141414)'
                  : 'var(--task-bg-secondary, #f5f5f5)',
                width: fixedWidth,
                borderRight:
                  scrollableColumns.length > 0
                    ? '2px solid var(--task-border-primary, #e8e8e8)'
                    : 'none',
                boxShadow: scrollableColumns.length > 0 ? '2px 0 4px rgba(0, 0, 0, 0.1)' : 'none',
              }}
            >
              {fixedColumns.map(col => (
                <div
                  key={col.key}
                  className="task-table-cell task-table-header-cell fixed-column"
                  style={{ width: col.width }}
                >
                  {col.key === 'select' ? (
                    <div className="flex items-center justify-center h-full">
                      <Checkbox
                        checked={selectionState.isAllSelected}
                        onChange={handleSelectAllInGroup}
                        isDarkMode={isDarkMode}
                        indeterminate={selectionState.isIndeterminate}
                      />
                    </div>
                  ) : (
                    <span className="column-header-text">{col.label}</span>
                  )}
                </div>
              ))}
            </div>
            <div
              className="scrollable-columns-header"
              style={{ display: 'flex', minWidth: scrollableWidth }}
            >
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
            height: groupTasks.length > 0 ? availableTaskRowsHeight : 'auto',
            contain: 'layout style', // CSS containment for better performance
          }}
        >
          <SortableContext items={group.taskIds} strategy={verticalListSortingStrategy}>
            {shouldVirtualize ? (
              <List
                height={availableTaskRowsHeight}
                itemCount={displayRows.length}
                itemSize={TASK_ROW_HEIGHT}
                width={totalTableWidth}
                ref={listRef}
                overscanCount={overscanCount}
              >
                {({ index, style }) => {
                  const row = displayRows[index];
                  if (row.type === 'task') {
                    return (
                      <div style={style} key={row.task.id}>
                        <TaskRow
                          task={row.task}
                          projectId={projectId}
                          groupId={group.id}
                          currentGrouping={currentGrouping}
                          isSelected={selectedTaskIds.includes(row.task.id)}
                          index={index}
                          onSelect={onSelectTask}
                          onToggleSubtasks={onToggleSubtasks}
                          fixedColumns={fixedColumns}
                          scrollableColumns={scrollableColumns}
                          onExpandSubtaskInput={() => setShowAddSubtaskForTaskId(row.task.id)}
                        />
                      </div>
                    );
                  }
                  if (row.type === 'add-subtask') {
                    return (
                      <div
                        style={style}
                        key={row.parentTask.id + '-add-subtask'}
                        className={`add-subtask-row visible ${isDarkMode ? 'dark' : ''}`}
                      >
                        <div className="task-row-container flex h-10 max-h-10 relative w-full">
                          <div className="task-table-all-columns flex w-full">
                            {(fixedColumns ?? []).map((col, index) => {
                              const borderClasses = `border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`;
                              if (col.key === 'task') {
                                return (
                                  <div
                                    key={col.key}
                                    className={`flex items-center px-2 ${borderClasses}`}
                                    style={{ width: col.width }}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0 pl-6">
                                      <Input
                                        ref={addSubtaskInputRef}
                                        placeholder={t('enterSubtaskName')}
                                        value={newSubtaskName}
                                        onChange={e => setNewSubtaskName(e.target.value)}
                                        onPressEnter={() => handleAddSubtask(row.parentTask.id)}
                                        onBlur={handleCancelAddSubtask}
                                        className={`add-subtask-input flex-1 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                                        size="small"
                                        autoFocus
                                      />
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div
                                    key={col.key}
                                    className={`flex items-center px-2 ${borderClasses}`}
                                    style={{ width: col.width }}
                                  />
                                );
                              }
                            })}
                            {(scrollableColumns ?? []).map((col, index) => {
                              const borderClasses = `border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`;
                              return (
                                <div
                                  key={col.key}
                                  className={`flex items-center px-2 ${borderClasses}`}
                                  style={{ width: col.width }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              </List>
            ) : (
              // PERFORMANCE OPTIMIZATION: Use React.Fragment to reduce DOM nodes
              <React.Fragment>
                {displayRows.map((row, idx) => {
                  if (row.type === 'task') {
                    return (
                      <TaskRow
                        key={row.task.id}
                        task={row.task}
                        projectId={projectId}
                        groupId={group.id}
                        currentGrouping={currentGrouping}
                        isSelected={selectedTaskIds.includes(row.task.id)}
                        index={idx}
                        onSelect={onSelectTask}
                        onToggleSubtasks={(taskId: string) => {
                          const task = tasksById[taskId];
                          if (
                            task &&
                            !task.show_sub_tasks &&
                            task.sub_tasks_count &&
                            task.sub_tasks_count > 0 &&
                            (!task.sub_tasks || task.sub_tasks.length === 0)
                          ) {
                            dispatch(fetchSubTasks({ taskId, projectId }));
                          }
                          dispatch(toggleTaskExpansion(taskId));
                        }}
                        fixedColumns={fixedColumns}
                        scrollableColumns={scrollableColumns}
                        onExpandSubtaskInput={() => setShowAddSubtaskForTaskId(row.task.id)}
                        level={row.level}
                      />
                    );
                  }
                  if (row.type === 'add-subtask') {
                    return (
                      <div
                        key={row.parentTask.id + '-add-subtask'}
                        className={`add-subtask-row visible ${isDarkMode ? 'dark' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', minHeight: 40 }}
                      >
                        <div className="task-row-container flex h-10 max-h-10 relative w-full">
                          <div className="task-table-all-columns flex w-full">
                            {(fixedColumns ?? []).map((col, index) => {
                              const borderClasses = `border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`;
                              if (col.key === 'task') {
                                return (
                                  <div
                                    key={col.key}
                                    className={`flex items-center px-2 ${borderClasses}`}
                                    style={{ width: col.width }}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0 pl-6">
                                      <Input
                                        ref={addSubtaskInputRef}
                                        placeholder={t('enterSubtaskName')}
                                        value={newSubtaskName}
                                        onChange={e => setNewSubtaskName(e.target.value)}
                                        onPressEnter={() => handleAddSubtask(row.parentTask.id)}
                                        onBlur={handleCancelAddSubtask}
                                        className={`add-subtask-input flex-1 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                                        size="small"
                                        autoFocus
                                      />
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div
                                    key={col.key}
                                    className={`flex items-center px-2 ${borderClasses}`}
                                    style={{ width: col.width }}
                                  />
                                );
                              }
                            })}
                            {(scrollableColumns ?? []).map((col, index) => {
                              const borderClasses = `border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`;
                              return (
                                <div
                                  key={col.key}
                                  className={`flex items-center px-2 ${borderClasses}`}
                                  style={{ width: col.width }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </React.Fragment>
            )}
          </SortableContext>
        </div>
        {/* Add Task Row - Always show at the bottom */}
        <div
          className="task-group-add-task"
          style={{ marginLeft: '4px', height: ADD_TASK_ROW_HEIGHT }}
        >
          <AddTaskListRow groupId={group.id} />
        </div>
        <style>{`
        .virtualized-task-list {
          border: 1px solid var(--task-border-primary, #e8e8e8);
          border-radius: 8px;
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
          font-size: 14px !important;
          font-weight: 600 !important;
          margin: 0 !important;
        }
        /* Collapse button styles */
        .task-group-collapse-button {
          transition: all 0.2s ease;
          border-radius: 4px;
          min-width: 24px;
          height: 24px;
        }
        .task-group-collapse-button:hover {
          background-color: rgba(255, 255, 255, 0.15) !important;
          transform: scale(1.05);
        }
        .task-group-collapse-button:active {
          transform: scale(0.95);
        }
        .task-group-collapse-button .anticon {
          font-size: 12px;
          transition: transform 0.2s ease;
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
        /* Add task row styles - Fixed width responsive design */
        .task-group-add-task {
          background: var(--task-bg-primary, white);
          border-top: 1px solid var(--task-border-secondary, #f0f0f0);
          transition: all 0.3s ease;
          padding: 0 12px;
          width: 100%;
          max-width: 500px; /* Fixed maximum width */
          min-width: 300px; /* Minimum width for mobile */
          min-height: 40px;
          display: flex;
          align-items: center;
          flex-shrink: 0;
          border-radius: 0 0 6px 6px;
          margin-left: 0;
          position: relative;
        }
        .task-group-add-task:hover {
          background: var(--task-hover-bg, #fafafa);
          transform: translateX(2px);
        }
        
        /* Responsive adjustments for add task row */
        @media (max-width: 768px) {
          .task-group-add-task {
            max-width: 400px;
            min-width: 280px;
          }
        }

        @media (max-width: 480px) {
          .task-group-add-task {
            max-width: calc(100vw - 40px);
            min-width: 250px;
          }
        }

        @media (min-width: 1200px) {
          .task-group-add-task {
            max-width: 600px;
          }
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
          will-change: scroll-position;
        }
        .task-row-container {
          contain: layout style;
          will-change: transform;
        }
        .react-window-list {
          contain: strict;
        }
        /* Reduce repaints during scrolling */
        .task-list-scroll-container {
          contain: layout style;
          transform: translateZ(0); /* Force GPU layer */
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
  }
);

export default VirtualizedTaskList;
