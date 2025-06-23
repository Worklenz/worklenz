import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import EnhancedKanbanTaskCard from './EnhancedKanbanTaskCard';
import VirtualizedTaskList from './VirtualizedTaskList';
import { useAppSelector } from '@/hooks/useAppSelector';
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
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: group.id,
    data: {
      type: 'group',
      group,
    },
  });

  // Add sortable functionality for group header
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isGroupDragging,
  } = useSortable({
    id: group.id,
    data: {
      type: 'group',
      group,
    },
    animateLayoutChanges: defaultAnimateLayoutChanges,
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

  // Combine refs for the main container
  const setRefs = (el: HTMLElement | null) => {
    setDroppableRef(el);
    setSortableRef(el);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isGroupDragging ? 0.5 : 1,
  };

  // Get the appropriate background color based on theme
  const headerBackgroundColor = useMemo(() => {
    if (themeMode === 'dark') {
      return group.color_code_dark || group.color_code || '#1e1e1e';
    }
    return group.color_code || '#f5f5f5';
  }, [themeMode, group.color_code, group.color_code_dark]);

  return (
    <div
      ref={setRefs}
      style={style}
      className={`enhanced-kanban-group ${isDraggingOver ? 'drag-over' : ''} ${isGroupDragging ? 'group-dragging' : ''}`}
    >
      <div
        className="enhanced-kanban-group-header"
        style={{
          backgroundColor: headerBackgroundColor,
        }}
        {...attributes}
        {...listeners}
      >
        <h3 title={group.name}>{group.name}</h3>
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