/**
 * Example: Task Row Component using Centralized Ant Design Imports
 * 
 * This file demonstrates how to migrate from direct antd imports to the centralized import system.
 * 
 * BEFORE (Direct imports):
 * import { Input, Typography, DatePicker } from 'antd';
 * import type { InputRef } from 'antd';
 * 
 * AFTER (Centralized imports):
 * import { Input, Typography, DatePicker, type InputRef, dayjs, taskManagementAntdConfig } from './antd-imports';
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  Input, 
  Typography, 
  DatePicker, 
  Button,
  Select,
  Tooltip,
  Badge,
  Space,
  Checkbox,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EditOutlined,
  MoreOutlined,
  dayjs,
  taskManagementAntdConfig,
  taskMessage,
  type InputRef,
  type DatePickerProps,
  type Dayjs
} from './antd-imports';

// Your existing task type import
import { Task } from '@/types/task-management.types';

interface TaskRowExampleProps {
  task: Task;
  projectId: string;
  isDarkMode?: boolean;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
}

const TaskRowExample: React.FC<TaskRowExampleProps> = ({
  task,
  projectId,
  isDarkMode = false,
  onTaskUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Use centralized config for consistent DatePicker props
  const datePickerProps = useMemo(() => ({
    ...taskManagementAntdConfig.datePickerDefaults,
    className: "w-full bg-transparent border-none shadow-none"
  }), []);

  // Use centralized config for consistent Button props
  const buttonProps = useMemo(() => ({
    ...taskManagementAntdConfig.taskButtonDefaults,
    icon: <EditOutlined />
  }), []);

  // Handle date changes with centralized message system
  const handleDateChange = useCallback((date: Dayjs | null, field: 'startDate' | 'dueDate') => {
    if (onTaskUpdate) {
      onTaskUpdate(task.id, {
        [field]: date?.toISOString() || null
      });
      taskMessage.success(`${field === 'startDate' ? 'Start' : 'Due'} date updated`);
    }
  }, [task.id, onTaskUpdate]);

  // Handle task title edit
  const handleTitleEdit = useCallback((newTitle: string) => {
    if (onTaskUpdate && newTitle.trim() !== task.title) {
      onTaskUpdate(task.id, { title: newTitle.trim() });
      taskMessage.success('Task title updated');
    }
    setIsEditing(false);
  }, [task.id, task.title, onTaskUpdate]);

  // Memoized date values for performance
  const startDateValue = useMemo(() => 
    task.startDate ? dayjs(task.startDate) : undefined, 
    [task.startDate]
  );

  const dueDateValue = useMemo(() => 
    task.dueDate ? dayjs(task.dueDate) : undefined, 
    [task.dueDate]
  );

  return (
    <div className={`task-row-example ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="task-row-content">
        
        {/* Task Selection Checkbox */}
        <div className="task-cell">
          <Checkbox 
            onChange={(e) => {
              // Handle selection logic here
              console.log('Task selected:', e.target.checked);
            }}
          />
        </div>

        {/* Task Title */}
        <div className="task-cell task-title">
          {isEditing ? (
            <Input
              {...taskManagementAntdConfig.taskInputDefaults}
              defaultValue={task.title}
              autoFocus
              onPressEnter={(e) => handleTitleEdit(e.currentTarget.value)}
              onBlur={(e) => handleTitleEdit(e.currentTarget.value)}
            />
          ) : (
            <Space>
              <Typography.Text 
                className="task-title-text"
                onClick={() => setIsEditing(true)}
              >
                {task.title}
              </Typography.Text>
              <Button
                {...buttonProps}
                onClick={() => setIsEditing(true)}
              />
            </Space>
          )}
        </div>

        {/* Task Progress */}
        <div className="task-cell">
          <Badge 
            count={`${task.progress || 0}%`} 
            color={task.progress === 100 ? 'green' : 'blue'}
          />
        </div>

        {/* Task Assignees */}
        <div className="task-cell">
          <Space>
            <UserOutlined />
            <Typography.Text>
              {task.assignee_names?.join(', ') || 'Unassigned'}
            </Typography.Text>
          </Space>
        </div>

        {/* Start Date */}
        <div className="task-cell">
          <Tooltip 
            {...taskManagementAntdConfig.tooltipDefaults}
            title="Start Date"
          >
            <DatePicker
              {...datePickerProps}
              value={startDateValue}
              onChange={(date) => handleDateChange(date, 'startDate')}
              placeholder="Start Date"
            />
          </Tooltip>
        </div>

        {/* Due Date */}
        <div className="task-cell">
          <Tooltip 
            {...taskManagementAntdConfig.tooltipDefaults}
            title="Due Date"
          >
            <DatePicker
              {...datePickerProps}
              value={dueDateValue}
              onChange={(date) => handleDateChange(date, 'dueDate')}
              placeholder="Due Date"
              disabledDate={(current) => 
                startDateValue ? current.isBefore(startDateValue, 'day') : false
              }
            />
          </Tooltip>
        </div>

        {/* Task Status */}
        <div className="task-cell">
          <Select
            {...taskManagementAntdConfig.taskSelectDefaults}
            value={task.status}
            placeholder="Status"
            onChange={(value) => {
              if (onTaskUpdate) {
                onTaskUpdate(task.id, { status: value });
                taskMessage.success('Status updated');
              }
            }}
            options={[
              { label: 'To Do', value: 'todo' },
              { label: 'In Progress', value: 'in_progress' },
              { label: 'Done', value: 'done' },
            ]}
          />
        </div>

        {/* Task Priority */}
        <div className="task-cell">
          <Select
            {...taskManagementAntdConfig.taskSelectDefaults}
            value={task.priority}
            placeholder="Priority"
            onChange={(value) => {
              if (onTaskUpdate) {
                onTaskUpdate(task.id, { priority: value });
                taskMessage.success('Priority updated');
              }
            }}
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
              { label: 'Critical', value: 'critical' },
            ]}
          />
        </div>

        {/* Time Tracking */}
        <div className="task-cell">
          <Space>
            <ClockCircleOutlined />
            <Typography.Text>
              {task.timeTracking?.logged ? `${task.timeTracking.logged}h` : '0h'}
            </Typography.Text>
          </Space>
        </div>

        {/* Actions */}
        <div className="task-cell">
          <Button
            {...taskManagementAntdConfig.taskButtonDefaults}
            icon={<MoreOutlined />}
            onClick={() => {
              // Handle more actions
              console.log('More actions clicked');
            }}
          />
        </div>

      </div>
    </div>
  );
};

export default TaskRowExample;

/**
 * Migration Guide:
 * 
 * 1. Replace direct antd imports with centralized imports:
 *    - Change: import { DatePicker } from 'antd';
 *    - To: import { DatePicker } from './antd-imports';
 * 
 * 2. Use centralized configurations:
 *    - Apply taskManagementAntdConfig.datePickerDefaults to all DatePickers
 *    - Use taskMessage instead of direct message calls
 *    - Apply consistent styling with taskManagementTheme
 * 
 * 3. Benefits:
 *    - Better tree-shaking (smaller bundle size)
 *    - Consistent component props across all task management components
 *    - Centralized theme management
 *    - Type safety with proper TypeScript types
 *    - Easy maintenance and updates
 * 
 * 4. Performance optimizations included:
 *    - Memoized date values to prevent unnecessary dayjs parsing
 *    - Centralized configurations to prevent prop recreation
 *    - Optimized message utilities
 */ 