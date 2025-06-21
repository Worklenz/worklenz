import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import EnhancedKanbanTaskCard from './EnhancedKanbanTaskCard';
import VirtualizedTaskList from './VirtualizedTaskList';
import './EnhancedKanbanGroup.css';

interface EnhancedKanbanGroupProps {
  group: ITaskListGroup;
  activeTaskId?: string | null;
  overId?: string | null;
}

// Performance threshold for virtualization
const VIRTUALIZATION_THRESHOLD = 50;

const EnhancedKanbanGroup: React.FC<EnhancedKanbanGroupProps> = React.memo(({ 
  group, 
  activeTaskId,
  overId 
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: group.id,
    data: {
      type: 'group',
      group,
    },
  });

  const groupRef = useRef<HTMLDivElement>(null);
  const [groupHeight, setGroupHeight] = useState(400);

  // Get task IDs for sortable context
  const taskIds = group.tasks.map(task => task.id!);
  
  // Check if this group is the target for dropping
  const isTargetGroup = overId === group.id;
  const isDraggingOver = isOver || isTargetGroup;

  // Determine if virtualization should be used
  const shouldVirtualize = useMemo(() => {
    return group.tasks.length > VIRTUALIZATION_THRESHOLD;
  }, [group.tasks.length]);

  // Calculate optimal height for virtualization
  useEffect(() => {
    if (groupRef.current) {
      const containerHeight = Math.min(
        Math.max(group.tasks.length * 80, 200), // Minimum 200px, scale with tasks
        600 // Maximum 600px
      );
      setGroupHeight(containerHeight);
    }
  }, [group.tasks.length]);

  // Memoize task rendering to prevent unnecessary re-renders
  const renderTask = useMemo(() => (task: any, index: number) => (
    <EnhancedKanbanTaskCard 
      key={task.id}
      task={task}
      isActive={task.id === activeTaskId}
      isDropTarget={overId === task.id}
    />
  ), [activeTaskId, overId]);

  // Performance optimization: Only render drop indicators when needed
  const shouldShowDropIndicators = isDraggingOver && !shouldVirtualize;

  return (
    <div 
      ref={setNodeRef}
      className={`enhanced-kanban-group ${isDraggingOver ? 'drag-over' : ''}`}
    >
      <div className="enhanced-kanban-group-header">
        <h3>{group.name}</h3>
        <span className="task-count">({group.tasks.length})</span>
        {shouldVirtualize && (
          <span className="virtualization-indicator" title="Virtualized for performance">
            ⚡
          </span>
        )}
      </div>
      
      <div className="enhanced-kanban-group-tasks" ref={groupRef}>
        {group.tasks.length === 0 && isDraggingOver && (
          <div className="drop-preview-empty">
            <div className="drop-indicator">Drop here</div>
          </div>
        )}
        
        {shouldVirtualize ? (
          // Use virtualization for large task lists
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <VirtualizedTaskList
              tasks={group.tasks}
              height={groupHeight}
              itemHeight={80}
              activeTaskId={activeTaskId}
              overId={overId}
              onTaskRender={renderTask}
            />
          </SortableContext>
        ) : (
          // Use standard rendering for smaller lists
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {group.tasks.map((task, index) => (
              <React.Fragment key={task.id}>
                {/* Show drop indicator before task if this is the target position */}
                {shouldShowDropIndicators && overId === task.id && (
                  <div className="drop-preview-indicator">
                    <div className="drop-line"></div>
                  </div>
                )}
                
                <EnhancedKanbanTaskCard 
                  task={task}
                  isActive={task.id === activeTaskId}
                  isDropTarget={overId === task.id}
                />
                
                {/* Show drop indicator after last task if dropping at the end */}
                {shouldShowDropIndicators && 
                 index === group.tasks.length - 1 && 
                 overId === group.id && (
                  <div className="drop-preview-indicator">
                    <div className="drop-line"></div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
});

export default EnhancedKanbanGroup; 