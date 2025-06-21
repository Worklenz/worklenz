import React, { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Card, Spin, Empty } from 'antd';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  UniqueIdentifier,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { RootState } from '@/app/store';
import { 
  fetchEnhancedKanbanGroups, 
  reorderEnhancedKanbanTasks,
  setDragState 
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import EnhancedKanbanGroup from './EnhancedKanbanGroup';
import EnhancedKanbanTaskCard from './EnhancedKanbanTaskCard';
import PerformanceMonitor from './PerformanceMonitor';
import './EnhancedKanbanBoard.css';

interface EnhancedKanbanBoardProps {
  projectId: string;
  className?: string;
}

const EnhancedKanbanBoard: React.FC<EnhancedKanbanBoardProps> = ({ projectId, className = '' }) => {
  const dispatch = useDispatch();
  const { 
    taskGroups, 
    loadingGroups, 
    error, 
    dragState,
    performanceMetrics 
  } = useSelector((state: RootState) => state.enhancedKanbanReducer);
  
  // Local state for drag overlay
  const [activeTask, setActiveTask] = useState<any>(null);
  const [activeGroup, setActiveGroup] = useState<any>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (projectId) {
      dispatch(fetchEnhancedKanbanGroups(projectId) as any);
    }
  }, [dispatch, projectId]);

  // Get all task IDs for sortable context
  const allTaskIds = useMemo(() => 
    taskGroups.flatMap(group => group.tasks.map(task => task.id!)), 
    [taskGroups]
  );
  const allGroupIds = useMemo(() => 
    taskGroups.map(group => group.id), 
    [taskGroups]
  );

  // Enhanced collision detection
  const collisionDetectionStrategy = (args: any) => {
    // First, let's see if we're colliding with any droppable areas
    const pointerIntersections = pointerWithin(args);
    const intersections = pointerIntersections.length > 0
      ? pointerIntersections
      : rectIntersection(args);
    
    let overId = getFirstCollision(intersections, 'id');

    if (overId) {
      // Check if we're over a task or a group
      const overGroup = taskGroups.find(g => g.id === overId);
      
      if (overGroup) {
        // We're over a group, check if there are tasks in it
        if (overGroup.tasks.length > 0) {
          // Find the closest task within this group
          const taskIntersections = pointerWithin({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (container: any) => container.data.current?.type === 'task'
            ),
          });
          
          if (taskIntersections.length > 0) {
            overId = taskIntersections[0].id;
          }
        }
      }
    }

    return overId ? [{ id: overId }] : [];
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    
    // Find the active task and group
    let foundTask = null;
    let foundGroup = null;
    
    for (const group of taskGroups) {
      const task = group.tasks.find(t => t.id === activeId);
      if (task) {
        foundTask = task;
        foundGroup = group;
        break;
      }
    }

    setActiveTask(foundTask);
    setActiveGroup(foundGroup);
    
    // Update Redux drag state
    dispatch(setDragState({
      activeTaskId: activeId,
      activeGroupId: foundGroup?.id || null,
      isDragging: true,
    }));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setOverId(null);
      dispatch(setDragState({ overId: null }));
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    
    setOverId(overId);
    
    // Update over ID in Redux
    dispatch(setDragState({ overId }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Reset local state
    setActiveTask(null);
    setActiveGroup(null);
    setOverId(null);
    
    // Reset Redux drag state
    dispatch(setDragState({
      activeTaskId: null,
      activeGroupId: null,
      overId: null,
      isDragging: false,
    }));

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source and target groups
    let sourceGroup = null;
    let targetGroup = null;
    let sourceIndex = -1;
    let targetIndex = -1;

    // Find source group and index
    for (const group of taskGroups) {
      const taskIndex = group.tasks.findIndex(t => t.id === activeId);
      if (taskIndex !== -1) {
        sourceGroup = group;
        sourceIndex = taskIndex;
        break;
      }
    }

    // Find target group and index
    for (const group of taskGroups) {
      const taskIndex = group.tasks.findIndex(t => t.id === overId);
      if (taskIndex !== -1) {
        targetGroup = group;
        targetIndex = taskIndex;
        break;
      }
    }

    // If dropping on a group (not a task)
    if (!targetGroup) {
      targetGroup = taskGroups.find(g => g.id === overId);
      if (targetGroup) {
        targetIndex = targetGroup.tasks.length; // Add to end of group
      }
    }

    if (!sourceGroup || !targetGroup || sourceIndex === -1) return;

    // Don't do anything if dropping in the same position
    if (sourceGroup.id === targetGroup.id && sourceIndex === targetIndex) return;

    // Create updated task arrays
    const updatedSourceTasks = [...sourceGroup.tasks];
    const [movedTask] = updatedSourceTasks.splice(sourceIndex, 1);

    let updatedTargetTasks: any[];
    if (sourceGroup.id === targetGroup.id) {
      // Moving within the same group
      updatedTargetTasks = updatedSourceTasks;
      updatedTargetTasks.splice(targetIndex, 0, movedTask);
    } else {
      // Moving between different groups
      updatedTargetTasks = [...targetGroup.tasks];
      updatedTargetTasks.splice(targetIndex, 0, movedTask);
    }

    // Dispatch the reorder action
    dispatch(reorderEnhancedKanbanTasks({
      activeGroupId: sourceGroup.id,
      overGroupId: targetGroup.id,
      fromIndex: sourceIndex,
      toIndex: targetIndex,
      task: movedTask,
      updatedSourceTasks,
      updatedTargetTasks,
    }) as any);
  };

  if (error) {
    return (
      <Card className={className}>
        <Empty description={`Error loading tasks: ${error}`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  return (
    <div className={`enhanced-kanban-board ${className}`}>
      {/* Performance Monitor - only show for large datasets */}
      {performanceMetrics.totalTasks > 100 && <PerformanceMonitor />}
      
      {loadingGroups ? (
        <Card>
          <div className="flex justify-center items-center py-8">
            <Spin size="large" />
          </div>
        </Card>
      ) : taskGroups.length === 0 ? (
        <Card>
          <Empty description="No tasks found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={allGroupIds} strategy={horizontalListSortingStrategy}>
            <div className="kanban-groups-container">
              {taskGroups.map(group => (
                <EnhancedKanbanGroup 
                  key={group.id} 
                  group={group}
                  activeTaskId={dragState.activeTaskId}
                  overId={overId}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeTask && (
              <EnhancedKanbanTaskCard 
                task={activeTask} 
                isDragOverlay={true}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};

export default EnhancedKanbanBoard; 