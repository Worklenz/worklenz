import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, Typography, Badge, Space, Tooltip } from 'antd';
import {
  CaretRightOutlined,
  CaretDownOutlined,
  PlusOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { IGroupBy } from '@/features/tasks/tasks.slice';
import TaskRow from './TaskRow';

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

  // Get task IDs for sortable context
  const taskIds = group.tasks.map(task => task.id!);

  // Calculate group statistics
  const completedTasks = group.tasks.filter(task => 
    task.status_category?.is_done || task.complete_ratio === 100
  ).length;
  const totalTasks = group.tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get group color based on grouping type
  const getGroupColor = () => {
    if (group.color_code) return group.color_code;
    
    // Fallback colors based on group value
    switch (currentGrouping) {
      case 'status':
        return group.id === 'todo' ? '#faad14' : 
               group.id === 'doing' ? '#1890ff' : '#52c41a';
      case 'priority':
        return group.id === 'critical' ? '#ff4d4f' :
               group.id === 'high' ? '#fa8c16' :
               group.id === 'medium' ? '#faad14' : '#52c41a';
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
          <div className="task-table-fixed-columns">
            <div className="task-table-cell task-table-cell-drag" style={{ width: '40px' }}>
              <Button
                type="text"
                size="small"
                icon={isCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
                onClick={handleToggleCollapse}
                className="p-0 w-6 h-6 flex items-center justify-center"
              />
            </div>
            <div className="task-table-cell task-table-cell-checkbox" style={{ width: '40px' }}>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getGroupColor() }}
              />
            </div>
            <div className="task-table-cell task-table-cell-key" style={{ width: '80px' }}></div>
            <div className="task-table-cell task-table-cell-task" style={{ width: '220px' }}>
              <div className="flex items-center space-x-2 flex-1">
                <Text strong className="text-sm">
                  {group.name}
                </Text>
                <Badge count={totalTasks} showZero style={{ backgroundColor: '#f0f0f0', color: '#666' }} />
                {completionRate > 0 && (
                  <Text type="secondary" className="text-xs">
                    {completionRate}% complete
                  </Text>
                )}
              </div>
            </div>
          </div>
          <div className="task-table-scrollable-columns">
            <div className="task-table-cell" style={{ width: '120px' }}></div>
            <div className="task-table-cell" style={{ width: '150px' }}></div>
            <div className="task-table-cell" style={{ width: '150px' }}></div>
            <div className="task-table-cell" style={{ width: '100px' }}></div>
            <div className="task-table-cell" style={{ width: '100px' }}></div>
            <div className="task-table-cell" style={{ width: '120px' }}>
              <Space>
                <Tooltip title="Add task to this group">
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={handleAddTask}
                    className="opacity-60 hover:opacity-100"
                  />
                </Tooltip>
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined />}
                  className="opacity-60 hover:opacity-100"
                />
              </Space>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {totalTasks > 0 && !isCollapsed && (
          <div className="task-group-progress">
            <div className="task-table-fixed-columns">
              <div style={{ width: '380px', padding: '0 12px' }}>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div
                    className="h-1 rounded-full transition-all duration-300"
                    style={{
                      width: `${completionRate}%`,
                      backgroundColor: getGroupColor(),
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Column Headers */}
      {!isCollapsed && totalTasks > 0 && (
        <div className="task-group-column-headers">
          <div className="task-group-column-headers-row">
            <div className="task-table-fixed-columns">
              <div className="task-table-cell task-table-header-cell" style={{ width: '40px' }}></div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '40px' }}></div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '80px' }}>
                <Text className="column-header-text">Key</Text>
              </div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '220px' }}>
                <Text className="column-header-text">Task</Text>
              </div>
            </div>
            <div className="task-table-scrollable-columns">
              <div className="task-table-cell task-table-header-cell" style={{ width: '120px' }}>
                <Text className="column-header-text">Progress</Text>
              </div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '150px' }}>
                <Text className="column-header-text">Members</Text>
              </div>
              <div className="task-table-cell task-table-header-cell" style={{ width: '150px' }}>
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
        <div className="task-group-body">
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
        </div>
      )}

      <style>{`
        .task-group {
          border: 1px solid var(--task-border-primary, #e8e8e8);
          border-radius: 8px;
          margin-bottom: 16px;
          background: var(--task-bg-primary, white);
          box-shadow: 0 1px 3px var(--task-shadow, rgba(0, 0, 0, 0.1));
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .task-group:last-child {
          margin-bottom: 0;
        }

        .task-group-header {
          background: var(--task-bg-tertiary, #f8f9fa);
          border-bottom: 1px solid var(--task-border-primary, #e8e8e8);
          transition: background-color 0.3s ease;
        }

        .task-group-header-row {
          display: flex;
          height: 42px;
          max-height: 42px;
          overflow: hidden;
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
          height: 32px;
          max-height: 32px;
          overflow: hidden;
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
        }

        .task-table-fixed-columns {
          display: flex;
          background: inherit;
          position: sticky;
          left: 0;
          z-index: 9;
          border-right: 1px solid var(--task-border-secondary, #f0f0f0);
          transition: border-color 0.3s ease;
        }

        .task-table-scrollable-columns {
          display: flex;
          overflow-x: auto;
        }

        .task-table-cell {
          display: flex;
          align-items: center;
          padding: 0 12px;
          border-right: 1px solid var(--task-border-secondary, #f0f0f0);
          font-size: 12px;
          white-space: nowrap;
          height: 42px;
          max-height: 42px;
          min-height: 42px;
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