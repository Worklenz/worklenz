import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSelector, useDispatch } from 'react-redux';
import {
  Button,
  Typography,
  taskManagementAntdConfig,
  PlusOutlined,
  RightOutlined,
  DownOutlined,
} from '@/shared/antd-imports';
import { TaskGroup as TaskGroupType, Task } from '@/types/task-management.types';
import {
  taskManagementSelectors,
  selectAllTasks,
} from '@/features/task-management/task-management.slice';
import { RootState } from '@/app/store';
import TaskRow from './task-row';
import AddTaskListRow from '@/pages/projects/projectView/taskList/task-list-table/task-list-table-rows/add-task-list-row';
import { TaskListField } from '@/features/task-management/taskListFields.slice';
import { Checkbox } from '@/components';
import {
  selectIsGroupCollapsed,
  toggleGroupCollapsed,
} from '@/features/task-management/grouping.slice';
import { selectIsTaskSelected } from '@/features/task-management/selection.slice';
import { Draggable } from 'react-beautiful-dnd';

const { Text } = Typography;

interface TaskGroupProps {
  group: TaskGroupType;
  projectId: string;
  currentGrouping: 'status' | 'priority' | 'phase';
  selectedTaskIds: string[];
  onAddTask?: (groupId: string) => void;
  onToggleCollapse?: (groupId: string) => void;
  onSelectTask?: (taskId: string, selected: boolean) => void;
  onToggleSubtasks?: (taskId: string) => void;
}

// Group color mapping - moved outside component for better performance
const GROUP_COLORS = {
  status: {
    todo: '#faad14',
    doing: '#1890ff',
    done: '#52c41a',
  },
  priority: {
    high: '#fa8c16',
    medium: '#faad14',
    low: '#52c41a',
  },
  phase: '#722ed1',
  default: '#d9d9d9',
} as const;

