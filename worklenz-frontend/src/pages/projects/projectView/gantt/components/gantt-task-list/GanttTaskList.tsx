import React, { memo, useCallback, useState, forwardRef, useRef, useEffect, useMemo } from 'react';
import {
  RightOutlined,
  DownOutlined,
  PlusOutlined,
  HolderOutlined,
  CalendarOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { Button, Input, Space, message, theme } from '@/shared/antd-imports';
import dayjs from 'dayjs';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GanttTask, GanttViewMode, GanttGroupingMode } from '../../types/gantt-types';
import { formatDateLocal } from '../../utils/date-utils';
import { hasTopHeaderRow } from '../gantt-timeline/GanttTimeline';
import { useSocket } from '../../../../../../socket/socketContext';
import { SocketEvents } from '../../../../../../shared/socket-events';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { addTask } from '../../../../../../features/task-management/task-management.slice';
import { useTranslation } from 'react-i18next';
import useTaskCreationPermission from '@/hooks/useTaskCreationPermission';

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
  onPhaseClick?: (phase: GanttTask) => void;
  onCreateTask?: (phaseId?: string) => void;
  onCreateQuickTask?: (taskName: string, phaseId?: string) => void;
  onCreatePhase?: () => void;
  onCreateStatus?: () => void;
  onPhaseReorder?: (oldIndex: number, newIndex: number) => void;
  // Status group headers are reorderable too (persisted via the same status-order API
  // the Task List/Board views use). Priority has no such backing order, so it stays
  // non-draggable — see the groupingMode checks below.
  onStatusReorder?: (oldIndex: number, newIndex: number) => void;
  // anchorTaskId is the task the dragged task should end up immediately before,
  // or null to mean "end of group" (dropped on the trailing Add Task row, or on
  // a group header with no children yet).
  onTaskReorder?: (
    taskId: string,
    sourceGroupId: string,
    targetGroupId: string,
    anchorTaskId: string | null
  ) => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  expandedTasks?: Set<string>;
  onExpandedTasksChange?: (expanded: Set<string>) => void;
  animatingTasks?: Set<string>;
  onTaskNameClick?: (task: GanttTask) => void;
  groupingMode?: GanttGroupingMode;
  onSectionPositionUpdate?: (sectionId: string, top: number) => void;
}

interface TaskRowProps {
  task: GanttTask;
  index: number;
  projectId: string;
  onToggle?: (taskId: string) => void;
  onTaskClick?: (taskId: string) => void;
  onPhaseClick?: (phase: GanttTask) => void;
  expandedTasks: Set<string>;
  onCreateTask?: (phaseId?: string) => void;
  onCreateQuickTask?: (taskName: string, phaseId?: string) => void;
  isDraggable?: boolean;
  isAllCollapsed?: boolean;
  activeId?: string | null;
  overId?: string | null;
  animationClass?: string;
  onTaskNameClick?: (task: GanttTask) => void;
}

interface SortableTaskRowProps extends TaskRowProps {
  id: string;
}

// Sortable wrapper for phase milestones
const SortableTaskRow: React.FC<SortableTaskRowProps> = memo(props => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
  });

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

