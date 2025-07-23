import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, Tag, Progress, Typography, Button, Tooltip, Space } from '@/shared/antd-imports';
import {
  HolderOutlined,
  MessageOutlined,
  PaperClipOutlined,
  ClockCircleOutlined,
} from '@/shared/antd-imports';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { IGroupBy } from '@/features/tasks/tasks.slice';
import { useTranslation } from 'react-i18next';

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

const KanbanTaskCard: React.FC<TaskRowProps> = ({
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
  const { t } = useTranslation('task-list-table');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-task-card${isSelected ? ' kanban-task-card-selected' : ''}${isDragOverlay ? ' kanban-task-card-drag-overlay' : ''}`}
    >
      <div className="kanban-task-card-header">
        <Button
          type="text"
          size="small"
          icon={<HolderOutlined />}
          className="kanban-drag-handle"
          {...attributes}
          {...listeners}
        />
        <Text
          strong
          className={`kanban-task-title${task.complete_ratio === 100 ? ' kanban-task-completed' : ''}`}
        >
          {task.name}
        </Text>
        {task.sub_tasks_count && task.sub_tasks_count > 0 && (
          <Button
            type="text"
            size="small"
            onClick={() => onToggleSubtasks?.(task.id!)}
            className="kanban-subtask-toggle"
          >
            {task.show_sub_tasks ? '−' : '+'} {task.sub_tasks_count}
          </Button>
        )}
      </div>
      <div className="kanban-task-card-body">
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {/* Task Key and Status */}
          <div className="kanban-task-row">
            {task.task_key && (
              <Text code className="kanban-task-key">
                {task.task_key}
              </Text>
            )}
            {task.status_name && (
              <Tag
                className="kanban-task-status"
                style={{ backgroundColor: task.status_color, color: 'white', marginLeft: 8 }}
              >
                {task.status_name}
              </Tag>
            )}
            {task.priority_name && (
              <Tag
                className="kanban-task-priority"
                style={{ backgroundColor: task.priority_color, color: 'white', marginLeft: 8 }}
              >
                {task.priority_name}
              </Tag>
            )}
          </div>
          {/* Progress and Due Date */}
          <div className="kanban-task-row">
            {typeof task.complete_ratio === 'number' && (
              <Progress
                type="circle"
                percent={task.complete_ratio}
                size={28}
                strokeColor={task.complete_ratio === 100 ? '#52c41a' : '#1890ff'}
                strokeWidth={4}
                showInfo={false}
                className="kanban-task-progress"
              />
            )}
            {dueDate && (
              <Text
                type={dueDate.color as any}
                className="kanban-task-due-date"
                style={{ marginLeft: 12 }}
              >
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {dueDate.text}
              </Text>
            )}
          </div>
          {/* Assignees and Labels */}
          <div className="kanban-task-row">
            {task.assignees && task.assignees.length > 0 && (
              <Avatar.Group size="small" maxCount={3}>
                {task.assignees.map(assignee => (
                  <Tooltip key={assignee.id} title={assignee.name}>
                    <Avatar size="small">{assignee.name?.charAt(0)?.toUpperCase()}</Avatar>
                  </Tooltip>
                ))}
              </Avatar.Group>
            )}
            {task.labels && task.labels.length > 0 && (
              <div className="kanban-task-labels">
                {task.labels.slice(0, 2).map(label => (
                  <Tag
                    key={label.id}
                    className="kanban-task-label"
                    style={{
                      backgroundColor: label.color_code,
                      border: 'none',
                      color: 'white',
                      marginLeft: 4,
                    }}
                  >
                    {label.name}
                  </Tag>
                ))}
                {task.labels.length > 2 && (
                  <Text type="secondary" className="kanban-task-labels-more">
                    +{task.labels.length - 2}
                  </Text>
                )}
              </div>
            )}
          </div>
          {/* Indicators */}
          <div className="kanban-task-row kanban-task-indicators">
            {task.time_spent_string && (
              <span className="kanban-task-time">
                <ClockCircleOutlined /> {task.time_spent_string}
              </span>
            )}
            {task.comments_count && task.comments_count > 1 && (
              <Tooltip title={t(`indicators.tooltips.comments${task.comments_count === 1 ? '' : '_plural'}`, { count: task.comments_count })}>
                <span className="kanban-task-indicator">
                  <MessageOutlined /> {task.comments_count}
                </span>
              </Tooltip>
            )}
            {task.attachments_count && task.attachments_count > 1 && (
              <Tooltip title={t(`indicators.tooltips.attachments${task.attachments_count === 1 ? '' : '_plural'}`, { count: task.attachments_count })}>
                <span className="kanban-task-indicator">
                  <PaperClipOutlined /> {task.attachments_count}
                </span>
              </Tooltip>
            )}
          </div>
        </Space>
      </div>
      {/* Subtasks */}
      {task.show_sub_tasks && task.sub_tasks && task.sub_tasks.length > 0 && (
        <div className="kanban-task-subtasks">
          {task.sub_tasks.map(subtask => (
            <KanbanTaskCard
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
        .kanban-task-card {
          background: var(--task-bg-primary, #fff);
          border-radius: 8px;
          box-shadow: 0 1px 4px var(--task-shadow, rgba(0,0,0,0.08));
          border: 1px solid var(--task-border-primary, #f0f0f0);
          margin-bottom: 0;
          padding: 14px 16px 10px 16px;
          display: flex;
          flex-direction: column;
          gap: 0;
          transition: box-shadow 0.2s, border-color 0.2s, background 0.2s;
          position: relative;
        }
        .kanban-task-card-selected {
          border: 2px solid var(--task-selected-border, #1890ff);
          box-shadow: 0 2px 8px var(--task-selected-bg, #e6f7ff);
        }
        .kanban-task-card-drag-overlay {
          background: var(--task-bg-primary, #fff);
          border: 2px dashed var(--task-drag-over-border, #40a9ff);
          box-shadow: 0 4px 12px var(--task-shadow, rgba(24,144,255,0.15));
        }
        .kanban-task-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .kanban-drag-handle {
          cursor: grab;
          opacity: 0.5;
          transition: opacity 0.2s;
          color: var(--task-text-tertiary, #8c8c8c);
        }
        .kanban-drag-handle:hover {
          opacity: 1;
        }
        .kanban-task-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--task-text-primary, #262626);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: color 0.2s;
        }
        .kanban-task-completed {
          text-decoration: line-through;
          color: var(--task-text-tertiary, #8c8c8c);
        }
        .kanban-subtask-toggle {
          font-size: 11px;
          color: var(--task-text-tertiary, #8c8c8c);
          padding: 0 4px;
          height: 18px;
          line-height: 18px;
        }
        .kanban-task-card-body {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .kanban-task-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 22px;
        }
        .kanban-task-key {
          font-size: 11px;
          color: var(--task-text-tertiary, #8c8c8c);
          background: var(--task-bg-secondary, #f0f0f0);
          padding: 1px 4px;
          border-radius: 2px;
        }
        .kanban-task-status {
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          border-radius: 2px;
          padding: 2px 6px;
        }
        .kanban-task-priority {
          font-size: 10px;
          font-weight: 500;
          border-radius: 2px;
          padding: 2px 6px;
        }
        .kanban-task-progress {
          margin-right: 8px;
        }
        .kanban-task-due-date {
          font-size: 11px;
        }
        .kanban-task-labels {
          display: flex;
          gap: 2px;
          flex-wrap: nowrap;
          align-items: center;
        }
        .kanban-task-label {
          font-size: 10px;
          padding: 0 4px;
          height: 16px;
          line-height: 16px;
          border-radius: 2px;
          margin: 0;
        }
        .kanban-task-labels-more {
          font-size: 10px;
          color: var(--task-text-tertiary, #8c8c8c);
        }
        .kanban-task-indicators {
          gap: 12px;
          font-size: 11px;
          color: var(--task-text-tertiary, #8c8c8c);
        }
        .kanban-task-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .kanban-task-time {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .kanban-task-subtasks {
          margin-top: 8px;
          margin-left: 24px;
          border-left: 2px solid var(--task-border-secondary, #f0f0f0);
          padding-left: 8px;
        }
        /* Dark mode overrides */
        .dark .kanban-task-card,
        [data-theme="dark"] .kanban-task-card {
          background: var(--task-bg-primary, #1f1f1f);
          border: 1px solid var(--task-border-primary, #303030);
          box-shadow: 0 1px 4px var(--task-shadow, rgba(0,0,0,0.3));
        }
        .dark .kanban-task-card-selected,
        [data-theme="dark"] .kanban-task-card-selected {
          border: 2px solid var(--task-selected-border, #1890ff);
          box-shadow: 0 2px 8px var(--task-selected-bg, #1a2332);
        }
        .dark .kanban-task-card-drag-overlay,
        [data-theme="dark"] .kanban-task-card-drag-overlay {
          background: var(--task-bg-primary, #1f1f1f);
          border: 2px dashed var(--task-drag-over-border, #40a9ff);
          box-shadow: 0 4px 12px var(--task-shadow, rgba(24,144,255,0.15));
        }
        .dark .kanban-task-title,
        [data-theme="dark"] .kanban-task-title {
          color: var(--task-text-primary, #fff);
        }
        .dark .kanban-task-completed,
        [data-theme="dark"] .kanban-task-completed {
          color: var(--task-text-tertiary, #8c8c8c);
        }
        .dark .kanban-task-key,
        [data-theme="dark"] .kanban-task-key {
          background: var(--task-bg-secondary, #141414);
          color: var(--task-text-tertiary, #8c8c8c);
        }
        .dark .kanban-task-labels-more,
        [data-theme="dark"] .kanban-task-labels-more {
          color: var(--task-text-tertiary, #8c8c8c);
        }
        .dark .kanban-task-indicators,
        [data-theme="dark"] .kanban-task-indicators {
          color: var(--task-text-tertiary, #8c8c8c);
        }
        .dark .kanban-drag-handle,
        [data-theme="dark"] .kanban-drag-handle {
          color: var(--task-text-tertiary, #8c8c8c);
        }
        .dark .kanban-task-subtasks,
        [data-theme="dark"] .kanban-task-subtasks {
          border-left: 2px solid var(--task-border-secondary, #404040);
        }
      `}</style>
    </div>
  );
};

export default KanbanTaskCard;
