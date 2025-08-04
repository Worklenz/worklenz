import React, { memo, useCallback, useState, forwardRef } from 'react';
import { RightOutlined, DownOutlined, StarOutlined, PlusOutlined, HolderOutlined } from '@ant-design/icons';
import { Button, Tooltip, Input } from 'antd';
import { DndContext, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GanttTask } from '../../types/gantt-types';
import { useSocket } from '../../../../../../socket/socketContext';
import { SocketEvents } from '../../../../../../shared/socket-events';
import { useAppDispatch } from '../../../../../../hooks/useAppDispatch';
import { addTask } from '../../../../../../features/task-management/task-management.slice';
import { useAuthService } from '../../../../../../hooks/useAuth';

interface GanttTaskListProps {
  tasks: GanttTask[];
  projectId: string;
  onTaskToggle?: (taskId: string) => void;
  onCreateTask?: (phaseId?: string) => void;
  onCreateQuickTask?: (taskName: string, phaseId?: string) => void;
  onPhaseReorder?: (oldIndex: number, newIndex: number) => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  expandedTasks?: Set<string>;
  onExpandedTasksChange?: (expanded: Set<string>) => void;
}

interface TaskRowProps {
  task: GanttTask;
  index: number;
  projectId: string;
  onToggle?: (taskId: string) => void;
  expandedTasks: Set<string>;
  onCreateTask?: (phaseId?: string) => void;
  onCreateQuickTask?: (taskName: string, phaseId?: string) => void;
  isDraggable?: boolean;
  activeId?: string | null;
  overId?: string | null;
}

interface SortableTaskRowProps extends TaskRowProps {
  id: string;
}

// Sortable wrapper for phase milestones
const SortableTaskRow: React.FC<SortableTaskRowProps> = memo((props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow 
        {...props} 
        isDraggable={true}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
});

SortableTaskRow.displayName = 'SortableTaskRow';

