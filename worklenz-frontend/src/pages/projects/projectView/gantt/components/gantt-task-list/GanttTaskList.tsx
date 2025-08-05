import React, { memo, useCallback, useState, forwardRef, useRef, useEffect, useMemo } from 'react';
import { RightOutlined, DownOutlined, PlusOutlined, HolderOutlined, CalendarOutlined } from '@ant-design/icons';
import { Button, Tooltip, Input, DatePicker, Space, message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { DndContext, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GanttTask, GanttViewMode } from '../../types/gantt-types';
import { useSocket } from '../../../../../../socket/socketContext';
import { SocketEvents } from '../../../../../../shared/socket-events';
import { useAppDispatch } from '../../../../../../hooks/useAppDispatch';
import { addTask } from '../../../../../../features/task-management/task-management.slice';
import { useAuthService } from '../../../../../../hooks/useAuth';
import { useUpdatePhaseMutation } from '../../services/gantt-api.service';

// Utility function to add alpha channel to hex color
const addAlphaToHex = (hex: string, alpha: number): string => {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  // Return rgba string
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface GanttTaskListProps {
  tasks: GanttTask[];
  projectId: string;
  viewMode: GanttViewMode;
  onTaskToggle?: (taskId: string) => void;
  onTaskClick?: (taskId: string) => void;
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
  onTaskClick?: (taskId: string) => void;
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
  onTaskClick,
  expandedTasks, 
  onCreateTask,
  onCreateQuickTask, 
  isDraggable = false,
  activeId,
  overId,
  dragAttributes,
  dragListeners 
}) => {
  const [showInlineInput, setShowInlineInput] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [showDatePickers, setShowDatePickers] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();
  const [updatePhase] = useUpdatePhaseMutation();
  const formatDateRange = useCallback(() => {
    if (!task.start_date || !task.end_date) {
      return <span className="text-gray-400 dark:text-gray-500">Not scheduled</span>;
    }
    
    const start = new Date(task.start_date).toLocaleDateString();
    const end = new Date(task.end_date).toLocaleDateString();
    return `${start} - ${end}`;
  }, [task.start_date, task.end_date]);

  const isPhase = task.type === 'milestone' || task.is_milestone;
  const hasChildren = task.children && task.children.length > 0;
  // For phases, use phase_id for expansion state, for tasks use task.id
  const phaseId = isPhase ? (task.id === 'phase-unmapped' ? 'unmapped' : task.phase_id || task.id.replace('phase-', '')) : task.id;
  const isExpanded = expandedTasks.has(phaseId);
  const indentLevel = (task.level || 0) * 20;

  const handleToggle = useCallback(() => {
    // For phases, always allow toggle (regardless of having children)
    // Use the standard onToggle handler which will call handleTaskToggle in GanttTaskList
    if (isPhase && onToggle) {
      onToggle(phaseId);
    } else if (hasChildren && onToggle) {
      onToggle(task.id);
    }
  }, [isPhase, hasChildren, onToggle, task.id, phaseId]);

  const getTaskIcon = () => {
    // No icon for phases
    return null;
  };

  const getExpandIcon = () => {
    // All phases should be expandable (with or without children)
    if (isPhase) {
      return (
        <button
          onClick={handleToggle}
          className={`w-4 h-4 flex items-center justify-center rounded gantt-expand-icon ${
            isExpanded ? 'expanded' : ''
          } hover:bg-black/10`}
          style={task.color ? { color: task.color } : {}}
        >
          <RightOutlined className="text-xs transition-transform duration-200" />
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

  const handlePhaseDateUpdate = useCallback(async (startDate: Date, endDate: Date) => {
    if (!projectId || !task.phase_id) return;

    try {
      await updatePhase({
        project_id: projectId,
        phase_id: task.phase_id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      }).unwrap();
      
      message.success('Phase dates updated successfully');
      setShowDatePickers(false);
    } catch (error) {
      console.error('Failed to update phase dates:', error);
      message.error('Failed to update phase dates');
    }
  }, [projectId, task.phase_id, updatePhase]);

  const isEmpty = isPhase && (!task.children || task.children.length === 0);

  // Calculate phase completion percentage
  const phaseCompletion = useMemo(() => {
    if (!isPhase || !task.children || task.children.length === 0) {
      return 0;
    }
    const totalTasks = task.children.length;
    const completedTasks = task.children.filter(child => child.progress === 100).length;
    return Math.round((completedTasks / totalTasks) * 100);
  }, [isPhase, task.children]);

  const handleTaskClick = useCallback(() => {
    if (!isPhase && onTaskClick) {
      onTaskClick(task.id);
    }
  }, [isPhase, onTaskClick, task.id]);

  // Handle click outside to close date picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePickers(false);
      }
    };

    if (showDatePickers) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDatePickers]);

  return (
    <>
      <div 
        className={`group flex ${isPhase ? 'min-h-[4.5rem] gantt-phase-row' : 'h-9 gantt-task-row'} border-b border-gray-100 dark:border-gray-700 transition-colors ${
          !isPhase ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer' : ''
        } ${isDraggable && !isPhase ? 'cursor-grab active:cursor-grabbing' : ''} ${
          activeId === task.id ? 'opacity-50' : ''
        } ${overId === task.id && overId !== activeId ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
        style={isPhase && task.color ? {
          backgroundColor: addAlphaToHex(task.color, 0.15),
          color: task.color
        } : {}}
        onClick={!isPhase ? handleTaskClick : undefined}
        {...(!isPhase && isDraggable ? dragAttributes : {})}
        {...(!isPhase && isDraggable ? dragListeners : {})}
      >
        <div 
          className={`w-full px-2 py-2 text-sm ${isPhase ? '' : 'text-gray-800 dark:text-gray-200'} flex items-center justify-between`}
          style={{ 
            paddingLeft: `${8 + indentLevel + (isPhase && task.id === 'phase-unmapped' ? 28 : 0)}px`,
            color: isPhase && task.color ? task.color : undefined
          }}
        >
          <div className="flex items-center gap-2 truncate flex-1">
            {/* Drag handle for phases */}
            {isPhase && isDraggable && (
              <button
                {...dragAttributes}
                {...dragListeners}
                className="opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-black/10"
                style={{ color: task.color }}
                title="Drag to reorder phase"
              >
                <HolderOutlined className="text-xs" />
              </button>
            )}
            
            {getExpandIcon()}
            
            <div className="flex items-center gap-2 ml-1 truncate flex-1">
              {getTaskIcon()}
              <div className="flex flex-col flex-1">
                <span 
                  className={`truncate ${task.type === 'milestone' ? 'font-semibold' : ''}`}
                >
                  {task.name}
                </span>
                {isPhase && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs" style={{ color: task.color, opacity: 0.8 }}>
                      {task.children?.length || 0} tasks
                    </span>
                    {!showDatePickers && (
                      <button
                        onClick={() => setShowDatePickers(true)}
                        className="text-xs flex items-center gap-1 transition-colors"
                        style={{ color: task.color, opacity: 0.7 }}
                      >
                        <CalendarOutlined className="text-[10px]" />
                        {task.start_date && task.end_date ? (
                          <>{dayjs(task.start_date).format('MMM D')} - {dayjs(task.end_date).format('MMM D, YYYY')}</>
                        ) : (
                          'Set dates'
                        )}
                      </button>
                    )}
                    {showDatePickers && isPhase && (
                      <div ref={datePickerRef} className="flex items-center gap-1 mt-2 -ml-1">
                        <DatePicker.RangePicker
                          size="small"
                          value={[
                            task.start_date ? dayjs(task.start_date) : null,
                            task.end_date ? dayjs(task.end_date) : null
                          ]}
                          onChange={(dates) => {
                            if (dates && dates[0] && dates[1]) {
                              handlePhaseDateUpdate(dates[0].toDate(), dates[1].toDate());
                            }
                          }}
                          onOpenChange={(open) => {
                            if (!open) {
                              setShowDatePickers(false);
                            }
                          }}
                          className="text-xs"
                          style={{ width: 180 }}
                          format="MMM D, YYYY"
                          placeholder={['Start date', 'End date']}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Phase completion percentage on the right side */}
          {isPhase && task.children && task.children.length > 0 && (
            <div className="flex-shrink-0 mr-2">
              <span className="text-xs font-medium" style={{ color: task.color, opacity: 0.9 }}>
                {phaseCompletion}%
              </span>
            </div>
          )}

        </div>
      </div>

      {/* Inline task creation for all expanded phases */}
      {isPhase && isExpanded && (
        <div className="gantt-add-task-inline flex h-9 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div 
            className="w-full px-2 py-2 text-sm flex items-center"
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
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 gantt-add-task-btn"
              >
                Add Task
              </Button>
            )}
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
  viewMode,
  onTaskToggle, 
  onTaskClick,
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

  // Determine if the timeline has dual headers
  const hasDualHeaders = ['month', 'week', 'day'].includes(viewMode);
  const headerHeight = hasDualHeaders ? 'h-20' : 'h-10';

  return (
    <div className="w-[444px] min-w-[444px] max-w-[444px] h-full flex flex-col bg-gray-50 dark:bg-gray-900 gantt-task-list-container">
      <div className={`flex ${headerHeight} border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 font-medium text-sm flex-shrink-0 items-center`}>
        <div className="w-full px-4 text-gray-700 dark:text-gray-300">
          Task Name
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
                    onTaskClick={onTaskClick}
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
                    onTaskClick={onTaskClick}
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
                    onTaskClick={onTaskClick}
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