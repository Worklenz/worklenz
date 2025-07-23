import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, Typography } from '@/shared/antd-imports';
import { PlusOutlined, MenuOutlined } from '@/shared/antd-imports';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { IGroupBy } from '@/features/tasks/tasks.slice';
import KanbanTaskCard from './kanbanTaskCard';

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
  dragHandleProps?: any;
  activeTaskId?: string | null;
}

const KanbanGroup: React.FC<TaskGroupProps> = ({
  group,
  projectId,
  currentGrouping,
  selectedTaskIds,
  onAddTask,
  onToggleCollapse,
  onSelectTask,
  onToggleSubtasks,
  dragHandleProps,
  activeTaskId,
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

  // Get group color based on grouping type
  const getGroupColor = () => {
    if (group.color_code) return group.color_code;
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

  const handleAddTask = () => {
    onAddTask?.(group.id);
  };

  return (
    <div ref={setNodeRef} className={`kanban-group-column${isOver ? ' drag-over' : ''}`}>
      {/* Group Header */}
      <div className="kanban-group-header" style={{ backgroundColor: getGroupColor() }}>
        {/* Drag handle for column */}
        <Button
          type="text"
          size="small"
          icon={<MenuOutlined />}
          className="kanban-group-drag-handle"
          style={{ marginRight: 8, cursor: 'grab', opacity: 0.7 }}
          {...(dragHandleProps || {})}
        />
        <Text strong className="kanban-group-header-text">
          {group.name} <span className="kanban-group-count">({group.tasks.length})</span>
        </Text>
      </div>

      {/* Tasks as Cards */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="kanban-group-tasks">
          {group.tasks.length === 0 ? (
            <div className="kanban-group-empty">
              <Text type="secondary">No tasks in this group</Text>
            </div>
          ) : (
            group.tasks.map((task, index) =>
              task.id === activeTaskId ? (
                <div key={task.id} className="kanban-task-card kanban-task-card-placeholder" />
              ) : (
                <KanbanTaskCard
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
              )
            )
          )}
        </div>
      </SortableContext>

      {/* Add Task Button */}
      <div className="kanban-group-add-task">
        <Button type="dashed" icon={<PlusOutlined />} block onClick={handleAddTask}>
          Add Task
        </Button>
      </div>

      <style>{`
                .kanban-group-column {
                    display: flex;
                    flex-direction: column;
                    background: var(--task-bg-primary, #fff);
                    border-radius: 8px;
                    box-shadow: 0 1px 3px var(--task-shadow, rgba(0,0,0,0.08));
                    border: 1px solid var(--task-border-primary, #e8e8e8);
                    min-width: 320px;
                    max-width: 350px;
                    margin: 0 12px;
                    padding: 0;
                    height: 100%;
                    transition: box-shadow 0.2s;
                }
                .kanban-group-header {
                    border-top-left-radius: 8px;
                    border-top-right-radius: 8px;
                    padding: 16px 16px 12px 16px;
                    color: #fff;
                    font-size: 16px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    min-height: 56px;
                }
                .kanban-group-header-text {
                    color: #fff !important;
                    font-size: 15px;
                    font-weight: 600;
                }
                .kanban-group-count {
                    font-size: 13px;
                    font-weight: 400;
                    margin-left: 4px;
                    color: #f5f5f5;
                }
                .kanban-group-tasks {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 12px 12px 0 12px;
                    min-height: 60px;
                }
                .kanban-group-empty {
                    text-align: center;
                    color: #bfbfbf;
                    padding: 48px 16px;
                }
                .kanban-group-add-task {
                    padding: 12px;
                    border-top: 1px solid var(--task-border-secondary, #f0f0f0);
                    background: var(--task-bg-primary, #fff);
                    border-bottom-left-radius: 8px;
                    border-bottom-right-radius: 8px;
                }
                .drag-over {
                    box-shadow: 0 0 0 3px #bae7ff;
                    border-color: #40a9ff;
                }
                .kanban-group-drag-handle {
                    color: #fff !important;
                    background: transparent !important;
                    border: none !important;
                    padding: 0 4px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .kanban-group-drag-handle:hover {
                    opacity: 1 !important;
                }
                .kanban-task-card-placeholder {
                    min-height: 80px;
                    height: 80px;
                    border: 2px dashed var(--task-drag-over-border, #40a9ff);
                    background: var(--task-bg-primary, #fff);
                    border-radius: 8px;
                    margin-bottom: 0;
                    opacity: 0.5;
                }
                .dark .kanban-task-card-placeholder,
                [data-theme="dark"] .kanban-task-card-placeholder {
                    background: var(--task-bg-primary, #1f1f1f);
                    border: 2px dashed var(--task-drag-over-border, #40a9ff);
                }
            `}</style>
    </div>
  );
};

export default KanbanGroup;