const TaskRow: React.FC<TaskRowProps & { dragAttributes?: any; dragListeners?: any }> = memo(({ 
  task, 
  projectId,
  onToggle, 
  expandedTasks, 
  onCreateTask,
  onCreateQuickTask, 
  isDraggable = false,
  dragAttributes,
  dragListeners 
}) => {
  const [showInlineInput, setShowInlineInput] = useState(false);
  const [taskName, setTaskName] = useState('');
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();
  const formatDateRange = useCallback(() => {
    if (!task.start_date || !task.end_date) {
      return <span className="text-gray-400 dark:text-gray-500">Not scheduled</span>;
    }
    
    const start = new Date(task.start_date).toLocaleDateString();
    const end = new Date(task.end_date).toLocaleDateString();
    return `${start} - ${end}`;
  }, [task.start_date, task.end_date]);

  const hasChildren = task.children && task.children.length > 0;
  const isExpanded = expandedTasks.has(task.id);
  const indentLevel = (task.level || 0) * 20;

  const handleToggle = useCallback(() => {
    if (hasChildren && onToggle) {
      onToggle(task.id);
    }
  }, [hasChildren, onToggle, task.id]);

  const getTaskIcon = () => {
    if (task.type === 'milestone' || task.is_milestone) {
      return <StarOutlined className="text-blue-500 text-xs" />;
    }
    return null;
  };

  const getExpandIcon = () => {
    // For empty phases, show expand icon to allow adding tasks
    if (isEmpty || hasChildren) {
      return (
        <button
          onClick={handleToggle}
          className="w-4 h-4 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        >
          {isExpanded ? (
            <DownOutlined className="text-xs" />
          ) : (
            <RightOutlined className="text-xs" />
          )}
        </button>
      );
    }
    
    return <div className="w-4 h-4" />;
  };

  const handleCreateTask = () => {
    if (onCreateTask) {
      // For phase milestones, pass the phase ID
      const phaseId = task.type === 'milestone' && task.phase_id ? task.phase_id : undefined;
      onCreateTask(phaseId);
    }
  };

  // Handle inline task creation
  const handleQuickTaskCreation = useCallback((taskName: string) => {
    if (!connected || !socket || !projectId) return;

    const currentSession = JSON.parse(localStorage.getItem('session') || '{}');
    const phaseId = task.type === 'milestone' && task.phase_id ? task.phase_id : undefined;

    const requestBody = {
      project_id: projectId,
      name: taskName.trim(),
      reporter_id: currentSession.id,
      team_id: currentSession.team_id,
      phase_id: phaseId,
    };

    socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(requestBody));

    // Handle the response and update UI
    socket.once(SocketEvents.QUICK_TASK.toString(), (response: any) => {
      if (response) {
        // The task will be automatically added to the task management slice
        // via global socket handlers, but we need to refresh the Gantt data
        onCreateQuickTask?.(taskName, phaseId);
      }
    });

    // Reset input state
    setTaskName('');
    setShowInlineInput(false);
  }, [connected, socket, projectId, task.type, task.phase_id, onCreateQuickTask]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && taskName.trim()) {
      handleQuickTaskCreation(taskName);
    } else if (e.key === 'Escape') {
      setTaskName('');
      setShowInlineInput(false);
    }
  }, [taskName, handleQuickTaskCreation]);

  const handleShowInlineInput = useCallback(() => {
    setShowInlineInput(true);
  }, []);

  const isPhase = task.type === 'milestone' || task.is_milestone;
  const isEmpty = isPhase && (!task.children || task.children.length === 0);

  return (
    <>
      <div 
        className={`group flex h-9 border-b border-gray-100 dark:border-gray-700 transition-colors ${
          task.type === 'milestone' 
            ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30' 
            : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
        } ${isDraggable && !isPhase ? 'cursor-grab active:cursor-grabbing' : ''} ${
          activeId === task.id ? 'opacity-50' : ''
        } ${overId === task.id && overId !== activeId ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
        {...(!isPhase && isDraggable ? dragAttributes : {})}
        {...(!isPhase && isDraggable ? dragListeners : {})}
      >
        <div 
          className="w-[420px] px-2 py-2 text-sm text-gray-800 dark:text-gray-200 flex items-center justify-between"
          style={{ paddingLeft: `${8 + indentLevel}px` }}
        >
          <div className="flex items-center gap-2 truncate">
            {/* Drag handle for phases */}
            {isPhase && isDraggable && (
              <button
                {...dragAttributes}
                {...dragListeners}
                className="opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/50"
                title="Drag to reorder phase"
              >
                <HolderOutlined className="text-xs" />
              </button>
            )}
            
            {getExpandIcon()}
            
            <div className="flex items-center gap-2 ml-1 truncate">
              {getTaskIcon()}
              <span className={`truncate ${task.type === 'milestone' ? 'font-semibold text-blue-700 dark:text-blue-300' : ''}`}>
                {task.name}
              </span>
            </div>
          </div>

          {/* Add Task button for phases */}
          {isPhase && onCreateTask && (
            <Tooltip title="Add task to this phase">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleCreateTask}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center hover:bg-white/50 dark:hover:bg-gray-600"
              />
            </Tooltip>
          )}
        </div>
        <div className="w-[64px] px-2 py-2 text-xs text-center text-gray-600 dark:text-gray-400 flex-shrink-0 border-l border-gray-100 dark:border-gray-700">
          {formatDateRange()}
        </div>
      </div>

      {/* Inline task creation for empty expanded phases */}
      {isEmpty && isExpanded && (
        <div className="flex h-9 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div 
            className="w-[420px] px-2 py-2 text-sm flex items-center"
            style={{ paddingLeft: `${8 + 40}px` }} // Extra indent for child
          >
            {showInlineInput ? (
              <Input
                size="small"
                placeholder="Enter task name..."
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                onKeyDown={handleKeyPress}
                onBlur={() => {
                  if (!taskName.trim()) {
                    setShowInlineInput(false);
                  }
                }}
                autoFocus
                className="text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            ) : (
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleShowInlineInput}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Add Task
              </Button>
            )}
          </div>
          <div className="w-[64px] px-2 py-2 text-xs text-center text-gray-600 dark:text-gray-400 border-l border-gray-100 dark:border-gray-700">
            {/* Empty duration column */}
          </div>
        </div>
      )}
    </>
  );
});

TaskRow.displayName = 'TaskRow';

const GanttTaskList = forwardRef<HTMLDivElement, GanttTaskListProps>(({ 
  tasks, 
  projectId, 
  onTaskToggle, 
  onCreateTask, 
  onCreateQuickTask, 
  onPhaseReorder, 
  onScroll,
  expandedTasks: expandedTasksProp,
  onExpandedTasksChange
}, ref) => {
  const [localExpandedTasks, setLocalExpandedTasks] = useState<Set<string>>(
    () => new Set(tasks.filter(t => t.expanded).map(t => t.id))
  );
  
  const expandedTasks = expandedTasksProp || localExpandedTasks;
  
  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  
  // Socket and auth
  const { socket, connected } = useSocket();
  const currentSession = useAuthService().getCurrentSession();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleTaskToggle = useCallback((taskId: string) => {
    const updateExpanded = (prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    };
    
    if (onExpandedTasksChange) {
      onExpandedTasksChange(updateExpanded(expandedTasks));
    } else {
      setLocalExpandedTasks(updateExpanded);
    }
    
    onTaskToggle?.(taskId);
  }, [expandedTasks, onExpandedTasksChange, onTaskToggle]);

  // Flatten tasks based on expand/collapse state
  const flattenTasks = useCallback((taskList: GanttTask[]): GanttTask[] => {
    const result: GanttTask[] = [];
    
    const processTask = (task: GanttTask) => {
      result.push(task);
      
      if (task.children && expandedTasks.has(task.id)) {
        task.children.forEach(child => processTask(child));
      }
    };
    
    taskList.forEach(processTask);
    return result;
  }, [expandedTasks]);

  const visibleTasks = flattenTasks(tasks);

  // Emit task sort change via socket for moving tasks between phases
  const emitTaskPhaseChange = useCallback(
    (taskId: string, fromPhaseId: string | null, toPhaseId: string | null, sortOrder: number) => {
      if (!socket || !connected || !projectId) return;
      
      const task = visibleTasks.find(t => t.id === taskId);
      if (!task || task.type === 'milestone' || task.is_milestone) return;
      
      const teamId = currentSession?.team_id || '';
      
      const socketData = {
        project_id: projectId,
        group_by: 'phase',
        task_updates: [{
          task_id: taskId,
          sort_order: sortOrder,
          phase_id: toPhaseId
        }],
        from_group: fromPhaseId || 'unmapped',
        to_group: toPhaseId || 'unmapped',
        task: {
          id: task.id,
          project_id: projectId,
          status: '',
          priority: '',
        },
        team_id: teamId,
      };
      
      socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), socketData);
    },
    [socket, connected, projectId, visibleTasks, currentSession]
  );

  const handleDragStart = useCallback((event: any) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setOverId(null);
      return;
    }
    
    setOverId(over.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id) return;

    const activeTask = visibleTasks.find(t => t.id === active.id);
    const overTask = visibleTasks.find(t => t.id === over.id);
    
    // Handle phase reordering (existing functionality)
    if (activeTask && (activeTask.type === 'milestone' || activeTask.is_milestone) && onPhaseReorder) {
      const phases = tasks.filter(task => task.type === 'milestone' || task.is_milestone);
      const oldIndex = phases.findIndex(phase => phase.id === active.id);
      const newIndex = phases.findIndex(phase => phase.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        onPhaseReorder(oldIndex, newIndex);
      }
      return;
    }
    
    // Handle task moving between phases
    if (activeTask && !(activeTask.type === 'milestone' || activeTask.is_milestone)) {
      let targetPhaseId: string | null = null;
      
      // If dropped on a phase, move to that phase
      if (overTask && (overTask.type === 'milestone' || overTask.is_milestone)) {
        targetPhaseId = overTask.phase_id || overTask.id.replace('phase-', '');
        if (overTask.id === 'phase-unmapped') {
          targetPhaseId = null;
        }
      } else if (overTask) {
        // If dropped on another task, move to that task's phase
        targetPhaseId = overTask.phase_id;
      }
      
      // Find current phase
      const currentPhaseId = activeTask.phase_id;
      
      // Only emit if phase actually changed
      if (currentPhaseId !== targetPhaseId) {
        emitTaskPhaseChange(activeTask.id, currentPhaseId, targetPhaseId, 0);
      }
    }
  }, [tasks, visibleTasks, onPhaseReorder, emitTaskPhaseChange]);

  // Separate phases and tasks for drag and drop (exclude unmapped phase)
  const phases = visibleTasks.filter(task => 
    (task.type === 'milestone' || task.is_milestone) && task.id !== 'phase-unmapped'
  );
  const regularTasks = visibleTasks.filter(task => 
    !(task.type === 'milestone' || task.is_milestone)
  );
  
  // All draggable items (phases + tasks)
  const allDraggableItems = [...phases.map(p => p.id), ...regularTasks.map(t => t.id)];
  const phasesSet = new Set(phases.map(p => p.id));

  return (
    <div className="w-[508px] min-w-[508px] max-w-[508px] h-full flex flex-col bg-gray-50 dark:bg-gray-900 gantt-task-list-container">
      <div className="flex h-10 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 font-medium text-sm flex-shrink-0">
        <div className="w-[420px] px-4 py-2.5 text-gray-700 dark:text-gray-300">
          Task Name
        </div>
        <div className="w-[64px] px-2 py-2.5 text-center text-gray-700 dark:text-gray-300 text-xs border-l border-gray-200 dark:border-gray-700">
          Duration
        </div>
      </div>
      <div className="flex-1 gantt-task-list-scroll relative" ref={ref} onScroll={onScroll}>
        {visibleTasks.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No tasks available
          </div>
        )}
        
        <DndContext 
          sensors={sensors} 
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={allDraggableItems}
            strategy={verticalListSortingStrategy}
          >
            {visibleTasks.map((task, index) => {
              const isPhase = task.type === 'milestone' || task.is_milestone;
              const isUnmappedPhase = task.id === 'phase-unmapped';
              
              if (isPhase && !isUnmappedPhase) {
                return (
                  <SortableTaskRow
                    key={task.id}
                    id={task.id}
                    task={task}
                    index={index}
                    projectId={projectId}
                    onToggle={handleTaskToggle}
                    expandedTasks={expandedTasks}
                    onCreateTask={onCreateTask}
                    onCreateQuickTask={onCreateQuickTask}
                    activeId={activeId}
                    overId={overId}
                  />
                );
              } else if (isUnmappedPhase) {
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    index={index}
                    projectId={projectId}
                    onToggle={handleTaskToggle}
                    expandedTasks={expandedTasks}
                    onCreateTask={onCreateTask}
                    onCreateQuickTask={onCreateQuickTask}
                    isDraggable={false}
                    activeId={activeId}
                    overId={overId}
                  />
                );
              } else {
                // Regular tasks - make them draggable too
                return (
                  <SortableTaskRow
                    key={task.id}
                    id={task.id}
                    task={task}
                    index={index}
                    projectId={projectId}
                    onToggle={handleTaskToggle}
                    expandedTasks={expandedTasks}
                    onCreateTask={onCreateTask}
                    onCreateQuickTask={onCreateQuickTask}
                    activeId={activeId}
                    overId={overId}
                  />
                );
              }
            })}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
});

GanttTaskList.displayName = 'GanttTaskList';

export default memo(GanttTaskList);