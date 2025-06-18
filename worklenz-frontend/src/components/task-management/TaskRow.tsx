import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox, Avatar, Tag, Progress, Typography, Space, Button, Tooltip } from 'antd';
import {
  DragOutlined,
  EyeOutlined,
  MessageOutlined,
  PaperClipOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { IProjectTask } from '@/types/tasks/taskList.types';
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
    <div
      ref={setNodeRef}
      style={style}
      className={`task-row p-4 hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''} ${isDragOverlay ? 'shadow-lg bg-white rounded-md border' : ''}`}
    >
      <div className="flex items-center space-x-3">
        {/* Drag Handle */}
        <Button
          type="text"
          size="small"
          icon={<DragOutlined />}
          className="drag-handle opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        />

        {/* Selection Checkbox */}
        <Checkbox
          checked={isSelected}
          onChange={(e) => handleSelectChange(e.target.checked)}
        />

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* Task Name and Key */}
              <div className="flex items-center space-x-2 mb-1">
                {task.project_id && (
                  <Text code className="text-xs text-gray-500">
                    {task.key}
                  </Text>
                )}
                <Text
                  strong
                  className={`text-sm ${task.complete_ratio === 100 ? 'line-through text-gray-500' : ''}`}
                >
                  {task.name}
                </Text>
                {task.sub_tasks_count && task.sub_tasks_count > 0 && (
                  <Button
                    type="text"
                    size="small"
                    onClick={handleToggleSubtasks}
                    className="text-xs text-gray-500 px-1 h-5"
                  >
                    {task.show_sub_tasks ? '−' : '+'} {task.sub_tasks_count}
                  </Button>
                )}
              </div>

              {/* Description (if exists) */}
              {task.description && (
                <Text type="secondary" className="text-xs line-clamp-1">
                  {task.description}
                </Text>
              )}

              {/* Labels */}
              {task.labels && task.labels.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {task.labels.slice(0, 3).map((label) => (
                    <Tag
                      key={label.id}
                      color={label.color_code}
                      className="text-xs m-0 px-1 py-0 text-white"
                      style={{ 
                        backgroundColor: label.color_code,
                        border: 'none',
                        fontSize: '10px',
                      }}
                    >
                      {label.name}
                    </Tag>
                  ))}
                  {task.labels.length > 3 && (
                    <Text type="secondary" className="text-xs">
                      +{task.labels.length - 3} more
                    </Text>
                  )}
                </div>
              )}
            </div>

            {/* Task Metadata */}
            <div className="flex items-center space-x-3 ml-4">
              {/* Progress */}
              {task.complete_ratio !== undefined && task.complete_ratio > 0 && (
                <div className="w-16">
                  <Progress
                    percent={task.complete_ratio}
                    size="small"
                    showInfo={false}
                    strokeColor={task.complete_ratio === 100 ? '#52c41a' : '#1890ff'}
                  />
                </div>
              )}

              {/* Assignees */}
              {task.assignees && task.assignees.length > 0 && (
                <Avatar.Group size="small" maxCount={3}>
                  {task.assignees.map((assignee) => (
                    <Tooltip key={assignee.id} title={assignee.name}>
                      <Avatar
                        size="small"
                        src={assignee.avatar_url}
                        style={{ backgroundColor: assignee.color_code }}
                      >
                        {assignee.name?.charAt(0)?.toUpperCase()}
                      </Avatar>
                    </Tooltip>
                  ))}
                </Avatar.Group>
              )}

              {/* Priority Indicator */}
              {task.priority_color && (
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: task.priority_color }}
                  title={`Priority: ${task.priority}`}
                />
              )}

              {/* Due Date */}
              {dueDate && (
                <div className="flex items-center space-x-1">
                  <ClockCircleOutlined className="text-xs text-gray-400" />
                  <Text
                    className={`text-xs ${
                      dueDate.color === 'error' ? 'text-red-500' :
                      dueDate.color === 'warning' ? 'text-orange-500' :
                      'text-gray-500'
                    }`}
                  >
                    {dueDate.text}
                  </Text>
                </div>
              )}

              {/* Task Indicators */}
              <Space size={0}>
                {task.comments_count && task.comments_count > 0 && (
                  <div className="flex items-center space-x-1">
                    <MessageOutlined className="text-xs text-gray-400" />
                    <Text className="text-xs text-gray-500">{task.comments_count}</Text>
                  </div>
                )}
                
                {task.attachments_count && task.attachments_count > 0 && (
                  <div className="flex items-center space-x-1">
                    <PaperClipOutlined className="text-xs text-gray-400" />
                    <Text className="text-xs text-gray-500">{task.attachments_count}</Text>
                  </div>
                )}
              </Space>

              {/* View/Edit Button */}
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                className="opacity-60 hover:opacity-100"
                onClick={() => {
                  // Handle task view/edit
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Subtasks */}
      {task.show_sub_tasks && task.sub_tasks && task.sub_tasks.length > 0 && (
        <div className="mt-3 ml-8 pl-4 border-l-2 border-gray-200">
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
    </div>
  );
};

export default TaskRow; 