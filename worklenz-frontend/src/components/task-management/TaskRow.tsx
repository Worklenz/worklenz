import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox, Avatar, Tag, Progress, Typography, Space, Button, Tooltip } from 'antd';
import {
  HolderOutlined,
  EyeOutlined,
  MessageOutlined,
  PaperClipOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { IGroupBy } from '@/features/tasks/tasks.slice';

const { Text } = Typography;

interface TaskRowProps {
  task: IProjectTask;
  projectId: string;
  groupId: string;
  currentGrouping: IGroupBy;
  isSelected: boolean;
  isDragOverlay?: boolean;
  index?: number;
  onSelect?: (taskId: string, selected: boolean) => void;
  onToggleSubtasks?: (taskId: string) => void;
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  projectId,
  groupId,
  currentGrouping,
  isSelected,
  isDragOverlay = false,
  index,
  onSelect,
  onToggleSubtasks,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id!,
    data: {
      type: 'task',
      taskId: task.id,
      groupId,
    },
    disabled: isDragOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSelectChange = (checked: boolean) => {
    onSelect?.(task.id!, checked);
  };

  const handleToggleSubtasks = () => {
    onToggleSubtasks?.(task.id!);
  };

  // Format due date
  const formatDueDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, color: 'error' };
    } else if (diffDays === 0) {
      return { text: 'Due today', color: 'warning' };
    } else if (diffDays <= 3) {
      return { text: `Due in ${diffDays}d`, color: 'warning' };
    } else {
      return { text: `Due ${date.toLocaleDateString()}`, color: 'default' };
    }
  };

  const dueDate = formatDueDate(task.end_date);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`task-row ${isSelected ? 'task-row-selected' : ''} ${isDragOverlay ? 'task-row-drag-overlay' : ''}`}
      >
        <div className="task-row-content">
          {/* Fixed Columns */}
          <div className="task-table-fixed-columns">
            {/* Drag Handle */}
            <div className="task-table-cell task-table-cell-drag" style={{ width: '40px' }}>
              <Button
                type="text"
                size="small"
                icon={<HolderOutlined />}
                className="drag-handle opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing"
                {...attributes}
                {...listeners}
              />
            </div>

            {/* Selection Checkbox */}
            <div className="task-table-cell task-table-cell-checkbox" style={{ width: '40px' }}>
              <Checkbox
                checked={isSelected}
                onChange={(e) => handleSelectChange(e.target.checked)}
              />
            </div>

            {/* Task Key */}
            <div className="task-table-cell task-table-cell-key" style={{ width: '80px' }}>
              {task.project_id && task.task_key && (
                <Text code className="task-key">
                  {task.task_key}
                </Text>
              )}
            </div>

            {/* Task Name */}
            <div className="task-table-cell task-table-cell-task" style={{ width: '220px' }}>
              <div className="task-content">
                <div className="task-header">
                  <Text
                    strong
                    className={`task-name ${task.complete_ratio === 100 ? 'task-completed' : ''}`}
                  >
                    {task.name}
                  </Text>
                  {task.sub_tasks_count && task.sub_tasks_count > 0 && (
                    <Button
                      type="text"
                      size="small"
                      onClick={handleToggleSubtasks}
                      className="subtask-toggle"
                    >
                      {task.show_sub_tasks ? '−' : '+'} {task.sub_tasks_count}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Columns */}
          <div className="task-table-scrollable-columns">
            {/* Progress */}
            <div className="task-table-cell" style={{ width: '120px' }}>
              {task.complete_ratio !== undefined && task.complete_ratio >= 0 && (
                <div className="task-progress">
                  <Progress
                    percent={task.complete_ratio}
                    size="small"
                    showInfo={false}
                    strokeColor={task.complete_ratio === 100 ? '#52c41a' : '#1890ff'}
                  />
                  <Text className="task-progress-text">{task.complete_ratio}%</Text>
                </div>
              )}
            </div>

            {/* Members */}
            <div className="task-table-cell" style={{ width: '150px' }}>
              {task.assignees && task.assignees.length > 0 && (
                <Avatar.Group size="small" maxCount={3}>
                  {task.assignees.map((assignee) => (
                    <Tooltip key={assignee.id} title={assignee.name}>
                      <Avatar
                        size="small"
                      >
                        {assignee.name?.charAt(0)?.toUpperCase()}
                      </Avatar>
                    </Tooltip>
                  ))}
                </Avatar.Group>
              )}
            </div>

            {/* Labels */}
            <div className="task-table-cell" style={{ width: '150px' }}>
              {task.labels && task.labels.length > 0 && (
                <div className="task-labels-column">
                  {task.labels.slice(0, 3).map((label) => (
                    <Tag
                      key={label.id}
                      className="task-label"
                      style={{ 
                        backgroundColor: label.color_code,
                        border: 'none',
                        color: 'white',
                      }}
                    >
                      {label.name}
                    </Tag>
                  ))}
                  {task.labels.length > 3 && (
                    <Text type="secondary" className="task-labels-more">
                      +{task.labels.length - 3}
                    </Text>
                  )}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="task-table-cell" style={{ width: '100px' }}>
              {task.status_name && (
                <div 
                  className="task-status"
                  style={{ 
                    backgroundColor: task.status_color,
                    color: 'white',
                  }}
                >
                  {task.status_name}
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="task-table-cell" style={{ width: '100px' }}>
              {task.priority_name && (
                <div className="task-priority">
                  <div
                    className="task-priority-indicator"
                    style={{ backgroundColor: task.priority_color }}
                  />
                  <Text className="task-priority-text">{task.priority_name}</Text>
                </div>
              )}
            </div>

            {/* Time Tracking */}
            <div className="task-table-cell" style={{ width: '120px' }}>
              <div className="task-time-tracking">
                {task.time_spent_string && (
                  <div className="task-time-spent">
                    <ClockCircleOutlined className="task-time-icon" />
                    <Text className="task-time-text">{task.time_spent_string}</Text>
                  </div>
                )}
                {/* Task Indicators */}
                <div className="task-indicators">
                  {task.comments_count && task.comments_count > 0 && (
                    <div className="task-indicator">
                      <MessageOutlined />
                      <span>{task.comments_count}</span>
                    </div>
                  )}
                  {task.attachments_count && task.attachments_count > 0 && (
                    <div className="task-indicator">
                      <PaperClipOutlined />
                      <span>{task.attachments_count}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtasks */}
      {task.show_sub_tasks && task.sub_tasks && task.sub_tasks.length > 0 && (
        <div className="task-subtasks">
          {task.sub_tasks.map((subtask) => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              projectId={projectId}
              groupId={groupId}
              currentGrouping={currentGrouping}
              isSelected={isSelected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      <style>{`
        .task-row {
          border-bottom: 1px solid var(--task-border-secondary, #f0f0f0);
          background: var(--task-bg-primary, white);
          transition: all 0.3s ease;
        }

        .task-row:hover {
          background-color: var(--task-hover-bg, #fafafa);
        }

        .task-row-selected {
          background-color: var(--task-selected-bg, #e6f7ff);
          border-left: 3px solid var(--task-selected-border, #1890ff);
        }

        .task-row-drag-overlay {
          background: var(--task-bg-primary, white);
          border: 1px solid var(--task-border-tertiary, #d9d9d9);
          border-radius: 4px;
          box-shadow: 0 4px 12px var(--task-shadow, rgba(0, 0, 0, 0.15));
        }

        .task-row-content {
          display: flex;
          height: 42px;
          max-height: 42px;
          overflow: hidden;
        }

        .task-table-fixed-columns {
          display: flex;
          background: inherit;
          position: sticky;
          left: 0;
          z-index: 8;
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
          padding: 0 8px;
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

        .task-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 100%;
          overflow: hidden;
        }

        .task-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 1px;
          height: 20px;
          overflow: hidden;
        }

        .task-key {
          font-size: 10px;
          color: var(--task-text-tertiary, #666);
          background: var(--task-bg-secondary, #f0f0f0);
          padding: 1px 4px;
          border-radius: 2px;
          transition: all 0.3s ease;
        }

        .task-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--task-text-primary, #262626);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: color 0.3s ease;
        }

        .task-completed {
          text-decoration: line-through;
          color: var(--task-text-tertiary, #8c8c8c);
        }

        .subtask-toggle {
          font-size: 10px;
          color: var(--task-text-tertiary, #666);
          padding: 0 4px;
          height: 16px;
          line-height: 16px;
          transition: color 0.3s ease;
        }

        .task-labels {
          display: flex;
          gap: 2px;
          flex-wrap: nowrap;
          overflow: hidden;
          height: 18px;
          align-items: center;
        }

        .task-label {
          font-size: 10px;
          padding: 0 4px;
          height: 16px;
          line-height: 16px;
          border-radius: 2px;
          margin: 0;
        }

        .task-label-small {
          font-size: 9px;
          padding: 0 3px;
          height: 14px;
          line-height: 14px;
          border-radius: 2px;
          margin: 0;
        }

        .task-labels-more {
          font-size: 10px;
          color: var(--task-text-tertiary, #8c8c8c);
          transition: color 0.3s ease;
        }

        .task-progress {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          height: 100%;
        }

        .task-progress .ant-progress {
          flex: 1;
        }

        .task-progress-text {
          font-size: 10px;
          color: var(--task-text-tertiary, #666);
          min-width: 24px;
          transition: color 0.3s ease;
        }

        .task-labels-column {
          display: flex;
          gap: 2px;
          flex-wrap: nowrap;
          overflow: hidden;
          height: 100%;
          align-items: center;
        }

        .task-status {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 2px;
          font-weight: 500;
          text-transform: uppercase;
        }

        .task-priority {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .task-priority-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .task-priority-text {
          font-size: 11px;
          color: var(--task-text-tertiary, #666);
          transition: color 0.3s ease;
        }

        .task-time-tracking {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 100%;
          overflow: hidden;
        }

        .task-time-spent {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .task-time-icon {
          font-size: 10px;
          color: var(--task-text-tertiary, #8c8c8c);
          transition: color 0.3s ease;
        }

        .task-time-text {
          font-size: 10px;
          color: var(--task-text-tertiary, #666);
          transition: color 0.3s ease;
        }

        .task-indicators {
          display: flex;
          gap: 6px;
        }

        .task-indicator {
          display: flex;
          align-items: center;
          gap: 2px;
          font-size: 10px;
          color: var(--task-text-tertiary, #8c8c8c);
          transition: color 0.3s ease;
        }

        .task-subtasks {
          margin-left: 40px;
          border-left: 2px solid var(--task-border-secondary, #f0f0f0);
          transition: border-color 0.3s ease;
        }

        .drag-handle {
          opacity: 0.4;
          transition: opacity 0.2s;
        }

        .drag-handle:hover {
          opacity: 1;
        }

        /* Ensure buttons and components fit within row height */
        .task-row .ant-btn {
          height: auto;
          max-height: 24px;
          padding: 0 4px;
          line-height: 1.2;
        }

        .task-row .ant-checkbox-wrapper {
          height: 24px;
          align-items: center;
        }

        .task-row .ant-avatar-group {
          height: 24px;
          align-items: center;
        }

        .task-row .ant-avatar {
          width: 24px !important;
          height: 24px !important;
          line-height: 24px !important;
          font-size: 10px !important;
        }

        .task-row .ant-tag {
          margin: 0;
          padding: 0 4px;
          height: 16px;
          line-height: 16px;
          border-radius: 2px;
        }

        .task-row .ant-progress {
          margin: 0;
          line-height: 1;
        }

        .task-row .ant-progress-line {
          height: 6px !important;
        }

        .task-row .ant-progress-bg {
          height: 6px !important;
        }

        /* Dark mode specific adjustments for Ant Design components */
        .dark .task-row .ant-progress-bg,
        [data-theme="dark"] .task-row .ant-progress-bg {
          background-color: var(--task-border-primary, #303030) !important;
        }

        .dark .task-row .ant-checkbox-wrapper,
        [data-theme="dark"] .task-row .ant-checkbox-wrapper {
          color: var(--task-text-primary, #ffffff);
        }

        .dark .task-row .ant-btn,
        [data-theme="dark"] .task-row .ant-btn {
          color: var(--task-text-secondary, #d9d9d9);
          border-color: transparent;
        }

        .dark .task-row .ant-btn:hover,
        [data-theme="dark"] .task-row .ant-btn:hover {
          color: var(--task-text-primary, #ffffff);
          background-color: var(--task-hover-bg, #2a2a2a);
        }
      `}</style>
    </>
  );
};

export default TaskRow; 