const TaskRow: React.FC<TaskRowProps & { dragAttributes?: any; dragListeners?: any }> = memo(
  ({
    task,
    projectId,
    onToggle,
    onTaskClick,
    onPhaseClick,
    expandedTasks,
    onCreateTask,
    onCreateQuickTask,
    isDraggable = false,
    activeId,
    overId,
    dragAttributes,
    dragListeners,
    animationClass = '',
    onTaskNameClick,
    isAllCollapsed = false,
  }) => {
    const { t } = useTranslation('gantt');
    const [showInlineInput, setShowInlineInput] = useState(false);
    const [taskName, setTaskName] = useState('');
    const { socket, connected } = useSocket();
    const dispatch = useAppDispatch();
    // ✅ After
    const formatDateRange = useCallback(() => {
      if (!task.start_date || !task.end_date) {
        return <span className="text-gray-400 dark:text-gray-500">Not scheduled</span>;
      }
      const start = dayjs(task.start_date).isValid() ? dayjs(task.start_date).format('MMM D, YYYY') : 'Invalid';
      const end = dayjs(task.end_date).isValid() ? dayjs(task.end_date).format('MMM D, YYYY') : 'Invalid';
      return `${start} - ${end}`;
    }, [task.start_date, task.end_date]);
    const isPhase = task.type === 'milestone' || task.is_milestone;
    const hasChildren = task.children && task.children.length > 0;
    
    // Determine section ID for expand/collapse state checking
    // This must match the logic in GanttChart.tsx flattenedTasks
    let sectionId = task.id;
    if (isPhase) {
      // For phases, use task.id directly (it's already phase-{id} or phase-unmapped)
      sectionId = task.id;
    } else if (task.status) {
      // For status groups, use status-{statusId} format
      sectionId = `status-${task.status}`;
    } else if (task.priority) {
      // For priority groups, the task.id is already priority-{value}
      sectionId = task.id;
    }
    
    const isExpanded = expandedTasks.has(sectionId);
    const indentLevel = (task.level || 0) * 20;

    const handleToggle = useCallback(() => {
      // For sections, always allow toggle (regardless of having children)
      // Use the standard onToggle handler which will call handleTaskToggle in GanttTaskList
      if (isPhase && onToggle) {
        onToggle(sectionId);
      } else if (hasChildren && onToggle) {
        onToggle(task.id);
      }
    }, [isPhase, hasChildren, onToggle, task.id, sectionId]);

    const getTaskIcon = () => {
      // No icon for phases
      return null;
    };

    const getExpandIcon = () => {
      // Show expand icon for phases
      if (isPhase) {
        return (
          <button
            onClick={handleToggle}
            className={`w-4 h-4 flex items-center justify-center rounded gantt-expand-icon ${
              isExpanded ? 'expanded' : ''
            } hover:bg-black/10 transition-transform`}
            style={task.color ? { color: task.color } : {}}
          >
            <RightOutlined className="text-xs" />
          </button>
        );
      }

      // Regular tasks with their own subtasks also get an expand/collapse arrow,
      // matching GanttChart.tsx's chevron for tasks that have subtasks.
      if (hasChildren) {
        const isTaskExpanded = expandedTasks.has(task.id);
        return (
          <button
            onClick={handleToggle}
            className={`w-4 h-4 flex items-center justify-center rounded gantt-expand-icon ${
              isTaskExpanded ? 'expanded' : ''
            } hover:bg-black/10 transition-transform`}
          >
            <RightOutlined className="text-xs" />
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
    const authUser = useAppSelector(state => state.auth?.user);
    
    const handleQuickTaskCreation = useCallback(
      (taskName: string) => {
        if (!connected || !socket || !projectId || !authUser) return;

        const phaseId = task.type === 'milestone' && task.phase_id ? task.phase_id : undefined;

        // Calculate 5-day span for inline task creation
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 4); // +4 to make it 5 days inclusive
        endDate.setHours(23, 59, 59, 999);

        const requestBody = {
          project_id: projectId,
          name: taskName.trim(),
          reporter_id: authUser.id,
          team_id: authUser.team_id,
          phase_id: phaseId,
          start_date: formatDateLocal(startDate),
          end_date: formatDateLocal(endDate),
        };

        socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(requestBody));

        // Handle the response and update UI
        socket.once(SocketEvents.QUICK_TASK.toString(), (response: any) => {
          if (response) {
            // The task will be automatically added to the task management slice
            // via global socket handlers, no need to call onCreateQuickTask again
            // The global socket listener in ProjectViewGantt will handle success messages
          }
        });

        // Reset input state
        setTaskName('');
        setShowInlineInput(false);
      },
      [connected, socket, projectId, task.type, task.phase_id, onCreateQuickTask, authUser]
    );

    const handleKeyPress = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && taskName.trim()) {
          handleQuickTaskCreation(taskName);
        } else if (e.key === 'Escape') {
          setTaskName('');
          setShowInlineInput(false);
        }
      },
      [taskName, handleQuickTaskCreation]
    );

    const handleShowInlineInput = useCallback(() => {
      if (!isAllCollapsed) {
        setShowInlineInput(true);
      }
    }, [isAllCollapsed]);

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

    const handlePhaseClick = useCallback(() => {
      if (isPhase && onPhaseClick) {
        onPhaseClick(task);
      }
    }, [isPhase, onPhaseClick, task]);

    const handleTaskNameClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPhase) return;
        // Open the task drawer and scroll/focus the timeline onto this task's bar —
        // clicking the name in the list should do both at once.
        if (onTaskClick) {
          onTaskClick(task.id);
        }
        if (onTaskNameClick) {
          onTaskNameClick(task);
        }
      },
      [isPhase, onTaskClick, onTaskNameClick, task]
    );

    const handleOpenButtonClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isPhase && onTaskClick) {
          onTaskClick(task.id);
        }
      },
      [isPhase, onTaskClick, task.id]
    );

    return (
      <>
      <>
        <div
          className={`group flex ${isPhase ? 'h-12 gantt-phase-row' : 'h-12 gantt-task-row'} border-b ${isExpanded && isPhase ? 'border-b-0' : ''} border-gray-100 dark:border-gray-700 transition-colors bg-white dark:bg-gray-800 ${!isPhase
              ? 'hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer'
              : ''
            } ${isDraggable && !isPhase ? 'cursor-grab active:cursor-grabbing' : ''} ${activeId === task.id ? 'opacity-50' : ''
            } ${overId === task.id && overId !== activeId ? 'ring-2 ring-blue-500 ring-inset' : ''} ${animationClass}`}
          style={
            isPhase && task.color
              ? {
                color: task.color,
              }
              : {}
          }
          {...(!isPhase && isDraggable ? dragAttributes : {})}
          {...(!isPhase && isDraggable ? dragListeners : {})}
        >
          <div
            className={`w-full px-3 py-1 text-xs ${isPhase ? '' : 'text-gray-800 dark:text-gray-200'} flex items-center justify-between`}
            style={{
              paddingLeft: `${12 + indentLevel + (isPhase && task.id === 'phase-unmapped' ? 28 : 0)}px`,
              color: isPhase && task.color ? task.color : undefined,
            }}
          >
            <div className="flex items-center gap-2 truncate flex-1">
              {/* Drag handle for phases */}
              {isPhase && isDraggable && (
                <button
                  {...dragAttributes}
                  {...dragListeners}
                  className="opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-black/5"
                  style={{ color: task.color }}
                  title="Drag to reorder"
                >
                  <HolderOutlined className="text-xs" />
                </button>
              )}

              {/* Drag handle for regular tasks — the whole row is already draggable
                  (dragAttributes/dragListeners spread on the row div below), this is
                  purely a visible affordance so the capability is discoverable, matching
                  the phase handle above. */}
              {!isPhase && isDraggable && (
                <span
                  className="opacity-0 group-hover:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-black/5 text-gray-400 dark:text-gray-500 flex-shrink-0"
                  title="Drag to reorder"
                >
                  <HolderOutlined className="text-xs" />
                </span>
              )}

              {getExpandIcon()}

              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getTaskIcon()}

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className={`truncate ${task.type === 'milestone'
                        ? 'font-semibold text-xs'
                        : 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors'
                      }`}
                    onClick={!isPhase ? handleTaskNameClick : undefined}
                    title={task.name}
                  >
                    {task.name}
                  </span>
                  

                </div>
              </div>
            </div>


          </div>
        </div>
        

      </>
      </>
    );
  }
);