const TaskGroup: React.FC<TaskGroupProps> = React.memo(
  ({
    group,
    projectId,
    currentGrouping,
    selectedTaskIds,
    onAddTask,
    onToggleCollapse,
    onSelectTask,
    onToggleSubtasks,
  }) => {
    const dispatch = useDispatch();
    const [isCollapsed, setIsCollapsed] = useState(group.collapsed || false);

    const { setNodeRef, isOver } = useDroppable({
      id: group.id,
      data: {
        type: 'group',
        groupId: group.id,
      },
    });

    // Get all tasks from the store
    const allTasks = useSelector(selectAllTasks);

    // Get theme from Redux store
    const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');

    // Get field visibility from taskListFields slice
    const taskListFields = useSelector(
      (state: RootState) => state.taskManagementFields
    ) as TaskListField[];

    // Define all possible columns
    const allFixedColumns = [
      { key: 'drag', label: '', width: 40, alwaysVisible: true },
      { key: 'select', label: '', width: 40, alwaysVisible: true },
      { key: 'key', label: 'KEY', width: 80, fieldKey: 'KEY' },
      { key: 'task', label: 'TASK', width: 220, alwaysVisible: true },
    ];

    const allScrollableColumns = [
      { key: 'description', label: 'Description', width: 200, fieldKey: 'DESCRIPTION' },
      { key: 'progress', label: 'Progress', width: 90, fieldKey: 'PROGRESS' },
      { key: 'status', label: 'Status', width: 100, fieldKey: 'STATUS' },
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
    const visibleFixedColumns = useMemo(() => {
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

    const visibleScrollableColumns = useMemo(() => {
      return allScrollableColumns.filter(col => {
        // For scrollable columns, check field visibility
        if (col.fieldKey) {
          const field = taskListFields.find(f => f.key === col.fieldKey);
          return field?.visible ?? false;
        }

        return false;
      });
    }, [taskListFields, allScrollableColumns]);

    // Get tasks for this group using memoization for performance
    const groupTasks = useMemo(() => {
      return group.taskIds
        .map(taskId => allTasks.find(task => task.id === taskId))
        .filter((task): task is Task => task !== undefined);
    }, [group.taskIds, allTasks]);

    // Calculate group statistics - memoized
    const { completedTasks, totalTasks, completionRate } = useMemo(() => {
      const completed = groupTasks.filter(task => task.progress === 100).length;
      const total = groupTasks.length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        completedTasks: completed,
        totalTasks: total,
        completionRate: rate,
      };
    }, [groupTasks]);

    // Calculate selection state for the group checkbox
    const { isAllSelected, isIndeterminate } = useMemo(() => {
      if (groupTasks.length === 0) {
        return { isAllSelected: false, isIndeterminate: false };
      }

      const selectedTasksInGroup = groupTasks.filter(task => selectedTaskIds.includes(task.id));
      const isAllSelected = selectedTasksInGroup.length === groupTasks.length;
      const isIndeterminate =
        selectedTasksInGroup.length > 0 && selectedTasksInGroup.length < groupTasks.length;

      return { isAllSelected, isIndeterminate };
    }, [groupTasks, selectedTaskIds]);

    // Get group color based on grouping type - memoized
    const groupColor = useMemo(() => {
      if (group.color) return group.color;

      // Fallback colors based on group value
      switch (currentGrouping) {
        case 'status':
          return (
            GROUP_COLORS.status[group.groupValue as keyof typeof GROUP_COLORS.status] ||
            GROUP_COLORS.default
          );
        case 'priority':
          return (
            GROUP_COLORS.priority[group.groupValue as keyof typeof GROUP_COLORS.priority] ||
            GROUP_COLORS.default
          );
        case 'phase':
          return GROUP_COLORS.phase;
        default:
          return GROUP_COLORS.default;
      }
    }, [group.color, group.groupValue, currentGrouping]);

    // Memoized event handlers
    const handleToggleCollapse = useCallback(() => {
      setIsCollapsed(!isCollapsed);
      onToggleCollapse?.(group.id);
    }, [isCollapsed, onToggleCollapse, group.id]);

    const handleAddTask = useCallback(() => {
      onAddTask?.(group.id);
    }, [onAddTask, group.id]);

    // Handle select all tasks in group
    const handleSelectAllInGroup = useCallback(
      (checked: boolean) => {
        if (checked) {
          // Select all tasks in the group
          groupTasks.forEach(task => {
            if (!selectedTaskIds.includes(task.id)) {
              onSelectTask?.(task.id, true);
            }
          });
        } else {
          // Deselect all tasks in the group
          groupTasks.forEach(task => {
            if (selectedTaskIds.includes(task.id)) {
              onSelectTask?.(task.id, false);
            }
          });
        }
      },
      [groupTasks, selectedTaskIds, onSelectTask]
    );

    // Memoized style object
    const containerStyle = useMemo(
      () => ({
        backgroundColor: isOver ? (isDarkMode ? '#1a2332' : '#f0f8ff') : undefined,
      }),
      [isOver, isDarkMode]
    );

    return (
      <div className={`task-group`} style={{ ...containerStyle, overflowX: 'unset' }}>
        <div className="task-group-scroll-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
          <div
            style={{
              minWidth:
                visibleFixedColumns.reduce((sum, col) => sum + col.width, 0) +
                visibleScrollableColumns.reduce((sum, col) => sum + col.width, 0),
            }}
          >
            {/* Group Header Row */}
            <div className="task-group-header">
              <div className="task-group-header-row">
                <div className="task-group-header-content" style={{ backgroundColor: groupColor }}>
                  <Button
                    {...taskManagementAntdConfig.taskButtonDefaults}
                    icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
                    onClick={handleToggleCollapse}
                    className="task-group-header-button"
                  />
                  <Text strong className="task-group-header-text">
                    {group.title} ({totalTasks})
                  </Text>
                </div>
              </div>
            </div>

            {/* Column Headers */}
            {!isCollapsed && totalTasks > 0 && (
              <div
                className="task-group-column-headers"
                style={{ borderLeft: `4px solid ${groupColor}` }}
              >
                <div className="task-group-column-headers-row">
                  <div className="task-table-fixed-columns">
                    {visibleFixedColumns.map(col => (
                      <div
                        key={col.key}
                        className="task-table-cell task-table-header-cell"
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
                          col.label && <Text className="column-header-text">{col.label}</Text>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="task-table-scrollable-columns">
                    {visibleScrollableColumns.map(col => (
                      <div
                        key={col.key}
                        className="task-table-cell task-table-header-cell"
                        style={{ width: col.width }}
                      >
                        <Text className="column-header-text">{col.label}</Text>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tasks List */}
            {!isCollapsed && (
              <div className="task-group-body" style={{ borderLeft: `4px solid ${groupColor}` }}>
                {groupTasks.length === 0 ? (
                  <div className="task-group-empty">
                    <div className="task-table-fixed-columns">
                      <div style={{ width: '380px', padding: '32px 12px' }}>
                        <div className="text-center text-gray-500">
                          <Text type="secondary">No tasks in this group</Text>
                          <br />
                          <Button
                            {...taskManagementAntdConfig.taskButtonDefaults}
                            icon={<PlusOutlined />}
                            onClick={handleAddTask}
                            className="mt-2"
                          >
                            Add first task
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <SortableContext items={group.taskIds} strategy={verticalListSortingStrategy}>
                    <div className="task-group-tasks">
                      {groupTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`task-row-wrapper ${snapshot.isDragging ? 'dragging' : ''}`}
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
                                fixedColumns={visibleFixedColumns}
                                scrollableColumns={visibleScrollableColumns}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </div>
                  </SortableContext>
                )}

                {/* Add Task Row - Always show when not collapsed */}
                <div className="task-group-add-task">
                  <AddTaskListRow groupId={group.id} />
                </div>
              </div>
            )}
          </div>
        </div>
        <style>{`
        .task-group {
          border: 1px solid var(--task-border-primary, #e8e8e8);
          border-radius: 8px;
          margin-bottom: 16px;
          background: var(--task-bg-primary, white);
          box-shadow: 0 1px 3px var(--task-shadow, rgba(0, 0, 0, 0.1));
          overflow-y: visible;
          transition: all 0.3s ease;
          position: relative;
        }

        .task-group:last-child {
          margin-bottom: 0;
        }

        .task-group-header {
          background: var(--task-bg-primary, white);
          transition: background-color 0.3s ease;
        }

        .task-group-header-row {
          display: flex;
          height: auto;
          max-height: none;
          overflow: hidden;
        }

        .task-group-header-content {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 6px 6px 0 0;
          background-color: #f0f0f0;
          color: white;
          font-weight: 500;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
        }

        .task-group-header-button {
          color: white !important;
          padding: 0 !important;
          width: 16px !important;
          height: 16px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-right: 8px !important;
          border: none !important;
          background: transparent !important;
        }

        .task-group-header-button:hover {
          background: rgba(255, 255, 255, 0.2) !important;
          border-radius: 2px !important;
        }

        .task-group-header-text {
          color: white !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          margin: 0 !important;
        }

        .task-group-progress {
          display: flex;
          height: 20px;
          align-items: center;
          background: var(--task-bg-tertiary, #f8f9fa);
          border-bottom: 1px solid var(--task-border-primary, #e8e8e8);
          transition: background-color 0.3s ease;
        }

        .task-group-column-headers {
          background: var(--task-bg-secondary, #f5f5f5);
          border-bottom: 1px solid var(--task-border-tertiary, #d9d9d9);
          transition: background-color 0.3s ease;
        }

        .task-group-column-headers-row {
          display: flex;
          height: 40px;
          max-height: 40px;
          overflow: visible;
          position: relative;
        }

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

        .task-group-body {
          background: var(--task-bg-primary, white);
          transition: background-color 0.3s ease;
          overflow: visible;
          position: relative;
        }

        .task-group-empty {
          display: flex;
          height: 120px;
          align-items: center;
          background: var(--task-bg-primary, white);
          transition: background-color 0.3s ease;
        }

        .task-group-tasks {
          background: var(--task-bg-primary, white);
          transition: background-color 0.3s ease;
          overflow: visible;
          position: relative;
        }

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
          border-right: 2px solid var(--task-border-primary, #e8e8e8);
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
          border-bottom: 1px solid var(--task-border-secondary, #f0f0f0);
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

        /* Add row border styling for task rows */
        .task-group-tasks > div {
          border-bottom: 1px solid var(--task-border-secondary, #f0f0f0);
          transition: border-color 0.3s ease;
        }

        .task-group-tasks > div:last-child {
          border-bottom: none;
        }

        /* Ensure fixed columns also have bottom borders */
        .fixed-columns-row > div {
          border-bottom: 1px solid var(--task-border-secondary, #f0f0f0);
          transition: border-color 0.3s ease;
        }

        .scrollable-columns-row > div {
          border-bottom: 1px solid var(--task-border-secondary, #f0f0f0);
          transition: border-color 0.3s ease;
        }

        /* Dark mode border adjustments */
        .dark .task-table-cell,
        [data-theme="dark"] .task-table-cell {
          border-right-color: var(--task-border-secondary, #374151);
          border-bottom-color: var(--task-border-secondary, #374151);
        }

        .dark .task-group-tasks > div,
        [data-theme="dark"] .task-group-tasks > div {
          border-bottom-color: var(--task-border-secondary, #374151);
        }

        .dark .fixed-columns-row > div,
        [data-theme="dark"] .fixed-columns-row > div {
          border-bottom-color: var(--task-border-secondary, #374151);
        }

        .dark .scrollable-columns-row > div,
        [data-theme="dark"] .scrollable-columns-row > div {
          border-bottom-color: var(--task-border-secondary, #374151);
        }

        .drag-over {
          background-color: var(--task-drag-over-bg, #f0f8ff) !important;
          border-color: var(--task-drag-over-border, #40a9ff) !important;
        }

        /* Ensure buttons and components fit within row height */
        .task-group .ant-btn {
          height: auto;
          max-height: 32px;
          line-height: 1.2;
        }

        .task-group .ant-badge {
          height: auto;
          line-height: 1.2;
        }

        /* Dark mode specific adjustments */
        .dark .task-group,
        [data-theme="dark"] .task-group {
          box-shadow: 0 1px 3px var(--task-shadow, rgba(0, 0, 0, 0.3));
        }
      `}</style>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // More comprehensive comparison to detect task movements
    return (
      prevProps.group.id === nextProps.group.id &&
      prevProps.group.taskIds.length === nextProps.group.taskIds.length &&
      prevProps.group.taskIds.every((id, index) => id === nextProps.group.taskIds[index]) &&
      prevProps.group.collapsed === nextProps.group.collapsed &&
      prevProps.selectedTaskIds.length === nextProps.selectedTaskIds.length &&
      prevProps.currentGrouping === nextProps.currentGrouping
    );
  }
);

TaskGroup.displayName = 'TaskGroup';

export default TaskGroup;
