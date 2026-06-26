import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  TouchSensor,
  closestCenter,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { HolderOutlined, theme, Input } from '@/shared/antd-imports';
import { PlusOutlined } from '@/shared/antd-imports';
import './column-resize.css';

// Redux hooks and selectors
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  selectAllTasksArray,
  selectGroups,
  selectGrouping,
  selectLoading,
  selectError,
  fetchTasksV3,
  fetchTaskListColumns,
  reorderTasks,
  selectColumns,
  selectCustomColumns,
  selectLoadingColumns,
  selectLoadedProjectId,
  setDuplicateTaskModalStatus,
} from '@/features/task-management/task-management.slice';
import { setProjectContext } from '@/features/task-management/taskListFields.slice';
import {
  selectCurrentGrouping,
  selectCollapsedGroups,
  toggleGroupCollapsed,
} from '@/features/task-management/grouping.slice';
import {
  selectSelectedTaskIds,
  selectLastSelectedTaskId,
  selectTask,
  toggleTaskSelection,
  selectRange,
  clearSelection,
} from '@/features/task-management/selection.slice';
import {
  setCustomColumnModalAttributes,
  toggleCustomColumnModalOpen,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import {
  fetchTask as fetchTaskDrawer,
  setNavigationContext,
  setSelectedTaskId,
  setShowTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';
import { useAuthService } from '@/hooks/useAuth';
import useTaskCreationPermission from '@/hooks/useTaskCreationPermission';

// Components
import TaskRowWithSubtasks from './TaskRowWithSubtasks';
import TaskGroupHeader from './TaskGroupHeader';
import OptimizedBulkActionBar from '@/components/task-management/optimized-bulk-action-bar';
import CustomColumnModal from '@/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/custom-column-modal';
import AddTaskRow from './components/AddTaskRow';
import { AddCustomColumnButton, CustomColumnHeader } from './components/CustomColumnComponents';
import TaskListSkeleton from './components/TaskListSkeleton';
import ConvertToSubtaskDrawer from '@/components/task-list-common/convert-to-subtask-drawer/convert-to-subtask-drawer';
import {
  DragHandleColumn,
  CheckboxColumn,
  TaskKeyColumn,
  StatusColumn,
  AssigneesColumn,
  PriorityColumn,
  ProgressColumn,
  LabelsColumnWithOverflow,
  PhaseColumn,
  TimeTrackingColumn,
  EstimationColumn,
  DateColumn,
  ReporterColumn,
  DescriptionColumn,
} from './components/TaskRowColumns';
import { DatePickerColumn } from './components/DatePickerColumn';

// Drop Spacer Component - creates space between tasks when dragging
const DropSpacer: React.FC<{ isVisible: boolean; visibleColumns: any[]; isDarkMode?: boolean }> = ({
  isVisible,
  visibleColumns,
  isDarkMode = false,
}) => {
  if (!isVisible) return null;

  return (
    <div
      className="flex items-center min-w-max px-1 border-2 border-dashed border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 transition-all duration-200 ease-in-out"
      style={{
        height: isVisible ? '40px' : '0px',
        opacity: isVisible ? 1 : 0,
        marginTop: isVisible ? '2px' : '0px',
        marginBottom: isVisible ? '2px' : '0px',
        overflow: 'hidden',
      }}
    >
      {visibleColumns.map((column, index) => {
        // Calculate left position for sticky columns
        let leftPosition = 0; // Start at 0 to cover the row's left padding
        if (column.isSticky) {
          for (let i = 0; i < index; i++) {
            const prevColumn = visibleColumns[i];
            leftPosition += parseInt(prevColumn.width.replace('px', ''));
          }
        }

        const columnStyle = {
          width: column.width,
          flexShrink: 0,
          ...(column.isSticky && {
            position: 'sticky' as const,
            left: leftPosition,
            zIndex: 10,
            backgroundColor: 'inherit', // Inherit from parent spacer
          }),
        };

        if (column.id === 'title') {
          return (
            <div
              key={`spacer-${column.id}`}
              className="flex items-center pl-1 border-r border-blue-300 dark:border-blue-600"
              style={columnStyle}
            >
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                Drop here
              </span>
            </div>
          );
        }

        return (
          <div
            key={`spacer-${column.id}`}
            className={`border-r border-blue-300 dark:border-blue-600 ${column.id === 'dragHandle' ? 'pl-1' : ''}`}
            style={columnStyle}
          />
        );
      })}
    </div>
  );
};

// Empty Group Message Component
const EmptyGroupMessage: React.FC<{ visibleColumns: any[]; isDarkMode?: boolean }> = ({
  visibleColumns,
  isDarkMode = false,
}) => {
  return (
    <div
      className="flex items-center min-w-max px-1 border-b border-gray-200 dark:border-gray-700"
      style={{ height: '40px' }}
    >
      {visibleColumns.map((column, index) => {
        // Calculate left position for sticky columns
        let leftPosition = 0; // Start at 0 to cover the row's left padding
        if (column.isSticky) {
          for (let i = 0; i < index; i++) {
            const prevColumn = visibleColumns[i];
            leftPosition += parseInt(prevColumn.width.replace('px', ''));
          }
        }

        const emptyColumnStyle = {
          width: column.width,
          flexShrink: 0,
          ...(column.isSticky && {
            position: 'sticky' as const,
            left: leftPosition,
            zIndex: 10,
            backgroundColor: 'inherit', // Inherit from parent container
          }),
        };

        // Show text in the title column
        if (column.id === 'title') {
          return (
            <div
              key={`empty-${column.id}`}
              className="flex items-center pl-1 border-r border-gray-200 dark:border-gray-700"
              style={emptyColumnStyle}
            >
              <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                No tasks in this group
              </span>
            </div>
          );
        }

        return (
          <div
            key={`empty-${column.id}`}
            className={`border-r border-gray-200 dark:border-gray-700 ${column.id === 'dragHandle' ? 'pl-1' : ''}`}
            style={emptyColumnStyle}
          />
        );
      })}
    </div>
  );
};

const ExampleTaskRows: React.FC<{
  visibleColumns: any[];
  isDarkMode?: boolean;
  groupId: string;
  groupType: string;
  groupValue: string;
  groupName: string;
  groupColor: string;
  projectId: string;
  onTaskCreated: (task: any, options?: { openDrawer: boolean; insertAfterTaskId?: string | null }) => void;
}> = ({ visibleColumns, isDarkMode = false, groupId, groupType, groupValue, groupName, groupColor, projectId, onTaskCreated }) => {
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const priorities = useAppSelector((state: any) => state.priorityReducer?.priorities || []);
  const mediumPriority = priorities.find((p: any) => p.value === '1' || p.value === 1) || priorities[0];

  const [showPlaceholders, setShowPlaceholders] = React.useState(false);
  const [activeRowIndex, setActiveRowIndex] = React.useState<number | null>(null);
  const [taskName, setTaskName] = React.useState('');
  const inputRef = React.useRef<any>(null);

  const exampleTaskNames = [
    t('exampleTasks.task1', { defaultValue: 'Define project scope and objectives' }),
    t('exampleTasks.task2', { defaultValue: 'Review and align with stakeholders' }),
    t('exampleTasks.task3', { defaultValue: 'Schedule kickoff meeting' }),
  ];
  const egPrefix = t('exampleTasks.prefix', { defaultValue: 'e.g.' });

  React.useEffect(() => {
    const timer = setTimeout(() => setShowPlaceholders(true), 350);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (activeRowIndex !== null) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [activeRowIndex]);

  const handleCreateTask = React.useCallback(
    (openDrawer: boolean = false) => {
      if (!currentSession || !taskName.trim() || !socket || !connected) return;

      const body: any = {
        name: taskName.trim(),
        project_id: projectId,
        reporter_id: currentSession.id,
        team_id: currentSession.team_id,
      };

      switch (groupType) {
        case 'status': body.status_id = groupValue; break;
        case 'priority': body.priority_id = groupValue; break;
        case 'phase': body.phase_id = groupValue; break;
        default: body[groupType] = groupValue; break;
      }

      socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
      socket.once(SocketEvents.QUICK_TASK.toString(), (task: any) => {
        if (task?.id) {
          onTaskCreated(task, { openDrawer, insertAfterTaskId: null });
        }
      });

      setTaskName('');
      setActiveRowIndex(null);
    },
    [taskName, projectId, groupType, groupValue, socket, connected, currentSession, onTaskCreated]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleCreateTask(false); }
      else if (e.key === 'Escape') { e.preventDefault(); setTaskName(''); setActiveRowIndex(null); }
    },
    [handleCreateTask]
  );

  const handleBlur = React.useCallback(() => {
    if (taskName.trim()) handleCreateTask(false);
    else setActiveRowIndex(null);
  }, [taskName, handleCreateTask]);

  return (
    <>
      {exampleTaskNames.map((name, rowIndex) => {
        // Build a minimal mock task so real column components render correctly.
        // pointer-events:none on the wrapper prevents any socket/API calls.
        const mockTask: any = {
          id: `_example_${rowIndex}`,
          name,
          title: name,
          // Status — pass display fields so StatusColumn renders the badge
          status_id:  groupType === 'status' ? groupValue : undefined,
          status:     groupType === 'status' ? groupName  : undefined,
          color_code: groupType === 'status' ? groupColor : undefined,
          // Priority — use group data when grouped by priority, otherwise default to Medium
          priority_id:         groupType === 'priority' ? groupValue            : mediumPriority?.id,
          priority:            groupType === 'priority' ? groupName             : mediumPriority?.name,
          priority_color:      groupType === 'priority' ? groupColor            : mediumPriority?.color_code,
          priority_color_dark: groupType === 'priority' ? groupColor            : (mediumPriority?.color_code_dark || mediumPriority?.color_code),
          priority_value:      groupType === 'priority' ? undefined             : mediumPriority?.value,
          // Phase
          phase_id: groupType === 'phase' ? groupValue : undefined,
          names: [],
          labels: [],
          sub_tasks: [],
          sub_tasks_count: 0,
          show_sub_tasks: false,
          task_key: '',
          description: '',
          done: false,
          archived: false,
          created_at: '',
          updated_at: '',
        };

        return (
          <div
            key={rowIndex}
            className="flex items-center min-w-max px-1 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/30"
            style={{ height: '40px', cursor: 'text' }}
            onClick={() => { if (activeRowIndex === null) setActiveRowIndex(rowIndex); }}
          >
            {visibleColumns.map((column, colIndex) => {
              let leftPosition = 0;
              if (column.isSticky) {
                for (let i = 0; i < colIndex; i++) {
                  leftPosition += parseInt(visibleColumns[i].width.replace('px', ''));
                }
              }
              const colStyle: React.CSSProperties = {
                width: column.width,
                flexShrink: 0,
                ...(column.isSticky && {
                  position: 'sticky',
                  left: leftPosition,
                  zIndex: 10,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
                }),
              };

              // Title: "e.g." hint text or active inline input
              if (column.id === 'title') {
                return (
                  <div
                    key={column.id}
                    className="flex items-center pl-8 border-r border-gray-200 dark:border-gray-700 h-full"
                    style={colStyle}
                  >
                    {activeRowIndex === rowIndex ? (
                      <Input
                        ref={inputRef}
                        value={taskName}
                        onChange={e => setTaskName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        placeholder={t('addTaskInputPlaceholder', { defaultValue: 'Type task name and press Enter to save' })}
                        className="w-full border-none shadow-none bg-transparent"
                        style={{ height: '100%', padding: '4px 8px', fontSize: '14px' }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="text-sm text-gray-400 dark:text-gray-500 truncate"
                        style={{ opacity: showPlaceholders ? 1 : 0, transition: 'opacity 0.25s ease-in' }}
                      >
                        {egPrefix} {name}
                      </span>
                    )}
                  </div>
                );
              }

              // All other columns: render the real component, block interactions
              const renderContent = () => {
                switch (column.id) {
                  case 'dragHandle':
                    return <DragHandleColumn width={column.width} isSubtask={false} attributes={{}} listeners={{}} />;
                  case 'checkbox':
                    return <CheckboxColumn width={column.width} isSelected={false} onCheckboxChange={() => {}} />;
                  case 'taskKey':
                    return <TaskKeyColumn width={column.width} taskKey="" />;
                  case 'description':
                    return <DescriptionColumn width={column.width} description="" taskId={mockTask.id} />;
                  case 'status':
                    return <StatusColumn width={column.width} task={mockTask} projectId={projectId} isDarkMode={isDarkMode} />;
                  case 'assignees':
                    return <AssigneesColumn width={column.width} task={mockTask} convertedTask={mockTask} isDarkMode={isDarkMode} canCreateTask={true} />;
                  case 'priority':
                    return <PriorityColumn width={column.width} task={mockTask} projectId={projectId} isDarkMode={isDarkMode} />;
                  case 'dueDate':
                    return <DatePickerColumn width={column.width} task={mockTask} field="dueDate" formattedDate={null} dateValue={undefined} isDarkMode={isDarkMode} activeDatePicker={null} onActiveDatePickerChange={() => {}} />;
                  case 'startDate':
                    return <DatePickerColumn width={column.width} task={mockTask} field="startDate" formattedDate={null} dateValue={undefined} isDarkMode={isDarkMode} activeDatePicker={null} onActiveDatePickerChange={() => {}} />;
                  case 'progress':
                    return <ProgressColumn width={column.width} task={mockTask} />;
                  case 'labels':
                    return <LabelsColumnWithOverflow width={column.width} task={mockTask} labelsAdapter={[]} isDarkMode={isDarkMode} columnId={column.id} />;
                  case 'phase':
                    return <PhaseColumn width={column.width} task={mockTask} projectId={projectId} isDarkMode={isDarkMode} />;
                  case 'timeTracking':
                    return <TimeTrackingColumn width={column.width} taskId={mockTask.id} isDarkMode={isDarkMode} />;
                  case 'estimation':
                    return <EstimationColumn width={column.width} task={mockTask} />;
                  case 'completedDate':
                    return <DateColumn width={column.width} formattedDate="" />;
                  case 'createdDate':
                    return <DateColumn width={column.width} formattedDate="" />;
                  case 'lastUpdated':
                    return <DateColumn width={column.width} formattedDate="" />;
                  case 'reporter':
                    return <ReporterColumn width={column.width} reporter="" />;
                  default:
                    return <div className="border-r border-gray-200 dark:border-gray-700" style={{ width: column.width }} />;
                }
              };

              return (
                <div
                  key={column.id}
                  style={{
                    ...colStyle,
                    pointerEvents: 'none',
                    opacity: showPlaceholders ? 1 : 0,
                    transition: 'opacity 0.25s ease-in',
                  }}
                >
                  {renderContent()}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
};

const InsertTaskDivider: React.FC<{
  onInsert: () => void;
  title: string;
}> = ({ onInsert, title }) => {
  return (
    <div className="group absolute inset-x-0 top-0 h-2 -translate-y-1/2 z-20">
      <div className="relative h-full w-full">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-blue-400 dark:border-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <button
          data-insert-btn
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={e => {
            e.stopPropagation();
            onInsert();
          }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900 text-[10px] text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center shadow-sm"
          style={{ left: 32 }}
          title={title}
          aria-label={title}
        >
          <PlusOutlined />
        </button>
      </div>
    </div>
  );
};

const SortableHeader: React.FC<{
  column: any;
  isDropTarget: boolean;
  children: (params: {
    attributes: any;
    listeners: any;
    setActivatorNodeRef: (element: HTMLElement | null) => void;
    isDragging: boolean;
  }) => React.ReactNode;
}> = React.memo(({ column, isDropTarget, children }) => {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: column.id,
    // Disable the automatic scaling that dnd-kit applies during drag
    animateLayoutChanges: () => false,
  });

  // Get the actual pixel width from the column object, not CSS variable
  const explicitWidth = column.width; // This is already a string like "120px"

  // Remove scale from transform to prevent width changes during drag
  const transformWithoutScale = transform ? {
    ...transform,
    scaleX: 1,
    scaleY: 1,
  } : null;

  const style = {
    transform: transformWithoutScale ? CSS.Transform.toString(transformWithoutScale) : undefined,
    transition,
    zIndex: isDragging ? 25 : undefined,
    willChange: isDragging ? 'transform' : undefined,
    // Use explicit pixel width, not CSS variable, to prevent width changes during drag
    width: explicitWidth,
    minWidth: explicitWidth,
    maxWidth: explicitWidth,
    flexShrink: 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-column-id={column.id}
      className={isDropTarget ? 'column-drop-target' : undefined}
    >
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
});

// Hooks and utilities
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import { useSocket } from '@/socket/socketContext';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useBulkActions } from './hooks/useBulkActions';

// Constants and types
import { BASE_COLUMNS, ColumnStyle } from './constants/columns';
import { validateColumnWidths, validateColumnWidth } from '@/utils/column-width-validation';
import { Task } from '@/types/task-management.types';
import { SocketEvents } from '@/shared/socket-events';
import { evt_project_task_list_visit } from '@/shared/worklenz-analytics-events';
import DuplicateTaskModal from './components/DuplicateTaskModal';

const TaskListV2Section: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projectId: urlProjectId } = useParams();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';
  const { token: themeToken } = theme.useToken();

  // Task creation/assignment restriction (Business Plan feature)
  const { canCreateTask } = useTaskCreationPermission();

  // Redux state selectors
  const allTasks = useAppSelector(selectAllTasksArray);
  const groups = useAppSelector(selectGroups);
  const grouping = useAppSelector(selectGrouping);
  const loading = useAppSelector(selectLoading);
  const error = useAppSelector(selectError);
  const loadedProjectId = useAppSelector(selectLoadedProjectId);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const selectedTaskIds = useAppSelector(selectSelectedTaskIds);
  const lastSelectedTaskId = useAppSelector(selectLastSelectedTaskId);
  const collapsedGroups = useAppSelector(selectCollapsedGroups);
  const isOpenDuplicateTaskModal = useAppSelector(
    state => state.taskManagement.isOpenDuplicateTaskModal
  );
  const { selectedTaskId, showTaskDrawer } = useAppSelector(state => state.taskDrawerReducer);

  const fields = useAppSelector(state => state.taskManagementFields?.fields) || [];
  const columns = useAppSelector(selectColumns);
  const customColumns = useAppSelector(selectCustomColumns);
  const loadingColumns = useAppSelector(selectLoadingColumns);

  // Refs for scroll synchronization
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const outerScrollRef = useRef<HTMLDivElement>(null);  // handles horizontal scroll
  const contentScrollRef = useRef<HTMLDivElement>(null); // handles vertical scroll (customScrollParent for virtuoso)
  // State for GroupedVirtuoso customScrollParent (updated after mount via useEffect)
  const [scrollContainer, setScrollContainer] = useState<Element | null>(null);

  // Ref to store cleanup function for column resize drag operation
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  // State hooks
  const [initializedFromDatabase, setInitializedFromDatabase] = useState(false);
  const columnReorderStorageKey = urlProjectId
    ? `worklenz.taskList.columnOrder.${urlProjectId}`
    : null;
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (!columnReorderStorageKey) return [];
    try {
      const stored = localStorage.getItem(columnReorderStorageKey);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch (error) {
      console.error('Failed to load column order from localStorage:', error);
      return [];
    }
  });
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [activeAddRowsByGroup, setActiveAddRowsByGroup] = useState<Record<string, boolean>>({});
  const [insertAnchor, setInsertAnchor] = useState<{
    groupId: string;
    afterTaskId: string | null;
  } | null>(null);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const columnSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Custom hooks
  const { activeId, overId, dropPosition, handleDragStart, handleDragOver, handleDragEnd } =
    useDragAndDrop(allTasks, groups);
  const bulkActions = useBulkActions();

  // Enable real-time updates via socket handlers
  useTaskSocketHandlers();

  // State to store custom column widths (overrides BASE_COLUMNS widths)
  // Load from localStorage on mount
  const [columnWidths, setColumnWidths] = useState<Record<string, string>>(() => {
    if (!urlProjectId) return {};

    try {
      const stored = localStorage.getItem(`worklenz.taskList.columnWidths.${urlProjectId}`);
      if (!stored) return {};

      const parsed = JSON.parse(stored);
      // Validate stored widths against minWidth and maxWidth constraints
      return validateColumnWidths(parsed, BASE_COLUMNS);
    } catch (error) {
      // Handle localStorage errors gracefully
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded. Column widths not loaded.');
      } else {
        console.error('Failed to load column widths from localStorage:', error);
      }
      return {};
    }
  });

  // Save column widths to localStorage whenever they change
  useEffect(() => {
    if (urlProjectId && Object.keys(columnWidths).length > 0) {
      try {
        localStorage.setItem(
          `worklenz.taskList.columnWidths.${urlProjectId}`,
          JSON.stringify(columnWidths)
        );
      } catch (error) {
        // Handle quota exceeded or other localStorage errors gracefully
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded. Column widths not saved.');
        } else {
          console.error('Failed to save column widths to localStorage:', error);
        }
      }
    }
  }, [columnWidths, urlProjectId]);

  // Filter visible columns based on local fields (primary) and backend columns (fallback)
  const rawVisibleColumns = useMemo(() => {
    // Start with base columns
    const baseVisibleColumns = BASE_COLUMNS.filter(column => {
      // Always show essential UI controls (drag handle, checkbox, title)
      // These are required for task list functionality
      if (
        column.isSticky &&
        (column.id === 'dragHandle' || column.id === 'checkbox' || column.id === 'title')
      ) {
        return true;
      }

      // For other columns (including taskKey), respect the visibility settings
      // Primary: Check local fields configuration
      const field = fields.find(f => f.key === column.key);
      if (field) {
        return field.visible;
      }

      // Fallback: Check backend column configuration if local field not found
      const backendColumn = columns.find(c => c.key === column.key);
      if (backendColumn) {
        return backendColumn.pinned ?? false;
      }

      // Default: hide if neither local field nor backend column found
      return false;
    }).map(column => {
      // Apply custom width if it exists, otherwise use default width
      const rawWidth = columnWidths[column.id] || column.width;

      // Validate width using shared utility function
      const width = validateColumnWidth(column.id, rawWidth, column);

      return {
        ...column,
        width,
      };
    });

    // Add visible custom columns
    const visibleCustomColumns =
      customColumns
        ?.filter(column => column.pinned)
        ?.map(column => {
          // Give selection columns more width for dropdown content
          const fieldType = column.custom_column_obj?.fieldType;
          let defaultWidth = 160;
          if (fieldType === 'selection') {
            defaultWidth = 150; // Reduced width for selection dropdowns
          } else if (fieldType === 'people') {
            defaultWidth = 170; // Extra width for people with avatars
          }

          // Map the configuration data structure to the expected format
          const customColumnObj = column.custom_column_obj || (column as any).configuration;

          // Transform configuration format to custom_column_obj format if needed
          let transformedColumnObj = customColumnObj;
          if (customColumnObj && !customColumnObj.fieldType && customColumnObj.field_type) {
            transformedColumnObj = {
              ...customColumnObj,
              fieldType: customColumnObj.field_type,
              numberType: customColumnObj.number_type,
              labelPosition: customColumnObj.label_position,
              previewValue: customColumnObj.preview_value,
              firstNumericColumn: customColumnObj.first_numeric_column_key,
              secondNumericColumn: customColumnObj.second_numeric_column_key,
              selectionsList:
                customColumnObj.selections_list || customColumnObj.selectionsList || [],
              labelsList: customColumnObj.labels_list || customColumnObj.labelsList || [],
            };
          }

          const columnId = column.key || column.id || 'unknown';
          return {
            id: columnId,
            label: column.name || t('customColumns.customColumnHeader'),
            width: columnWidths[columnId] || `${(column as any).width || defaultWidth}px`,
            key: column.key || column.id || 'unknown',
            custom_column: true,
            custom_column_obj: transformedColumnObj,
            isCustom: true,
            name: column.name,
            uuid: column.id,
          };
        }) || [];

    return [...baseVisibleColumns, ...visibleCustomColumns];
  }, [fields, columns, customColumns, t, columnWidths]);

  // Ensure column order includes only visible non-sticky columns and append any newly shown ones
  useEffect(() => {
    const reorderableIds = rawVisibleColumns.filter(column => !column.isSticky).map(c => c.id);
    setColumnOrder(prev => {
      const filtered = prev.filter(id => reorderableIds.includes(id));
      const missing = reorderableIds.filter(id => !filtered.includes(id));
      const next = [...filtered, ...missing];
      const hasChanged =
        next.length !== prev.length || next.some((id, index) => id !== prev[index]);
      return hasChanged ? next : prev;
    });
  }, [rawVisibleColumns]);

  // Reload column order when project changes
  useEffect(() => {
    if (!columnReorderStorageKey) return;
    try {
      const stored = localStorage.getItem(columnReorderStorageKey);
      setColumnOrder(stored ? (JSON.parse(stored) as string[]) : []);
    } catch (error) {
      console.error('Failed to reload column order from localStorage:', error);
      setColumnOrder([]);
    }
  }, [columnReorderStorageKey]);

  // Persist column order
  useEffect(() => {
    if (columnReorderStorageKey && columnOrder.length) {
      try {
        localStorage.setItem(columnReorderStorageKey, JSON.stringify(columnOrder));
      } catch (error) {
        console.error('Failed to save column order to localStorage:', error);
      }
    }
  }, [columnOrder, columnReorderStorageKey]);

  // Apply column order while keeping sticky columns at the front
  const visibleColumns = useMemo(() => {
    const stickyColumns = rawVisibleColumns.filter(column => column.isSticky);
    const reorderableColumns = rawVisibleColumns.filter(column => !column.isSticky);

    const orderedIds = columnOrder.length
      ? columnOrder
      : reorderableColumns.map(column => column.id);

    const orderedReorderable = orderedIds
      .map(id => reorderableColumns.find(column => column.id === id))
      .filter(Boolean) as typeof reorderableColumns;

    const missingColumns = reorderableColumns.filter(column => !orderedIds.includes(column.id));

    return [...stickyColumns, ...orderedReorderable, ...missingColumns];
  }, [rawVisibleColumns, columnOrder]);

  // Create CSS style object with column width variables for instant resizing
  // Apply to document root so CSS variables are globally accessible
  const containerStyle = useMemo(() => {
    const style: any = {};
    visibleColumns.forEach(col => {
      style[`--col-width-${col.id}`] = col.width;
      // Also set on document root for global access
      document.documentElement.style.setProperty(`--col-width-${col.id}`, col.width);
    });
    
    return style;
  }, [visibleColumns]);

  // Set project context for field visibility when project changes
  useEffect(() => {
    if (urlProjectId) {
      dispatch(setProjectContext(urlProjectId));
    }
  }, [dispatch, urlProjectId]);

  // Effects
  const shouldFetchInitialData = useMemo(() => {
    if (!urlProjectId) return false;
    return loadedProjectId !== urlProjectId || columns.length === 0;
  }, [urlProjectId, loadedProjectId, columns.length]);

  const shouldShowInitialSkeleton = useMemo(() => {
    // Prevent a brief empty-state flash before initial fetch dispatch flips loading=true
    return !!urlProjectId && shouldFetchInitialData && groups.length === 0;
  }, [urlProjectId, shouldFetchInitialData, groups.length]);

  // Show example rows only when the project has zero tasks across all groups.
  // Once any task exists anywhere, all example rows disappear.
  const hasNoTasks = useMemo(() => allTasks.length === 0, [allTasks]);

  useEffect(() => {
    if (!urlProjectId || !shouldFetchInitialData) {
      return;
    }

    dispatch(fetchTasksV3(urlProjectId));
    dispatch(fetchTaskListColumns(urlProjectId));
    dispatch(fetchPhasesByProjectId(urlProjectId));
    dispatch(fetchStatusesCategories());
  }, [dispatch, urlProjectId, shouldFetchInitialData]);

  // Re-fetch when grouping changes AFTER the initial load.
  // This handles the case where initGroupingFromServer fires after the parallel
  // fetchTasksV3 already completed with a stale grouping value.
  const prevGroupingRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // Skip on first render (undefined → initial value) to avoid double-fetching
    // on mount alongside the shouldFetchInitialData effect above.
    if (prevGroupingRef.current === undefined) {
      prevGroupingRef.current = currentGrouping;
      return;
    }

    // Only re-fetch if grouping actually changed and data for this project is loaded
    if (
      urlProjectId &&
      loadedProjectId === urlProjectId &&
      currentGrouping !== prevGroupingRef.current
    ) {
      prevGroupingRef.current = currentGrouping;
      dispatch(fetchTasksV3(urlProjectId));
    } else {
      prevGroupingRef.current = currentGrouping;
    }
  }, [currentGrouping, dispatch, urlProjectId, loadedProjectId]);

  useEffect(() => {
    if (urlProjectId) {
      trackMixpanelEvent(evt_project_task_list_visit, { project_id: urlProjectId });
    }
  }, [trackMixpanelEvent, urlProjectId]);

  // Initialize field visibility from database when columns are loaded (only once)
  useEffect(() => {
    if (columns.length > 0 && fields.length > 0 && !initializedFromDatabase) {
      // Update local fields to match database state only on initial load
      import('@/features/task-management/taskListFields.slice').then(({ setFields }) => {
        // Create updated fields based on database column state
        const updatedFields = fields.map(field => {
          const backendColumn = columns.find(c => c.key === field.key);
          if (backendColumn) {
            return {
              ...field,
              visible: backendColumn.pinned ?? field.visible,
            };
          }
          return field;
        });

        // Only update if there are actual changes
        const hasChanges = updatedFields.some(
          (field, index) => field.visible !== fields[index].visible
        );

        if (hasChanges) {
          dispatch(setFields(updatedFields));
        }

        setInitializedFromDatabase(true);
      });
    }
  }, [columns, fields, dispatch, initializedFromDatabase]);

  // Capture scroll container for GroupedVirtuoso.
  // outerScrollRef is the single scroll container (both X and Y).
  // Must depend on loading/loadingColumns: the div only mounts after loading finishes.
  useEffect(() => {
    if (outerScrollRef.current) {
      setScrollContainer(outerScrollRef.current);
    }
  }, [loading, loadingColumns]);

  // Apply .virtuoso-group-header-wrapper class to the sticky wrappers that
  // GroupedVirtuoso creates around each groupContent render.
  // This lets the CSS rule set top:40px so headers stick below the column header row.
  useEffect(() => {
    const container = outerScrollRef.current;
    if (!container) return;

    const tagStickyWrappers = () => {
      container.querySelectorAll<HTMLElement>('*').forEach(el => {
        if (window.getComputedStyle(el).position !== 'sticky') return;
        const child = el.firstElementChild as HTMLElement | null;
        if (child && (child.classList.contains('mt-2') || child.querySelector('[data-group-header]'))) {
          el.classList.add('virtuoso-group-header-wrapper');
          // Use Ant Design's colorBgContainer token — matches the actual page background
          // in both light (#ffffff) and dark (#141414) modes.
          el.style.backgroundColor = themeToken.colorBgContainer;
        }
      });
    };

    const timeoutId = setTimeout(tagStickyWrappers, 100);
    const observer = new MutationObserver(tagStickyWrappers);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [loading, loadingColumns, themeToken.colorBgContainer]);

  // Cleanup column resize listeners on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // If component unmounts during a drag operation, clean up listeners and DOM elements
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
      }
    };
  }, []);

  // Event handlers
  const handleTaskSelect = useCallback(
    (taskId: string, event: React.MouseEvent) => {
      if (event.ctrlKey || event.metaKey) {
        dispatch(toggleTaskSelection(taskId));
      } else if (event.shiftKey && lastSelectedTaskId) {
        const taskIds = allTasks.map(t => t.id);
        const startIdx = taskIds.indexOf(lastSelectedTaskId);
        const endIdx = taskIds.indexOf(taskId);
        const rangeIds = taskIds.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
        dispatch(selectRange(rangeIds));
      } else {
        dispatch(clearSelection());
        dispatch(selectTask(taskId));
      }
    },
    [dispatch, lastSelectedTaskId, allTasks]
  );

  const handleGroupCollapse = useCallback(
    (groupId: string) => {
      dispatch(toggleGroupCollapsed(groupId));
    },
    [dispatch]
  );

  const navigationTaskIds = useMemo(() => {
    return groups.flatMap(group => group.taskIds);
  }, [groups]);

  const openDrawerForTask = useCallback(
    (taskId: string) => {
      if (!urlProjectId || !taskId) return;
      if (showTaskDrawer && selectedTaskId === taskId) return;

      const currentIndex = navigationTaskIds.indexOf(taskId);

      dispatch(
        setNavigationContext({
          taskIds: navigationTaskIds,
          currentIndex: currentIndex >= 0 ? currentIndex : 0,
          sourceView: 'task-list',
          projectId: urlProjectId,
        })
      );
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTaskDrawer({ taskId, projectId: urlProjectId }));
    },
    [dispatch, navigationTaskIds, selectedTaskId, showTaskDrawer, urlProjectId]
  );

  const handleActivateAddRow = useCallback((groupId: string) => {
    setActiveAddRowsByGroup(prev => ({ ...prev, [groupId]: true }));
  }, []);

  const handleDeactivateAddRow = useCallback(
    (groupId: string) => {
      setActiveAddRowsByGroup(prev => ({ ...prev, [groupId]: false }));
      setInsertAnchor(current => (current?.groupId === groupId ? null : current));
    },
    [setInsertAnchor]
  );

  const emitSortOrderUpdate = useCallback(
    (groupId: string, orderedGroupTaskIds: string[], createdTask: Task) => {
      if (!socket || !connected || !urlProjectId) return;

      const updatedGroups = groups.map(group => ({
        ...group,
        taskIds: group.id === groupId ? orderedGroupTaskIds : [...group.taskIds],
      }));

      const taskUpdates: Array<{ task_id: string; sort_order: number }> = [];
      let currentSortOrder = 0;

      updatedGroups.forEach(group => {
        group.taskIds.forEach(taskId => {
          taskUpdates.push({ task_id: taskId, sort_order: currentSortOrder });
          currentSortOrder += 1;
        });
      });

      socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), {
        project_id: urlProjectId,
        group_by: currentGrouping || 'status',
        task_updates: taskUpdates,
        from_group: groupId,
        to_group: groupId,
        task: {
          id: createdTask.id,
          project_id: urlProjectId,
          status: createdTask.status || '',
          priority: createdTask.priority || '',
        },
        team_id: currentSession?.team_id || '',
      });
    },
    [connected, socket, urlProjectId, groups, currentGrouping, currentSession?.team_id]
  );

  const handleTaskCreated = useCallback(
    (task: Task, groupId: string, openDrawer: boolean, insertedAfterTaskId?: string | null) => {
      if (!task?.id) return;

      setActiveAddRowsByGroup(prev => ({ ...prev, [groupId]: true }));

      if (insertedAfterTaskId) {
        setInsertAnchor({ groupId, afterTaskId: task.id });
        const targetGroup = groups.find(group => group.id === groupId);
        if (!targetGroup) return;

        const taskIds = targetGroup.taskIds.includes(task.id)
          ? [...targetGroup.taskIds]
          : [...targetGroup.taskIds, task.id];

        const filteredIds = taskIds.filter(id => id !== task.id);
        const anchorIndex = filteredIds.indexOf(insertedAfterTaskId);
        const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : filteredIds.length;
        filteredIds.splice(insertIndex, 0, task.id);

        // Keep realtime UI consistent immediately (before backend/socket round-trip finishes).
        dispatch(reorderTasks({ groupId, taskIds: filteredIds }));
        emitSortOrderUpdate(groupId, filteredIds, task);

        // Insert-mode is one-shot: close the inline input to avoid visible re-anchoring jumps.
        setActiveAddRowsByGroup(prev => ({ ...prev, [groupId]: false }));
        setInsertAnchor(current => (current?.groupId === groupId ? null : current));
      } else {
        setInsertAnchor(current => (current?.groupId === groupId ? null : current));
      }

      if (showTaskDrawer || openDrawer) {
        openDrawerForTask(task.id);
      }
    },
    [dispatch, emitSortOrderUpdate, groups, openDrawerForTask, showTaskDrawer]
  );

  // Function to update custom column values
  const updateTaskCustomColumnValue = useCallback(
    (taskId: string, columnKey: string, value: string | number | boolean | string[] | null) => {
      try {
        if (!urlProjectId) {
          console.error('Project ID is missing');
          return;
        }

        const body = {
          task_id: taskId,
          column_key: columnKey,
          value: value,
          project_id: urlProjectId,
        };

        // Update the Redux store immediately for optimistic updates
        const currentTask = allTasks.find(task => task.id === taskId);
        if (currentTask) {
          const updatedTask = {
            ...currentTask,
            custom_column_values: {
              ...currentTask.custom_column_values,
              [columnKey]: value,
            },
            updated_at: new Date().toISOString(),
          };

          // Import and dispatch the updateTask action
          import('@/features/task-management/task-management.slice').then(({ updateTask }) => {
            dispatch(updateTask(updatedTask));
          });
        }

        if (socket && connected) {
          socket.emit(SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(), JSON.stringify(body));
        } else {
          console.warn('Socket not connected, unable to emit TASK_CUSTOM_COLUMN_UPDATE event');
        }
      } catch (error) {
        console.error('Error updating custom column value:', error);
      }
    },
    [urlProjectId, socket, connected, allTasks, dispatch]
  );

  // Custom column settings handler
  const handleCustomColumnSettings = useCallback(
    (columnKey: string) => {
      if (!columnKey) return;

      const columnData = visibleColumns.find(col => col.key === columnKey || col.id === columnKey);

      // Use the UUID for API calls, not the key (nanoid)
      // For custom columns, prioritize the uuid field over id field
      const columnId = (columnData as any)?.uuid || columnData?.id || columnKey;

      dispatch(
        setCustomColumnModalAttributes({
          modalType: 'edit',
          columnId: columnId,
          columnData: columnData,
        })
      );
      dispatch(toggleCustomColumnModalOpen(true));
    },
    [dispatch, visibleColumns]
  );

  // Handle scroll synchronization - disabled since header is now sticky inside content
  const handleContentScroll = useCallback(() => {
    // No longer needed since header scrolls naturally with content
  }, []);

  // Column drag-and-drop handlers
  const handleColumnDragStart = useCallback((event: any) => {
    const columnId = event?.active?.id || null;
    setActiveColumnId(columnId);
  }, []);

  const handleColumnDragOver = useCallback((event: any) => {
    // Throttle state updates during drag to reduce re-renders
    const newOverId = event?.over?.id || null;
    setOverColumnId(prev => prev === newOverId ? prev : newOverId);
  }, []);

  const handleColumnDragEnd = useCallback(
    (event: any) => {
      setActiveColumnId(null);
      setOverColumnId(null);

      const { active, over } = event || {};
      if (!active || !over || active.id === over.id) return;

      const reorderableIds = visibleColumns.filter(column => !column.isSticky).map(c => c.id);
      const oldIndex = reorderableIds.indexOf(active.id as string);
      const newIndex = reorderableIds.indexOf(over.id as string);

      if (oldIndex === -1 || newIndex === -1) return;

      const nextOrder = arrayMove(reorderableIds, oldIndex, newIndex);
      setColumnOrder(nextOrder);
    },
    [visibleColumns]
  );

  // Memoized values for GroupedVirtuoso
  const virtuosoGroups = useMemo(() => {
    let currentTaskIndex = 0;

    return groups.map(group => {
      const isCurrentGroupCollapsed = collapsedGroups.has(group.id);

      const visibleTasksInGroup = isCurrentGroupCollapsed
        ? []
        : group.taskIds
            .map(taskId => allTasks.find(task => task.id === taskId))
            .filter((task): task is Task => task !== undefined);

      const tasksForVirtuoso = visibleTasksInGroup.map(task => ({
        ...task,
        originalIndex: allTasks.indexOf(task),
      }));

      const addTaskItem = {
        id: `add-task-${group.id}-0`,
        isAddTaskRow: true,
        groupId: group.id,
        groupType: currentGrouping || 'status',
        groupValue: group.id, // Send the UUID that backend expects
        projectId: urlProjectId,
        rowId: `add-task-${group.id}-0`,
        autoFocus: false,
        isInsertMode: insertAnchor?.groupId === group.id && !!insertAnchor?.afterTaskId,
        insertAfterTaskId:
          insertAnchor?.groupId === group.id ? (insertAnchor.afterTaskId ?? null) : null,
      };

      let itemsWithAddTask = tasksForVirtuoso;
      if (!isCurrentGroupCollapsed) {
        if (insertAnchor?.groupId === group.id && insertAnchor.afterTaskId) {
          const anchorIndex = tasksForVirtuoso.findIndex(task => task.id === insertAnchor.afterTaskId);
          if (anchorIndex >= 0) {
            itemsWithAddTask = [...tasksForVirtuoso];
            itemsWithAddTask.splice(anchorIndex + 1, 0, addTaskItem as any);
          } else {
            itemsWithAddTask = [...tasksForVirtuoso, addTaskItem as any];
          }
        } else {
          itemsWithAddTask = [...tasksForVirtuoso, addTaskItem as any];
        }
      }

      const groupData = {
        ...group,
        tasks: itemsWithAddTask,
        startIndex: currentTaskIndex,
        count: itemsWithAddTask.length,
        actualCount: group.taskIds.length,
        groupValue: group.groupValue || group.title,
      };
      currentTaskIndex += itemsWithAddTask.length;
      return groupData;
    });
  }, [groups, allTasks, collapsedGroups, currentGrouping, urlProjectId, insertAnchor]);

  const virtuosoGroupCounts = useMemo(() => {
    return virtuosoGroups.map(group => group.count);
  }, [virtuosoGroups]);

  const virtuosoItems = useMemo(() => {
    return virtuosoGroups.flatMap(group => group.tasks);
  }, [virtuosoGroups]);

  // Render functions
  const renderGroup = useCallback(
    (groupIndex: number) => {
      const group = virtuosoGroups[groupIndex];
      const isGroupCollapsed = collapsedGroups.has(group.id);
      const isGroupEmpty = group.actualCount === 0;

      return (
        <div className={groupIndex > 0 ? 'mt-2' : ''} data-group-header="true">
          <TaskGroupHeader
            group={{
              id: group.id,
              name: group.title,
              count: group.actualCount,
              color: isDarkMode ? group.color_code_dark : group.color,
            }}
            isCollapsed={isGroupCollapsed}
            onToggle={() => handleGroupCollapse(group.id)}
            projectId={urlProjectId || ''}
          />
          {isGroupEmpty && !isGroupCollapsed && hasNoTasks && (
            <ExampleTaskRows
              visibleColumns={visibleColumns}
              isDarkMode={isDarkMode}
              groupId={group.id}
              groupType={currentGrouping || 'status'}
              groupValue={group.id}
              groupName={group.title || group.name || ''}
              groupColor={isDarkMode ? (group.color_code_dark || group.color) : group.color}
              projectId={urlProjectId || ''}
              onTaskCreated={(task, options) =>
                handleTaskCreated(task, group.id, !!options?.openDrawer, null)
              }
            />
          )}
        </div>
      );
    },
    [virtuosoGroups, collapsedGroups, handleGroupCollapse, visibleColumns, t, isDarkMode, currentGrouping, urlProjectId, handleTaskCreated, hasNoTasks]
  );

  const renderTask = useCallback(
    (taskIndex: number, isFirstInGroup: boolean = false) => {
      const item = virtuosoItems[taskIndex];

      if (!item || !urlProjectId) return null;

      if ('isAddTaskRow' in item && item.isAddTaskRow) {
        // Hide the add-task row entirely when task creation is restricted
        if (!canCreateTask) return null;
        return (
          <AddTaskRow
            groupId={item.groupId}
            groupType={item.groupType}
            groupValue={item.groupValue}
            projectId={urlProjectId}
            visibleColumns={visibleColumns}
            rowId={item.rowId}
            autoFocus={item.autoFocus}
            isActive={!!activeAddRowsByGroup[item.groupId]}
            isInsertMode={!!item.isInsertMode}
            insertAfterTaskId={item.insertAfterTaskId || null}
            onActivate={() => handleActivateAddRow(item.groupId)}
            onDeactivate={() => handleDeactivateAddRow(item.groupId)}
            onTaskCreated={(task, options) =>
              handleTaskCreated(
                task,
                item.groupId,
                !!options?.openDrawer,
                options?.insertAfterTaskId || null
              )
            }
          />
        );
      }

      return (
        <TaskRowWithSubtasks
          taskId={item.id}
          projectId={urlProjectId}
          visibleColumns={visibleColumns}
          isFirstInGroup={isFirstInGroup}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
          canCreateTask={canCreateTask}
        />
      );
    },
    [
      virtuosoItems,
      visibleColumns,
      urlProjectId,
      updateTaskCustomColumnValue,
      activeAddRowsByGroup,
      handleActivateAddRow,
      handleDeactivateAddRow,
      handleTaskCreated,
      canCreateTask,
    ]
  );

  // Memoize reorderable column IDs to prevent unnecessary recalculations
  const reorderableColumnIds = useMemo(() => {
    return visibleColumns.filter(column => !column.isSticky).map(c => c.id);
  }, [visibleColumns]);

  // Render column headers
  const renderColumnHeaders = useCallback(() => {
    return (
      <DndContext
        sensors={columnSensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragStart={handleColumnDragStart}
        onDragOver={handleColumnDragOver}
        onDragEnd={handleColumnDragEnd}
      >
        <SortableContext
          items={reorderableColumnIds}
          strategy={horizontalListSortingStrategy}
        >
          <div
            className="border-b border-gray-200 dark:border-gray-700 tasklist-v2-column-headers"
            style={{
              width: '100%',
              minWidth: 'max-content',
              backgroundColor: isDarkMode ? '#141414' : '#f9fafb',
            }}
          >
            <div
              className="flex items-center px-1 py-3 w-full"
              style={{ minWidth: 'max-content', height: '40px' }}
            >
              {visibleColumns.map((column, index) => {
                const isDropTarget = overColumnId === column.id && column.id !== activeColumnId;

                // Calculate left position for sticky columns
                let leftPosition = 0; // Start at 0 to cover the row's left padding
                if (column.isSticky) {
                  // For sticky columns, we need to account for ALL previous columns
                  // because non-sticky columns between sticky ones still take up space
                  for (let i = 0; i < index; i++) {
                    const prevColumn = visibleColumns[i];
                    leftPosition += parseInt(prevColumn.width.replace('px', ''));
                  }
                }

                const columnStyle: ColumnStyle = {
                  width: `var(--col-width-${column.id})`,
                  flexShrink: 0,
                  ...((column as any).minWidth && { minWidth: (column as any).minWidth }),
                  ...((column as any).maxWidth && { maxWidth: (column as any).maxWidth }),
                  ...(column.isSticky && {
                    position: 'sticky' as const,
                    left: leftPosition,
                    zIndex: 15,
                    backgroundColor: isDarkMode ? '#141414' : '#f9fafb', // custom dark header : bg-gray-50
                    height: '100%', // Fill the header height
                    display: 'flex', // Use flex to contain child
                    alignItems: 'center', // Center content vertically
                  }),
                };

                const headerContent = (dragParams?: {
                  attributes: any;
                  listeners: any;
                  setActivatorNodeRef: (element: HTMLElement | null) => void;
                  isDragging: boolean;
                }) => (
                  <div
                    data-column-id={column.id}
                    className={`text-sm font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 column-header-cell h-full w-full ${
                      column.id === 'dragHandle'
                        ? 'flex items-center justify-center pl-1'
                        : column.id === 'checkbox'
                          ? 'flex items-center justify-center'
                          : column.id === 'taskKey'
                            ? 'flex items-center pl-3'
                            : column.id === 'title'
                              ? 'flex items-center justify-between px-2'
                              : column.id === 'description'
                                ? 'flex items-center pl-2'
                                : column.id === 'labels'
                                  ? 'flex items-center min-w-0 px-2'
                                  : column.id === 'assignees'
                                    ? 'flex items-center px-2'
                                    : 'flex items-center justify-center px-2'
                    } ${isDropTarget ? 'column-drop-target' : ''}`}
                    style={{
                      // For sticky columns, apply the full columnStyle here
                      // For non-sticky columns, the SortableHeader wrapper handles width
                      ...(column.isSticky ? columnStyle : {}),
                      // Add position relative for resize handle positioning, but don't override sticky
                      ...(!column.isSticky && { position: 'relative' }),
                      ...(dragParams?.isDragging ? { opacity: 0.85 } : {}),
                    }}
                  >
                    {column.id === 'dragHandle' || column.id === 'checkbox' ? (
                      <span></span>
                    ) : column.isCustom ? (
                      <CustomColumnHeader
                        column={column}
                        onSettingsClick={handleCustomColumnSettings}
                        dragListeners={!column.isSticky ? dragParams?.listeners : undefined}
                        dragAttributes={!column.isSticky ? dragParams?.attributes : undefined}
                        setDragActivatorRef={!column.isSticky ? dragParams?.setActivatorNodeRef : undefined}
                      />
                    ) : (
                      <span
                        ref={dragParams?.setActivatorNodeRef}
                        {...dragParams?.attributes}
                        {...dragParams?.listeners}
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          paddingRight: '20px',
                          flex: 1,
                          cursor: !column.isSticky ? 'grab' : 'default',
                        }}
                      >
                        {t(column.label || '')}
                      </span>
                    )}

                    {/* Column Resize Handle */}
                    {column.id !== 'dragHandle' && column.id !== 'checkbox' && (
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${t(column.label || '')} column`}
                        tabIndex={0}
                        className="column-resize-handle"
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: -4,
                          width: 8,
                          height: '100%',
                        }}
                        onKeyDown={e => {
                          // Only handle ArrowLeft and ArrowRight keys
                          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                            return;
                          }

                          e.preventDefault();
                          e.stopPropagation();

                          const columnId = column.id;

                          // Get current width from state or column default
                          const currentWidthString = columnWidths[columnId] || column.width;
                          const currentWidth = parseInt(currentWidthString.replace('px', ''), 10);

                          // Calculate minimum width based on header text length
                          // Use translated label text to measure actual displayed text
                          let headerText: string;
                          if (column.isCustom) {
                            // Use the same logic as CustomColumnHeader component
                            headerText = column.name || column.custom_column_obj?.fieldTitle || column.key || column.label || '';
                          } else {
                            headerText = t(column.label || '');
                          }
                          // Approximate: 8px per character + padding for icons/spacing
                          // Custom columns need more padding for settings icon + drag handle
                          // Breakdown: text margin (4px) + gap (16px) + settings icon (14px) + 
                          //            drag handle padding (12px) + drag handle icon (14px) + 
                          //            container padding (16px) + buffer (24px) = 100px
                          // Regular columns need padding for drag handle (40px)
                          const paddingForIcons = column.isCustom ? 100 : 40;
                          const calculatedMinWidth = Math.max(100, (headerText.length * 8) + paddingForIcons);
                          
                          // Get min/max widths from column config or use calculated minimum
                          const minWidth = (column as any).minWidth
                            ? parseInt((column as any).minWidth.replace('px', ''), 10)
                            : calculatedMinWidth;
                          const maxWidth = (column as any).maxWidth
                            ? parseInt((column as any).maxWidth.replace('px', ''), 10)
                            : 1200;

                          // Determine increment: Shift for larger increments (10px), normal for smaller (1px)
                          const increment = e.shiftKey ? 10 : 1;

                          // Determine direction: ArrowRight increases width, ArrowLeft decreases
                          const direction = e.key === 'ArrowRight' ? 1 : -1;

                          // Calculate new width
                          const newWidth = Math.max(
                            minWidth,
                            Math.min(maxWidth, currentWidth + direction * increment)
                          );

                          // Update CSS variable for immediate visual feedback
                          document.documentElement.style.setProperty(
                            `--col-width-${columnId}`,
                            `${newWidth}px`
                          );

                          // Update state to persist the change
                          setColumnWidths(prev => ({
                            ...prev,
                            [columnId]: `${newWidth}px`,
                          }));

                          // Update aria attributes and visual state for accessibility
                          const handleElement = e.currentTarget;
                          const atLimit = newWidth <= minWidth || newWidth >= maxWidth;

                          // Update aria attributes for screen readers
                          handleElement.setAttribute('aria-valuenow', `${newWidth}`);
                          handleElement.setAttribute('aria-valuemin', `${minWidth}`);
                          handleElement.setAttribute('aria-valuemax', `${maxWidth}`);

                          // Update visual state
                          if (atLimit) {
                            handleElement.classList.add('at-limit');
                          } else {
                            handleElement.classList.remove('at-limit');
                          }
                        }}
                        onMouseDown={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          const startX = e.clientX;
                          const startWidth = parseInt(column.width.replace('px', ''), 10);
                          const columnId = column.id;
                          const handleElement = e.currentTarget;

                          // Calculate minimum width based on header text length
                          // Use translated label text to measure actual displayed text
                          let headerText: string;
                          if (column.isCustom) {
                            // Use the same logic as CustomColumnHeader component
                            headerText = column.name || column.custom_column_obj?.fieldTitle || column.key || column.label || '';
                          } else {
                            headerText = t(column.label || '');
                          }
                          // Approximate: 8px per character + padding for icons/spacing
                          // Custom columns need more padding for settings icon + drag handle
                          // Breakdown: text margin (4px) + gap (16px) + settings icon (14px) + 
                          //            drag handle padding (12px) + drag handle icon (14px) + 
                          //            container padding (16px) + buffer (24px) = 100px
                          // Regular columns need padding for drag handle (40px)
                          const paddingForIcons = column.isCustom ? 60 : 50;
                          const calculatedMinWidth = Math.max(60, (headerText.length * 8) + paddingForIcons);
                          
                          // Get min/max widths from column config or use calculated minimum
                          const minWidth = column.minWidth
                            ? parseInt(column.minWidth.replace('px', ''), 10)
                            : calculatedMinWidth;
                          const maxWidth = column.maxWidth
                            ? parseInt(column.maxWidth.replace('px', ''), 10)
                            : 1200;

                          // Find the scrollable table container
                          const scrollableContainer =
                            outerScrollRef.current ||
                            contentScrollRef.current ||
                            (e.currentTarget.closest('[style*="overflow"]') as HTMLElement) ||
                            (document
                              .getElementById('task-list-container')
                              ?.querySelector('[style*="overflow"]') as HTMLElement) ||
                            document.getElementById('task-list-container') ||
                            (e.currentTarget.closest('.border') as HTMLElement) ||
                            document.body;
                          const tableContainer = scrollableContainer;

                          // Create resize indicator line
                          const indicator = document.createElement('div');
                          indicator.className = 'column-resize-indicator';

                          // Ensure the container has position relative for absolute positioning
                          const originalPosition = tableContainer.style.position;
                          if (!originalPosition || originalPosition === 'static') {
                            tableContainer.style.position = 'relative';
                          }

                          // Calculate the full scrollable height to span entire table
                          const scrollHeight = tableContainer.scrollHeight;
                          const scrollTop = tableContainer.scrollTop;

                          // Set indicator to span from current scroll position to end of content
                          // Use fixed positioning from top of visible area to bottom of scrollable content
                          indicator.style.top = '0px';
                          indicator.style.height = `${scrollHeight}px`;

                          tableContainer.appendChild(indicator);

                          // Create tooltip
                          const tooltip = document.createElement('div');
                          tooltip.className = 'column-resize-tooltip';
                          document.body.appendChild(tooltip);

                          // Add resizing class
                          handleElement.classList.add('resizing');
                          document.body.classList.add('column-resizing');

                          const updateIndicator = (x: number, width: number) => {
                            // Calculate position relative to table container's scroll origin.
                            // scrollLeft must be added because the indicator uses position:absolute
                            // inside the scrollable container — without it the line drifts left
                            // by exactly the horizontal scroll offset.
                            const containerRect = tableContainer.getBoundingClientRect();
                            const relativeX = x - containerRect.left + tableContainer.scrollLeft;
                            indicator.style.left = `${relativeX}px`;
                            indicator.style.opacity = '1';
                            tooltip.textContent = `${width}px`;
                            tooltip.style.left = `${x}px`;
                            tooltip.style.top = `${e.clientY - 40}px`;
                            tooltip.style.opacity = '1';

                            // Check if at limit
                            const atLimit = width <= minWidth || width >= maxWidth;
                            if (atLimit) {
                              handleElement.classList.add('at-limit');
                            } else {
                              handleElement.classList.remove('at-limit');
                            }
                          };

                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            const diff = moveEvent.clientX - startX;
                            const newWidth = Math.max(
                              minWidth,
                              Math.min(maxWidth, startWidth + diff)
                            );
                            // Update CSS variable once - all elements update together
                            document.documentElement.style.setProperty(
                              `--col-width-${columnId}`,
                              `${newWidth}px`
                            );
                            // FIX: clamp indicator X to match clamped width so the
                            // blue line stops at the min/max boundary
                            const clampedClientX = startX + (newWidth - startWidth);
                            updateIndicator(clampedClientX, newWidth);
                          };

                          const handleMouseUp = (upEvent: MouseEvent) => {
                            // Calculate final width and update state to persist
                            const diff = upEvent.clientX - startX;
                            const newWidth = Math.max(
                              minWidth,
                              Math.min(maxWidth, startWidth + diff)
                            );
                            setColumnWidths(prev => ({
                              ...prev,
                              [columnId]: `${newWidth}px`,
                            }));

                            // Call cleanup function to remove listeners and DOM elements
                            if (resizeCleanupRef.current) {
                              resizeCleanupRef.current();
                            }
                          };

                          // Create cleanup function to remove listeners and DOM elements
                          // Must be defined after handleMouseMove and handleMouseUp
                          const cleanup = () => {
                            // Remove event listeners
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);

                            // Reset body styles
                            document.body.style.cursor = '';
                            document.body.style.userSelect = '';
                            document.body.classList.remove('column-resizing');

                            // Restore original position style
                            if (originalPosition) {
                              tableContainer.style.position = originalPosition;
                            } else {
                              tableContainer.style.position = '';
                            }

                            // Remove indicator and tooltip
                            if (indicator.parentNode) {
                              indicator.style.opacity = '0';
                              setTimeout(() => {
                                if (indicator.parentNode) {
                                  indicator.remove();
                                }
                              }, 150);
                            }
                            if (tooltip.parentNode) {
                              tooltip.style.opacity = '0';
                              setTimeout(() => {
                                if (tooltip.parentNode) {
                                  tooltip.remove();
                                }
                              }, 150);
                            }

                            // Remove resizing classes
                            handleElement.classList.remove('resizing', 'at-limit');

                            // Clear the cleanup ref
                            resizeCleanupRef.current = null;
                          };

                          // Store cleanup function in ref
                          resizeCleanupRef.current = cleanup;

                          // Initial indicator position
                          updateIndicator(e.clientX, startWidth);

                          document.body.style.cursor = 'col-resize';
                          document.body.style.userSelect = 'none';
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                        onClick={e => e.stopPropagation()}
                        title={`Resize ${t(column.label || '')}`}
                      />
                    )}
                  </div>
                );

                if (column.isSticky) {
                  return headerContent();
                }

                return (
                  <SortableHeader key={column.id} column={column} isDropTarget={isDropTarget}>
                    {({ attributes, listeners, setActivatorNodeRef, isDragging }) =>
                      headerContent({ attributes, listeners, setActivatorNodeRef, isDragging })
                    }
                  </SortableHeader>
                );
              })}
              {/* Add Custom Column Button - positioned at the end and scrolls with content */}
              <div
                className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
                style={{ width: '50px', flexShrink: 0 }}
              >
                <AddCustomColumnButton />
              </div>
            </div>
          </div>
        </SortableContext>
      </DndContext>
    );
  }, [
    visibleColumns,
    t,
    handleCustomColumnSettings,
    isDarkMode,
    overColumnId,
    activeColumnId,
    columnSensors,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragEnd,
    columnWidths,
    reorderableColumnIds,
  ]);

  // Loading and error states
  if (loading || loadingColumns || shouldShowInitialSkeleton) {
    return <TaskListSkeleton visibleColumns={visibleColumns} />;
  }
  if (error)
    return (
      <div>
        {t('emptyStates.errorPrefix')} {error}
      </div>
    );

  // Show message when no data - but for phase grouping, create an unmapped group
  if (groups.length === 0 && !loading) {
    // If grouped by phase, show an unmapped group to allow task creation
    if (currentGrouping === 'phase') {
      const unmappedGroupId = 'Unmapped';

      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col bg-white dark:bg-gray-900 h-full overflow-hidden">
            <div
              className="border border-gray-200 dark:border-gray-700 rounded-lg"
              style={{
                height: 'calc(100vh - 240px)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                ref={outerScrollRef}
                className="flex-1 bg-white dark:bg-gray-900 relative"
                style={{ overflowX: 'auto', overflowY: 'auto', minHeight: 0 }}
              >
                <div
                  ref={contentScrollRef}
                  style={{ minWidth: 'max-content', overflowX: 'visible', overflowY: 'visible' }}
                >
                  {/* Sticky Column Headers */}
                  <div
                    className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-800"
                    style={{ minWidth: 'max-content' }}
                  >
                    {renderColumnHeaders()}
                  </div>

                  <div style={{ minWidth: 'max-content' }}>
                    <div className="mt-2">
                      <TaskGroupHeader
                        group={{
                          id: unmappedGroupId,
                          name: 'Unmapped',
                          count: 0,
                          color: '#fbc84c69',
                        }}
                        isCollapsed={false}
                        onToggle={() => {}}
                        projectId={urlProjectId || ''}
                      />
                      {/* Single add task row - reused for all tasks */}
                      {canCreateTask && (
                        <AddTaskRow
                          groupId={unmappedGroupId}
                          groupType="phase"
                          groupValue="Unmapped"
                          projectId={urlProjectId || ''}
                          visibleColumns={visibleColumns}
                          rowId={`add-task-${unmappedGroupId}-0`}
                          autoFocus={false}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DndContext>
      );
    }

    // For other groupings, show the empty state message
    return (
      <div className="flex flex-col bg-white dark:bg-gray-900 h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('emptyStates.noTaskGroups')}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('emptyStates.noTaskGroupsDescription')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* CSS for sticky column hover effects */}
      <style>
        {`
          .hover\\:bg-gray-50:hover .sticky-column-hover,
          .dark .hover\\:bg-gray-800:hover .sticky-column-hover {
            background-color: var(--hover-bg) !important;
          }

          /* GroupedVirtuoso wraps each groupContent in a position:sticky div with top:0.
             Override top to 40px so the group header sticks below the column header row.
             Background is set via JS using Ant Design's colorBgContainer token. */
          .virtuoso-group-header-wrapper {
            top: 40px !important;
            z-index: 20 !important;
          }

          /* Column drag performance optimization */
          .column-header-cell {
            will-change: auto;
          }
          
          [data-column-id] {
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
          }
          
          /* Labels column horizontal scroll - hide scrollbar but keep functionality */
          .overflow-x-auto,
          .labels-scroll-container,
          .single-line-scroll {
            scrollbar-width: none; /* Firefox - hide scrollbar */
            -ms-overflow-style: none; /* IE and Edge - hide scrollbar */
          }
          
          .overflow-x-auto::-webkit-scrollbar,
          .labels-scroll-container::-webkit-scrollbar,
          .single-line-scroll::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera - hide scrollbar */
          }
        `}
      </style>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <div
          id="task-list-container"
          className="flex flex-col bg-white dark:bg-gray-900 h-full overflow-hidden"
          style={containerStyle}
        >
          {/* Table Container */}
          <div
            className="border border-gray-200 dark:border-gray-700 rounded-lg"
            style={{
              height: 'calc(100vh - 240px)', // Slightly reduce height to ensure scrollbar visibility
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Single scroll container: handles both X and Y.
                outerScrollRef is the customScrollParent for virtuoso AND the X scroll container.
                TaskGroupHeader's sticky left:0 containing block is this element — full scroll width. */}
            <div
              ref={outerScrollRef}
              className="flex-1 bg-white dark:bg-gray-900 relative"
              style={{
                overflowX: 'auto',
                overflowY: 'auto',
                minHeight: 0,
              }}
            >
              {/* Inner wrapper — only sets min-width so content can expand horizontally.
                  overflowX: visible so sticky left:0 walks up to outerScrollRef as containing block. */}
              <div
                ref={contentScrollRef}
                style={{
                  minWidth: 'max-content',
                  overflowX: 'visible',
                  overflowY: 'visible',
                }}
              >
                {/* Sticky Column Headers */}
                <div
                  className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-800"
                  style={{ minWidth: 'max-content' }}
                >
                  {renderColumnHeaders()}
                </div>
                <SortableContext
                  items={virtuosoItems
                    .filter(item => !('isAddTaskRow' in item) && !item.parent_task_id)
                    .map(item => item.id)
                    .filter((id): id is string => id !== undefined)}
                  strategy={verticalListSortingStrategy}
                >
                  <GroupedVirtuoso
                    customScrollParent={scrollContainer || undefined}
                    overscan={800}
                    groupCounts={virtuosoGroupCounts}
                    groupContent={renderGroup}
                    itemContent={(index, groupIndex) => {
                      const item = virtuosoItems[index];
                      if (!item) return <div />;
                      const group = virtuosoGroups[groupIndex];

                      const groupOffset = virtuosoGroupCounts
                        .slice(0, groupIndex)
                        .reduce((sum, c) => sum + c, 0);
                      const indexInGroup = index - groupOffset;
                      const isFirstInGroup = indexInGroup === 0 && !('isAddTaskRow' in item);
                      const previousItem = indexInGroup > 0 ? group?.tasks?.[indexInGroup - 1] : null;
                      const showInsertDivider =
                        indexInGroup > 0 &&
                        !('isAddTaskRow' in item) &&
                        previousItem &&
                        !('isAddTaskRow' in previousItem);

                      const isOverThisTask =
                        activeId && overId === item.id && !('isAddTaskRow' in item);
                      const showBefore = isOverThisTask && dropPosition === 'before';
                      const showAfter = isOverThisTask && dropPosition === 'after';

                      return (
                        <div
                          style={{ minWidth: 'max-content' }}
                          className="relative"
                          onMouseMove={e => {
                            // Find the InsertTaskDivider button inside this row and update
                            // its left position to follow the cursor — direct DOM update,
                            // no React state, no re-render.
                            const btn = (e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(
                              '[data-insert-btn]'
                            );
                            if (!btn) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            // clientX relative to the row's left edge
                            const x = e.clientX - rect.left;
                            btn.style.left = `${x}px`;
                          }}
                        >
                          {showBefore && !activeId && (
                            <DropSpacer
                              isVisible={true}
                              visibleColumns={visibleColumns}
                              isDarkMode={isDarkMode}
                            />
                          )}
                          {showInsertDivider && previousItem && canCreateTask && (
                            <InsertTaskDivider
                              title={t('insertTaskText', { defaultValue: 'Insert Task' })}
                              onInsert={() => {
                                setInsertAnchor({
                                  groupId: group.id,
                                  afterTaskId: previousItem.id,
                                });
                                setActiveAddRowsByGroup(prev => ({ ...prev, [group.id]: true }));
                              }}
                            />
                          )}
                          {renderTask(index, isFirstInGroup)}
                          {showAfter && !activeId && (
                            <DropSpacer
                              isVisible={true}
                              visibleColumns={visibleColumns}
                              isDarkMode={isDarkMode}
                            />
                          )}
                        </div>
                      );
                    }}
                    style={{ minWidth: 'max-content' }}
                  />
                </SortableContext>
              </div>
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay
            dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}
          >
            {activeId ? (
              <div
                className="bg-white dark:bg-gray-800 shadow-2xl rounded-lg border-2 border-blue-500 dark:border-blue-400 opacity-95"
                style={{ width: visibleColumns.find(col => col.id === 'title')?.width || '300px' }}
              >
                <div className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <HolderOutlined className="text-blue-500 dark:text-blue-400 text-sm" />
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                      {allTasks.find(task => task.id === activeId)?.name ||
                        allTasks.find(task => task.id === activeId)?.title ||
                        t('emptyStates.dragTaskFallback')}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>

          {/* Bulk Action Bar */}
          {selectedTaskIds.length > 0 && urlProjectId && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
              <OptimizedBulkActionBar
                selectedTaskIds={selectedTaskIds}
                totalSelected={selectedTaskIds.length}
                projectId={urlProjectId}
                canCreateTask={canCreateTask}
                onClearSelection={bulkActions.handleClearSelection}
                onBulkStatusChange={statusId =>
                  bulkActions.handleBulkStatusChange(statusId, selectedTaskIds)
                }
                onBulkPriorityChange={priorityId =>
                  bulkActions.handleBulkPriorityChange(priorityId, selectedTaskIds)
                }
                onBulkPhaseChange={phaseId =>
                  bulkActions.handleBulkPhaseChange(phaseId, selectedTaskIds)
                }
                onBulkAssignToMe={() => bulkActions.handleBulkAssignToMe(selectedTaskIds)}
                onBulkAssignMembers={memberIds =>
                  bulkActions.handleBulkAssignMembers(memberIds, selectedTaskIds)
                }
                onBulkAddLabels={labelIds =>
                  bulkActions.handleBulkAddLabels(labelIds, selectedTaskIds)
                }
                onBulkArchive={() => bulkActions.handleBulkArchive(selectedTaskIds)}
                onBulkDelete={() => bulkActions.handleBulkDelete(selectedTaskIds)}
                onBulkDuplicate={() => bulkActions.handleBulkDuplicate(selectedTaskIds)}
                onBulkExport={() => bulkActions.handleBulkExport(selectedTaskIds)}
                onBulkSetDueDate={date => bulkActions.handleBulkSetDueDate(date, selectedTaskIds)}
                onBulkSetStartDate={date => bulkActions.handleBulkSetStartDate(date, selectedTaskIds)}
              />
            </div>
          )}

          {/* Custom Column Modal */}
          {createPortal(<CustomColumnModal />, document.body, 'custom-column-modal')}

          {/* Convert To Subtask Drawer */}
          {createPortal(<ConvertToSubtaskDrawer />, document.body, 'convert-to-subtask-drawer')}

          {/* Duplicate Task Modal */}
          {createPortal(
            <DuplicateTaskModal
              open={isOpenDuplicateTaskModal}
              onClose={() => dispatch(setDuplicateTaskModalStatus(false))}
            />,
            document.body,
            'duplicate-task-modal'
          )}
        </div>
      </DndContext>
    </>
  );
};

export default TaskListV2Section;
