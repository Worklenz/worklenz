import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSelector } from 'react-redux';
import { Button, Typography } from 'antd';
import { PlusOutlined, RightOutlined, DownOutlined } from '@ant-design/icons';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { IGroupBy, COLUMN_KEYS } from '@/features/tasks/tasks.slice';
import { RootState } from '@/app/store';
import TaskRow from './task-row';
import AddTaskListRow from '@/pages/projects/projectView/taskList/task-list-table/task-list-table-rows/add-task-list-row';

const { Text } = Typography;

interface TaskGroupProps {
  group: ITaskListGroup;
  projectId: string;
  currentGrouping: IGroupBy;
  selectedTaskIds: string[];
  onAddTask?: (groupId: string) => void;
  onToggleCollapse?: (groupId: string) => void;
  onSelectTask?: (taskId: string, selected: boolean) => void;
  onToggleSubtasks?: (taskId: string) => void;
}

const TaskGroup: React.FC<TaskGroupProps> = ({
  group,
  projectId,
  currentGrouping,
  selectedTaskIds,
  onAddTask,
  onToggleCollapse,
  onSelectTask,
  onToggleSubtasks,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: group.id,
    data: {
      type: 'group',
      groupId: group.id,
    },
  });

  // Get column visibility from Redux store
  const columns = useSelector((state: RootState) => state.taskReducer.columns);

  // Helper function to check if a column is visible
  const isColumnVisible = (columnKey: string) => {
    const column = columns.find(col => col.key === columnKey);
    return column ? column.pinned : true; // Default to visible if column not found
  };

  // Get task IDs for sortable context
  const taskIds = group.tasks.map(task => task.id!);

  // Calculate group statistics
  const completedTasks = group.tasks.filter(
    task => task.status_category?.is_done || task.complete_ratio === 100
  ).length;
  const totalTasks = group.tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get group color based on grouping type
  const getGroupColor = () => {
    if (group.color_code) return group.color_code;

    // Fallback colors based on group value
    switch (currentGrouping) {
      case 'status':
        return group.id === 'todo' ? '#faad14' : group.id === 'doing' ? '#1890ff' : '#52c41a';
      case 'priority':
        return group.id === 'critical'
          ? '#ff4d4f'
          : group.id === 'high'
            ? '#fa8c16'
            : group.id === 'medium'
              ? '#faad14'
              : '#52c41a';
      case 'phase':
        return '#722ed1';
      default:
        return '#d9d9d9';
    }
  };

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    onToggleCollapse?.(group.id);
  };

  const handleAddTask = () => {
    onAddTask?.(group.id);
  };

  return (
    <div
      ref={setNodeRef}
      className={`task-group ${isOver ? 'drag-over' : ''}`}
      style={{
        backgroundColor: isOver ? '#f0f8ff' : undefined,
      }}
    >
      {/* Group Header Row */}
      <div className="task-group-header">
        <div className="task-group-header-row">
          <div 
            className="task-group-header-content"
            style={{ backgroundColor: getGroupColor() }}
          >
            <Button
              type="text"
              size="small"
              icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
              onClick={handleToggleCollapse}
              className="task-group-header-button"
            />
            <Text strong className="task-group-header-text">
              {group.name} ({totalTasks})
            </Text>
          </div>
        </div>
      </div>

      {/* Column Headers */}
      {!isCollapsed && totalTasks > 0 && (
        <div 
          className="task-group-column-headers"
          style={{ borderLeft: `4px solid ${getGroupColor()}` }}
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
              {isColumnVisible(COLUMN_KEYS.PROGRESS) && (
                <div className="task-table-cell task-table-header-cell" style={{ width: '90px' }}>
                  <Text className="column-header-text">Progress</Text>
                </div>
              )}
              {isColumnVisible(COLUMN_KEYS.ASSIGNEES) && (
                <div className="task-table-cell task-table-header-cell" style={{ width: '150px' }}>
                  <Text className="column-header-text">Members</Text>
                </div>
              )}
              {isColumnVisible(COLUMN_KEYS.LABELS) && (
                <div className="task-table-cell task-table-header-cell" style={{ width: '150px' }}>
                  <Text className="column-header-text">Labels</Text>
                </div>
              )}
              {isColumnVisible(COLUMN_KEYS.STATUS) && (
                <div className="task-table-cell task-table-header-cell" style={{ width: '100px' }}>
                  <Text className="column-header-text">Status</Text>
                </div>
              )}
              {isColumnVisible(COLUMN_KEYS.PRIORITY) && (
                <div className="task-table-cell task-table-header-cell" style={{ width: '100px' }}>
                  <Text className="column-header-text">Priority</Text>
                </div>
              )}
              {isColumnVisible(COLUMN_KEYS.TIME_TRACKING) && (
                <div className="task-table-cell task-table-header-cell" style={{ width: '120px' }}>
                  <Text className="column-header-text">Time Tracking</Text>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tasks List */}
      {!isCollapsed && (
        <div 
          className="task-group-body"
          style={{ borderLeft: `4px solid ${getGroupColor()}` }}
        >
          {group.tasks.length === 0 ? (
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
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              <div className="task-group-tasks">
                {group.tasks.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    projectId={projectId}
                    groupId={group.id}
                    currentGrouping={currentGrouping}
                    isSelected={selectedTaskIds.includes(task.id!)}
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
};

export default TaskGroup;
