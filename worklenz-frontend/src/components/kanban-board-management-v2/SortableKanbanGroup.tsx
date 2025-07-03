import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import KanbanGroup from './kanbanGroup';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { IGroupBy } from '@/features/tasks/tasks.slice';

interface SortableKanbanGroupProps {
  group: ITaskListGroup;
  projectId: string;
  currentGrouping: IGroupBy;
  selectedTaskIds: string[];
  onAddTask?: (groupId: string) => void;
  onToggleCollapse?: (groupId: string) => void;
  onSelectTask?: (taskId: string, selected: boolean) => void;
  onToggleSubtasks?: (taskId: string) => void;
  activeTaskId?: string | null;
}

const SortableKanbanGroup: React.FC<SortableKanbanGroupProps> = props => {
  const { group, activeTaskId } = props;
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: group.id,
    data: { type: 'group', groupId: group.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <KanbanGroup
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        activeTaskId={activeTaskId}
      />
    </div>
  );
};

export default SortableKanbanGroup;
