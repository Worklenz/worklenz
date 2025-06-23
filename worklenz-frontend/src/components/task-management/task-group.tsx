import React, { useState, useMemo, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSelector } from 'react-redux';
import { Button, Typography } from 'antd';
import { PlusOutlined, RightOutlined, DownOutlined } from '@ant-design/icons';
import { TaskGroup as TaskGroupType, Task } from '@/types/task-management.types';
import { taskManagementSelectors } from '@/features/task-management/task-management.slice';
import { RootState } from '@/app/store';
import TaskRow from './task-row';
import AddTaskListRow from '@/pages/projects/projectView/taskList/task-list-table/task-list-table-rows/add-task-list-row';

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
    critical: '#ff4d4f',
    high: '#fa8c16',
    medium: '#faad14',
    low: '#52c41a',
  },
  phase: '#722ed1',
  default: '#d9d9d9',
} as const;

const TaskGroup: React.FC<TaskGroupProps> = React.memo(({
  group,
  projectId,
  currentGrouping,
  selectedTaskIds,
  onAddTask,
  onToggleCollapse,
  onSelectTask,
  onToggleSubtasks,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(group.collapsed || false);

  const { setNodeRef, isOver } = useDroppable({
    id: group.id,
    data: {
      type: 'group',
      groupId: group.id,
    },
  });

  // Get all tasks from the store
  const allTasks = useSelector(taskManagementSelectors.selectAll);
  
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

  // Get group color based on grouping type - memoized
  const groupColor = useMemo(() => {
    if (group.color) return group.color;

    // Fallback colors based on group value
    switch (currentGrouping) {
      case 'status':
        return GROUP_COLORS.status[group.groupValue as keyof typeof GROUP_COLORS.status] || GROUP_COLORS.default;
      case 'priority':
        return GROUP_COLORS.priority[group.groupValue as keyof typeof GROUP_COLORS.priority] || GROUP_COLORS.default;
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

  // Memoized style object
  const containerStyle = useMemo(() => ({
    backgroundColor: isOver ? '#f0f8ff' : undefined,
  }), [isOver]);

  return (
    <div
      ref={setNodeRef}
      className={`task-group ${isOver ? 'drag-over' : ''}`}
      style={containerStyle}
    >
      {/* Group Header Row */}
      <div className="task-group-header">
        <div className="task-group-header-row">
          <div 
            className="task-group-header-content"
            style={{ backgroundColor: groupColor }}
          >
            <Button
              type="text"
              size="small"
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
              <div
                className="task-table-cell task-table-header-cell"
                style={{ width: '40px' }}
              ></div>
              <div
                className="task-table-cell task-table-header-cell"
                style={{ width: '40px' }}
              ></div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '80px' }}>
                <Text className="column-header-text">Key</Text>
              </div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '475px' }}>
                <Text className="column-header-text">Task</Text>
              </div>
            </div>
            <div className="task-table-scrollable-columns">
              <div className="task-table-cell task-table-header-cell" style={{ width: '90px' }}>
                <Text className="column-header-text">Progress</Text>
              </div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '150px' }}>
                <Text className="column-header-text">Members</Text>
              </div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '200px' }}>
                <Text className="column-header-text">Labels</Text>
              </div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '100px' }}>
                <Text className="column-header-text">Status</Text>
              </div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '100px' }}>
                <Text className="column-header-text">Priority</Text>
              </div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '120px' }}>
                <Text className="column-header-text">Time Tracking</Text>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tasks List */}
      {!isCollapsed && (
        <div 
          className="task-group-body"
          style={{ borderLeft: `4px solid ${groupColor}` }}
        >
          {groupTasks.length === 0 ? (
            <div className="task-group-empty">
              <div className="task-table-fixed-columns">
                <div style={{ width: '380px', padding: '20px 12px' }}>
                  <div className="text-center text-gray-500">
                    <Text type="secondary">No tasks in this group</Text>
                    <br />
                    <Button
                      type="link"
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
                  <TaskRow
                    key={task.id}
                    task={task}
                    projectId={projectId}
                    groupId={group.id}
                    currentGrouping={currentGrouping}
                    isSelected={selectedTaskIds.includes(task.id)}
                    index={index}
                    onSelect={onSelectTask}
                    onToggleSubtasks={onToggleSubtasks}
                  />
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

      <style>{`
        .task-group {
          border: 1px solid var(--task-border-primary, #e8e8e8);
          border-radius: 8px;
          margin-bottom: 16px;
          background: var(--task-bg-primary, white);
          box-shadow: 0 1px 3px var(--task-shadow, rgba(0, 0, 0, 0.1));
          overflow-x: auto;
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
          display: inline-flex;
          height: auto;
          max-height: none;
          overflow: hidden;
        }

        .task-group-header-content {
          display: inline-flex;
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
          font-size: 13px !important;
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
          min-width: 1200px; /* Ensure minimum width for all columns */
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
          height: 80px;
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
          min-height: 40px;
          display: flex;
          align-items: center;
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
}, (prevProps, nextProps) => {
  // Simplified comparison for better performance
  return (
    prevProps.group.id === nextProps.group.id &&
    prevProps.group.taskIds.length === nextProps.group.taskIds.length &&
    prevProps.group.collapsed === nextProps.group.collapsed &&
    prevProps.selectedTaskIds.length === nextProps.selectedTaskIds.length &&
    prevProps.currentGrouping === nextProps.currentGrouping
  );
});

TaskGroup.displayName = 'TaskGroup';

export default TaskGroup;
