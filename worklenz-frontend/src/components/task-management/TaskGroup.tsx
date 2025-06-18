import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, Button, Typography, Badge, Collapse, Space, Tooltip } from 'antd';
import {
  CaretRightOutlined,
  CaretDownOutlined,
  PlusOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { ITaskListGroup, IProjectTask } from '@/types/tasks/taskList.types';
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
}

const TaskGroup: React.FC<TaskGroupProps> = ({
  group,
  projectId,
  currentGrouping,
  selectedTaskIds,
  onAddTask,
  onToggleCollapse,
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
    task.status_category === 'DONE' || task.complete_ratio === 100
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
    <Card
      ref={setNodeRef}
      className={`task-group ${isOver ? 'drag-over' : ''}`}
      style={{
        borderLeft: `4px solid ${getGroupColor()}`,
        backgroundColor: isOver ? '#f0f8ff' : undefined,
      }}
      styles={{
        body: { padding: 0 },
      }}
    >
      {/* Group Header */}
      <div className="group-header px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              type="text"
              size="small"
              icon={isCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
              onClick={handleToggleCollapse}
              className="p-0 w-6 h-6 flex items-center justify-center"
            />

            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getGroupColor() }}
              />
              <Text strong className="text-base">
                {group.name}
              </Text>
              <Badge count={totalTasks} showZero style={{ backgroundColor: '#f0f0f0', color: '#666' }} />
            </div>

            {completionRate > 0 && (
              <Text type="secondary" className="text-sm">
                {completionRate}% complete
              </Text>
            )}
          </div>

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

        {/* Progress Bar */}
        {totalTasks > 0 && (
          <div className="mt-2">
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
        )}
      </div>

      {/* Tasks List */}
      {!isCollapsed && (
        <div className="tasks-container">
          {group.tasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
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
          ) : (
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-gray-100">
                {group.tasks.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    projectId={projectId}
                    groupId={group.id}
                    currentGrouping={currentGrouping}
                    isSelected={selectedTaskIds.includes(task.id!)}
                    index={index}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      )}
    </Card>
  );
};

export default TaskGroup; 