TaskRow.displayName = 'TaskRow';

// Add Task Row Component — styled to match the main Task List tab's inline "+ Add Task"
// row (src/components/task-list-v2/components/AddTaskRow.tsx): a plain PlusOutlined +
// "Add Task" text button that swaps for an input on click, Enter to save.
interface AddTaskRowProps {
  id: string;
  phaseId?: string;
  onCreateQuickTask?: (taskName: string, phaseId?: string) => void;
}

const AddTaskRow: React.FC<AddTaskRowProps> = memo(({ id, phaseId, onCreateQuickTask }) => {
  const { t } = useTranslation('gantt');
  const [showInlineInput, setShowInlineInput] = useState(false);
  const [taskName, setTaskName] = useState('');
  // Droppable-only (not sortable/draggable itself) so dragging a task onto this
  // row moves it to the end of the section, matching the drag-to-reorder
  // behavior of dropping on a real task row.
  const { setNodeRef, isOver } = useDroppable({ id });

  const handleCreate = useCallback(() => {
    const trimmed = taskName.trim();
    if (trimmed) {
      onCreateQuickTask?.(trimmed, phaseId);
    }
    setTaskName('');
    setShowInlineInput(false);
  }, [taskName, phaseId, onCreateQuickTask]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCreate();
      } else if (e.key === 'Escape') {
        setTaskName('');
        setShowInlineInput(false);
      }
    },
    [handleCreate]
  );

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center h-12 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
        isOver ? 'ring-2 ring-blue-500 ring-inset' : ''
      }`}
    >
      <div
        className="w-full h-full flex items-center"
        style={{ paddingLeft: 32, paddingRight: 8 }}
      >
        {showInlineInput ? (
          <Input
            placeholder={t('task.addTaskInputPlaceholder', { defaultValue: 'Type task name and press Enter to save' })}
            value={taskName}
            onChange={e => setTaskName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleCreate}
            autoFocus
            className="text-xs"
            style={{ height: '100%' }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowInlineInput(true)}
            className="flex items-center gap-2 w-full h-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <PlusOutlined className="text-xs" />
            {t('task.addTask', { defaultValue: 'Add Task' })}
          </button>
        )}
      </div>
    </div>
  );
});

AddTaskRow.displayName = 'AddTaskRow';

// Add Phase Row Component
interface AddPhaseRowProps {
  projectId: string;
  onCreatePhase?: () => void;
}

const AddPhaseRow: React.FC<AddPhaseRowProps> = memo(({ projectId, onCreatePhase }) => {
  const { t } = useTranslation('gantt');
  return (
    <div className="gantt-add-phase-row flex h-12 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer">
      <div
        className="w-full px-3 py-1 text-xs flex items-center"
        style={{ paddingLeft: `12px` }}
        onClick={onCreatePhase}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center rounded-md bg-blue-500 text-white flex-shrink-0">
            <PlusOutlined className="text-xs" />
          </div>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{t('list.addNewPhase', { defaultValue: 'Add New Phase' })}</span>
        </div>
      </div>
    </div>
  );
});

AddPhaseRow.displayName = 'AddPhaseRow';

// Add Status Row Component
interface AddStatusRowProps {
  projectId: string;
  onCreateStatus?: () => void;
}

const AddStatusRow: React.FC<AddStatusRowProps> = memo(({ projectId, onCreateStatus }) => {
  const { t } = useTranslation('gantt');
  return (
    <div className="gantt-add-status-row flex h-12 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer">
      <div
        className="w-full px-3 py-1 text-xs flex items-center"
        style={{ paddingLeft: `12px` }}
        onClick={onCreateStatus}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center rounded-md bg-blue-500 text-white flex-shrink-0">
            <PlusOutlined className="text-xs" />
          </div>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{t('list.addNewStatus', { defaultValue: 'Add New Status' })}</span>
        </div>
      </div>
    </div>
  );
});

AddStatusRow.displayName = 'AddStatusRow';

const GanttTaskList = forwardRef<HTMLDivElement, GanttTaskListProps>(
  (
    {
      tasks,
      projectId,
      viewMode,
      onTaskToggle,
      onTaskClick,
      onPhaseClick,
      onCreateTask,
      onCreateQuickTask,
      onCreatePhase,
      onCreateStatus,
      onPhaseReorder,
      onStatusReorder,
      onTaskReorder,
      onScroll,
      expandedTasks: expandedTasksProp,
      onExpandedTasksChange,
      animatingTasks: animatingTasksProp,
      onTaskNameClick,
      groupingMode = 'phase',
      onSectionPositionUpdate,
    },
    ref
  ) => {
    const { canCreateTask } = useTaskCreationPermission();
    const { token } = theme.useToken();
    const { t } = useTranslation('gantt');
    // Collapsed by default — `task.expanded` is a data artifact set true on every task by
    // the API transform (roadmap-api.service.ts), not a per-task "should be expanded" flag,
    // so seeding from it here would default every task's subtasks open on first render.
    const [localExpandedTasks, setLocalExpandedTasks] = useState<Set<string>>(() => new Set());

    const expandedTasks = expandedTasksProp || localExpandedTasks;
    const animatingTasks = animatingTasksProp || new Set();

    // Drag and drop state
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);

    // DnD sensors
    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 8,
        },
      })
    );

    const handleTaskToggle = useCallback(
      (taskId: string) => {
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
      },
      [expandedTasks, onExpandedTasksChange, onTaskToggle]
    );

    // Flatten tasks based on expand/collapse state.
    // This mirrors GanttChart.tsx's flattenedTasks logic exactly (same taskParentMap
    // derivation, same recursion/visibility rules, same trailing filler row per section)
    // so the two panels always produce identical row order/heights and stay vertically
    // aligned — the filler row becomes an interactive "Add Task" row here (GanttChart.tsx's
    // side keeps a plain spacer, there's no natural place for an inline add affordance on
    // a date timeline).
    type VisibleRow = GanttTask | { id: string; isAddTaskRow: true; parentSectionId: string };

    // Build a map of child task id -> parent section id (phase/status/priority), plus
    // each section's ordered list of child task ids. Derived from the full `tasks` prop
    // (not the expand/collapse-filtered visible rows) so it stays correct even for
    // collapsed sections — needed both by flattenTasks below and by handleDragEnd to
    // resolve drop targets/anchors regardless of expand state.
    const { taskParentMap, groupChildTaskIds } = useMemo(() => {
      const parentMap = new Map<string, string>();
      const childIds = new Map<string, string[]>();

      tasks.forEach(task => {
        const taskIsPhase = task.type === 'milestone' || task.is_milestone;
        if (taskIsPhase) return;

        let parentId = '';
        if ((task as any).parent_priority !== undefined) {
          const priorityGroup = tasks.find(
            t => (t.type === 'milestone' || t.is_milestone) && t.priority === (task as any).parent_priority
          );
          if (priorityGroup) parentId = priorityGroup.id;
        } else if ((task as any).parent_status_id !== undefined) {
          parentId = `status-${(task as any).parent_status_id}`;
        } else if ((task as any).parent_phase_id !== undefined) {
          const phaseId = (task as any).parent_phase_id;
          parentId = phaseId === null || phaseId === 'null' ? 'phase-unmapped' : `phase-${phaseId}`;
        }

        if (parentId) {
          parentMap.set(task.id, parentId);
          if (!childIds.has(parentId)) childIds.set(parentId, []);
          childIds.get(parentId)!.push(task.id);
        }
      });

      return { taskParentMap: parentMap, groupChildTaskIds: childIds };
    }, [tasks]);

    const flattenTasks = useCallback(
      (taskList: GanttTask[]): VisibleRow[] => {
        const result: VisibleRow[] = [];
        const processedIds = new Set<string>(); // Track processed task IDs to prevent duplicates

        const processTask = (task: GanttTask, level: number = 0) => {
          const isPhase = task.type === 'milestone' || task.is_milestone;

          // Avoid processing the same task multiple times
          if (processedIds.has(task.id)) {
            return;
          }
          processedIds.add(task.id);

          // Skip child rows whose parent section is collapsed
          const parentId = taskParentMap.get(task.id);
          if (parentId && !expandedTasks.has(parentId)) {
            return;
          }

          // Set the correct level for nested tasks
          const taskWithLevel = { ...task, level };
          result.push(taskWithLevel);

          const isRowExpanded = expandedTasks.has(task.id);
          const children = task.children ?? task.sub_tasks;
          if (isRowExpanded) {
            if (children && children.length > 0) {
              children.forEach(child => processTask(child, level + 1));
            }

            // Trailing "Add Task" row at the end of every expanded section, even ones
            // with no tasks yet — matches GanttChart.tsx's flattenedTasks condition
            // exactly so the two panels stay aligned.
            if (isPhase) {
              const addRowId = `gantt-list-add-task-${task.id}`;
              if (!processedIds.has(addRowId)) {
                processedIds.add(addRowId);
                result.push({ id: addRowId, isAddTaskRow: true, parentSectionId: task.id });
              }
            }
          }
        };

        taskList.forEach(task => processTask(task, 0));
        return result;
      },
      [expandedTasks, taskParentMap]
    );

    const visibleTasks = flattenTasks(tasks);
    const visibleRealTasks = useMemo(
      () => visibleTasks.filter((task): task is GanttTask => !('isAddTaskRow' in task)),
      [visibleTasks]
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

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setOverId(null);

        if (!over || active.id === over.id) return;

        const draggedId = active.id as string;
        const droppedOnId = over.id as string;
        const activeTask = visibleRealTasks.find(t => t.id === draggedId);
        if (!activeTask) return;

        // Group header reordering — Phase and Status both have a persisted order and
        // can be dragged. Priority is a fixed system order (Critical/High/Medium/Low)
        // with no backing order to persist, so its headers aren't draggable at all
        // (see the render branch below) and never reach this code.
        if (
          (activeTask.type === 'milestone' || activeTask.is_milestone) &&
          (groupingMode === 'phase' || groupingMode === 'status')
        ) {
          const reorderHandler = groupingMode === 'phase' ? onPhaseReorder : onStatusReorder;
          if (!reorderHandler) return;

          const overTask = visibleRealTasks.find(t => t.id === droppedOnId);
          if (!overTask) return;
          const groupHeaders = tasks.filter(task => task.type === 'milestone' || task.is_milestone);
          const oldIndex = groupHeaders.findIndex(group => group.id === draggedId);
          const newIndex = groupHeaders.findIndex(group => group.id === droppedOnId);

          if (oldIndex !== -1 && newIndex !== -1) {
            reorderHandler(oldIndex, newIndex);
          }
          return;
        }

        // Task reordering/moving — same-group and cross-group, for whichever
        // grouping mode (phase/status/priority) is currently active.
        if (!(activeTask.type === 'milestone' || activeTask.is_milestone) && onTaskReorder) {
          const sourceGroupId = taskParentMap.get(activeTask.id);
          if (!sourceGroupId) return;

          let targetGroupId: string | undefined;
          // The task that should end up immediately after the dragged task, or
          // null to mean "end of group" — see GanttTaskListProps.onTaskReorder.
          let anchorTaskId: string | null = null;

          if (droppedOnId.startsWith('gantt-list-add-task-')) {
            // Dropped on the trailing "Add Task" row -> end of that group.
            targetGroupId = droppedOnId.replace('gantt-list-add-task-', '');
          } else {
            const overTask = visibleRealTasks.find(t => t.id === droppedOnId);
            if (!overTask) return;

            if (overTask.type === 'milestone' || overTask.is_milestone) {
              // Dropped on a group header -> start of that group.
              targetGroupId = overTask.id;
              const siblings = groupChildTaskIds.get(targetGroupId) || [];
              anchorTaskId = siblings.find(id => id !== activeTask.id) ?? null;
            } else {
              // Dropped on another task -> land adjacent to it.
              targetGroupId = taskParentMap.get(overTask.id);
              anchorTaskId = overTask.id;
            }
          }

          if (!targetGroupId) return;

          onTaskReorder(activeTask.id, sourceGroupId, targetGroupId, anchorTaskId);
        }
      },
      [
        tasks,
        visibleRealTasks,
        groupingMode,
        onPhaseReorder,
        onStatusReorder,
        onTaskReorder,
        taskParentMap,
        groupChildTaskIds,
      ]
    );

    // Separate group headers and tasks for drag and drop (exclude unmapped phase). Only
    // Phase and Status headers are draggable — Priority has no persisted order.
    const phases =
      groupingMode === 'phase' || groupingMode === 'status'
        ? visibleRealTasks.filter(
            task => (task.type === 'milestone' || task.is_milestone) && task.id !== 'phase-unmapped'
          )
        : [];
    const regularTasks = visibleRealTasks.filter(
      task => !(task.type === 'milestone' || task.is_milestone)
    );

    // All draggable items (phases + tasks)
    const allDraggableItems = [...phases.map(p => p.id), ...regularTasks.map(t => t.id)];
    const phasesSet = new Set(phases.map(p => p.id));

    // Matches GanttTimeline.tsx's header stack height exactly (TOP_HEADER_HEIGHT 24px +
    // UNIT_HEADER_HEIGHT 34px, same constants as Planner > Timeline). Uses the same
    // hasTopHeaderRow helper GanttTimeline.tsx derives its own hasTopHeaders from, instead
    // of a separately hardcoded view-mode list that could silently drift out of sync.
    const hasDualHeaders = hasTopHeaderRow(viewMode);
    const headerHeightPx = hasDualHeaders ? 24 + 34 : 34;

    // Check if all rows are collapsed
    const allPhasesIds = useMemo(
      () => visibleRealTasks
        .filter(task => task.type === 'milestone' || task.is_milestone)
        .map(task => task.id),
      [visibleRealTasks]
    );
    // Checking raw expandedTasks.size here would misreport "collapsed" as false whenever
    // the set contains only stale ids left over from a renamed/deleted section (phase ids
    // in particular churn often), even though none of them match anything currently
    // visible — so check for overlap with the sections that actually exist instead.
    const isAllCollapsed =
      allPhasesIds.length > 0 && !allPhasesIds.some(id => expandedTasks.has(id));

    return (
      <div
        className="w-full h-full flex flex-col gantt-task-list-container"
        style={{ backgroundColor: token.colorBgContainer }}
      >
        <div
          className="flex border-b font-medium text-xs flex-shrink-0 items-center"
          style={{
            height: headerHeightPx,
            backgroundColor: token.colorBgContainer,
            borderBottomColor: token.colorBorderSecondary,
          }}
        >
          <div className="w-full px-4 text-gray-700 dark:text-gray-300">{t('list.taskNameColumn', { defaultValue: 'Task Name' })}</div>
        </div>
        <div className="flex-1 gantt-task-list-scroll relative" ref={ref} onScroll={onScroll}>
          {visibleRealTasks.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {t('list.noTasksAvailable', { defaultValue: 'No tasks available' })}
            </div>
          )}

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={allDraggableItems} strategy={verticalListSortingStrategy}>
              {visibleTasks.map((row, index) => {
                // Trailing per-section row — matches GanttChart.tsx's per-section filler
                // row position/height exactly, so the two panels stay aligned. Phase,
                // Status, and Priority groups all get a real inline "Add Task" row —
                // Priority-section creation assigns that section's own priority
                // (handled in ProjectViewGantt.tsx's handleCreateQuickTask), same as how
                // Status-section creation assigns its own status.
                if ('isAddTaskRow' in row) {
                  if (!canCreateTask) {
                    return (
                      <div
                        key={row.id}
                        className="h-12 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800"
                      />
                    );
                  }

                  const phaseId = row.parentSectionId === 'phase-unmapped'
                    ? undefined
                    : row.parentSectionId.startsWith('phase-')
                      ? row.parentSectionId.replace('phase-', '')
                      : row.parentSectionId;

                  return (
                    <AddTaskRow
                      key={row.id}
                      id={row.id}
                      phaseId={phaseId}
                      onCreateQuickTask={onCreateQuickTask}
                    />
                  );
                }

                const task = row as GanttTask;
                const isPhase = task.type === 'milestone' || task.is_milestone;
                const isUnmappedPhase = task.id === 'phase-unmapped';

                // Determine if this task should have animation classes
                let parentPhaseId = '';
                if (isPhase) {
                  parentPhaseId =
                    task.id === 'phase-unmapped'
                      ? 'unmapped'
                      : task.phase_id || task.id.replace('phase-', '');
                } else {
                  parentPhaseId = task.phase_id || '';
                }

                const shouldAnimate = !isPhase && animatingTasks.has(parentPhaseId);
                const staggerIndex = Math.min((index - 1) % 5, 4); // Subtract 1 to account for phase row, limit stagger to 5 levels

                if (
                  isPhase &&
                  !isUnmappedPhase &&
                  (groupingMode === 'phase' || groupingMode === 'status')
                ) {
                  return (
                    <SortableTaskRow
                      key={task.id}
                      id={task.id}
                      task={task}
                      index={index}
                      projectId={projectId}
                      onToggle={handleTaskToggle}
                      onTaskClick={onTaskClick}
                      onPhaseClick={onPhaseClick}
                      expandedTasks={expandedTasks}
                      onCreateTask={onCreateTask}
                      onCreateQuickTask={onCreateQuickTask}
                      activeId={activeId}
                      overId={overId}
                      onTaskNameClick={onTaskNameClick}
                      isAllCollapsed={isAllCollapsed}
                    />
                  );
                } else if (isPhase && !isUnmappedPhase) {
                  // Priority group headers — no persisted order to reorder against, so
                  // render plain and non-draggable (matches Task List's behavior).
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      index={index}
                      projectId={projectId}
                      onToggle={handleTaskToggle}
                      onTaskClick={onTaskClick}
                      onPhaseClick={onPhaseClick}
                      expandedTasks={expandedTasks}
                      onCreateTask={onCreateTask}
                      onCreateQuickTask={onCreateQuickTask}
                      isDraggable={false}
                      activeId={activeId}
                      overId={overId}
                      onTaskNameClick={onTaskNameClick}
                      isAllCollapsed={isAllCollapsed}
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
                      onPhaseClick={onPhaseClick}
                      expandedTasks={expandedTasks}
                      onCreateTask={onCreateTask}
                      onCreateQuickTask={onCreateQuickTask}
                      isDraggable={false}
                      activeId={activeId}
                      overId={overId}
                      onTaskNameClick={onTaskNameClick}
                      isAllCollapsed={isAllCollapsed}
                    />
                  );
                } else {
                  // Regular tasks - make them draggable too with animation
                  const animationClass = shouldAnimate
                    ? `gantt-task-slide-in gantt-task-stagger-${staggerIndex + 1}`
                    : '';

                  return (
                    <SortableTaskRow
                      key={task.id}
                      id={task.id}
                      task={task}
                      index={index}
                      projectId={projectId}
                      onToggle={handleTaskToggle}
                      onTaskClick={onTaskClick}
                      onPhaseClick={onPhaseClick}
                      expandedTasks={expandedTasks}
                      onCreateTask={onCreateTask}
                      onCreateQuickTask={onCreateQuickTask}
                      activeId={activeId}
                      overId={overId}
                      animationClass={animationClass}
                      onTaskNameClick={onTaskNameClick}
                      isAllCollapsed={isAllCollapsed}
                    />
                  );
                }
              })}
            </SortableContext>
          </DndContext>

          {/* Add Phase Row - only show in phase view */}
          {groupingMode === 'phase' && (
            <AddPhaseRow projectId={projectId} onCreatePhase={onCreatePhase} />
          )}

          {/* Add Status Row - only show in status view */}
          {groupingMode === 'status' && (
            <AddStatusRow projectId={projectId} onCreateStatus={onCreateStatus} />
          )}

          {/* Priority view has no "add new" concept — render a matching trailing
              spacer so the row still lines up with GanttChart.tsx's own trailing spacer. */}
          {groupingMode === 'priority' && (
            <div className="h-12 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20" />
          )}
        </div>
      </div>
    );
  }
);

GanttTaskList.displayName = 'GanttTaskList';

export default memo(GanttTaskList);
