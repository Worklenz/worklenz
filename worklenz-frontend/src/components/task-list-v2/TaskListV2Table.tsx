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
  Modifier,
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
import { HolderOutlined } from '@/shared/antd-imports';
import '../../pages/projects/project-view-1/taskList/taskListTable/column-resize.css';

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
  selectColumns,
  selectCustomColumns,
  selectLoadingColumns,
  updateColumnVisibility,
  setDuplicateTaskModalStatus,
} from '@/features/task-management/task-management.slice';
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

// Components
import TaskRowWithSubtasks from './TaskRowWithSubtasks';
import TaskGroupHeader from './TaskGroupHeader';
import OptimizedBulkActionBar from '@/components/task-management/optimized-bulk-action-bar';
import CustomColumnModal from '@/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/custom-column-modal';
import AddTaskRow from './components/AddTaskRow';
import { AddCustomColumnButton, CustomColumnHeader } from './components/CustomColumnComponents';
import TaskListSkeleton from './components/TaskListSkeleton';
import ConvertToSubtaskDrawer from '@/components/task-list-common/convert-to-subtask-drawer/convert-to-subtask-drawer';
import EmptyListPlaceholder from '@/components/EmptyListPlaceholder';

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
        let leftPosition = 0;
        if (column.isSticky) {
          for (let i = 0; i < index; i++) {
            const prevColumn = visibleColumns[i];
            if (prevColumn.isSticky) {
              leftPosition += parseInt(prevColumn.width.replace('px', ''));
            }
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
            className="border-r border-blue-300 dark:border-blue-600"
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
        let leftPosition = 0;
        if (column.isSticky) {
          for (let i = 0; i < index; i++) {
            const prevColumn = visibleColumns[i];
            if (prevColumn.isSticky) {
              leftPosition += parseInt(prevColumn.width.replace('px', ''));
            }
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
            className="border-r border-gray-200 dark:border-gray-700"
            style={emptyColumnStyle}
          />
        );
      })}
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
}> = ({ column, isDropTarget, children }) => {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    zIndex: isDragging ? 25 : undefined,
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
};

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
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  // Redux state selectors
  const allTasks = useAppSelector(selectAllTasksArray);
  const groups = useAppSelector(selectGroups);
  const grouping = useAppSelector(selectGrouping);
  const loading = useAppSelector(selectLoading);
  const error = useAppSelector(selectError);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const selectedTaskIds = useAppSelector(selectSelectedTaskIds);
  const lastSelectedTaskId = useAppSelector(selectLastSelectedTaskId);
  const collapsedGroups = useAppSelector(selectCollapsedGroups);
  const isOpenDuplicateTaskModal = useAppSelector(
    state => state.taskManagement.isOpenDuplicateTaskModal
  );

  const fields = useAppSelector(state => state.taskManagementFields) || [];
  const columns = useAppSelector(selectColumns);
  const customColumns = useAppSelector(selectCustomColumns);
  const loadingColumns = useAppSelector(selectLoadingColumns);

  // Refs for scroll synchronization
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // Ref to store cleanup function for column resize drag operation
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  // State hooks
  const [initializedFromDatabase, setInitializedFromDatabase] = useState(false);
  const [addTaskRows, setAddTaskRows] = useState<{ [groupId: string]: string[] }>({});
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
        distance: 6,
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
  const containerStyle = useMemo(() => {
    const style: any = {};
    visibleColumns.forEach(col => {
      style[`--col-width-${col.id}`] = col.width;
    });
    return style;
  }, [visibleColumns]);

  // Effects
  useEffect(() => {
    if (urlProjectId) {
      dispatch(fetchTasksV3(urlProjectId));
      dispatch(fetchTaskListColumns(urlProjectId));
      dispatch(fetchPhasesByProjectId(urlProjectId));
      dispatch(fetchStatusesCategories());

      trackMixpanelEvent(evt_project_task_list_visit, { project_id: urlProjectId });
    }
  }, [dispatch, urlProjectId]);

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

  // Function to update custom column values
  const updateTaskCustomColumnValue = useCallback(
    (taskId: string, columnKey: string, value: string) => {
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

  // Add callback for task added
  const handleTaskAdded = useCallback((rowId: string) => {
    // Task is now added in real-time via socket, no need to refetch
    // The global socket handler will handle the real-time update

    // Find the group this row belongs to
    const groupId = rowId.split('-')[2]; // Extract from rowId format: add-task-{groupId}-{index}

    // Add a new add task row to this group
    setAddTaskRows(prev => {
      const currentRows = prev[groupId] || [];
      const newRowId = `add-task-${groupId}-${currentRows.length + 1}`;
      return {
        ...prev,
        [groupId]: [...currentRows, newRowId],
      };
    });
  }, []);

  // Handle scroll synchronization - disabled since header is now sticky inside content
  const handleContentScroll = useCallback(() => {
    // No longer needed since header scrolls naturally with content
  }, []);

  // Column drag-and-drop handlers
  const handleColumnDragStart = useCallback((event: any) => {
    setActiveColumnId(event?.active?.id || null);
  }, []);

  const handleColumnDragOver = useCallback((event: any) => {
    setOverColumnId(event?.over?.id || null);
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

      // Get add task rows for this group
      const groupAddRows = addTaskRows[group.id] || [];
      const addTaskItems = !isCurrentGroupCollapsed
        ? [
            // Default add task row
            {
              id: `add-task-${group.id}-0`,
              isAddTaskRow: true,
              groupId: group.id,
              groupType: currentGrouping || 'status',
              groupValue: group.id, // Send the UUID that backend expects
              projectId: urlProjectId,
              rowId: `add-task-${group.id}-0`,
              autoFocus: false,
            },
            // Additional add task rows
            ...groupAddRows.map((rowId, index) => ({
              id: rowId,
              isAddTaskRow: true,
              groupId: group.id,
              groupType: currentGrouping || 'status',
              groupValue: group.id, // Send the UUID that backend expects
              projectId: urlProjectId,
              rowId: rowId,
              autoFocus: index === groupAddRows.length - 1, // Auto-focus the latest row
            })),
          ]
        : [];

      const itemsWithAddTask = !isCurrentGroupCollapsed
        ? [...tasksForVirtuoso, ...addTaskItems]
        : tasksForVirtuoso;

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
  }, [groups, allTasks, collapsedGroups, currentGrouping, urlProjectId, addTaskRows]);

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
        <div className={groupIndex > 0 ? 'mt-2' : ''}>
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
          {isGroupEmpty && !isGroupCollapsed && (
            <EmptyGroupMessage visibleColumns={visibleColumns} isDarkMode={isDarkMode} />
          )}
        </div>
      );
    },
    [virtuosoGroups, collapsedGroups, handleGroupCollapse, visibleColumns, t, isDarkMode]
  );

  const renderTask = useCallback(
    (taskIndex: number, isFirstInGroup: boolean = false) => {
      const item = virtuosoItems[taskIndex];

      if (!item || !urlProjectId) return null;

      if ('isAddTaskRow' in item && item.isAddTaskRow) {
        return (
          <AddTaskRow
            groupId={item.groupId}
            groupType={item.groupType}
            groupValue={item.groupValue}
            projectId={urlProjectId}
            visibleColumns={visibleColumns}
            onTaskAdded={handleTaskAdded}
            rowId={item.rowId}
            autoFocus={item.autoFocus}
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
        />
      );
    },
    [virtuosoItems, visibleColumns, urlProjectId, handleTaskAdded, updateTaskCustomColumnValue]
  );

  // Render column headers
  const renderColumnHeaders = useCallback(() => {
    const reorderableColumns = visibleColumns.filter(column => !column.isSticky);

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
          items={reorderableColumns.map(column => column.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div
            className="border-b border-gray-200 dark:border-gray-700"
            style={{
              width: '100%',
              minWidth: 'max-content',
              backgroundColor: isDarkMode ? '#141414' : '#f9fafb',
            }}
          >
            <div
              className="flex items-center px-1 py-3 w-full"
              style={{ minWidth: 'max-content', height: '44px' }}
            >
              {visibleColumns.map((column, index) => {
                const isDropTarget = overColumnId === column.id && column.id !== activeColumnId;

                // Calculate left position for sticky columns
                let leftPosition = 4; // Account for px-1 (4px) padding on container
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
                    className={`text-sm font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 column-header-cell ${
                      column.id === 'dragHandle'
                        ? 'flex items-center justify-center'
                        : column.id === 'checkbox'
                          ? 'flex items-center justify-center'
                          : column.id === 'taskKey'
                            ? 'flex items-center pl-3'
                            : column.id === 'title'
                              ? 'flex items-center justify-between'
                              : column.id === 'description'
                                ? 'flex items-center pl-2'
                                : column.id === 'labels'
                                  ? 'flex items-center gap-0.5 flex-wrap min-w-0 px-2'
                                  : column.id === 'assignees'
                                    ? 'flex items-center px-2'
                                    : 'flex items-center justify-center px-2'
                    } ${isDropTarget ? 'column-drop-target' : ''}`}
                    style={{
                      ...columnStyle,
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
                      />
                    ) : (
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          paddingRight: '20px',
                          flex: 1,
                        }}
                      >
                        {t(column.label || '')}
                      </span>
                    )}

                    {/* Column drag handle */}
                    {!column.isSticky && (
                      <span
                        className="column-drag-handle"
                        ref={dragParams?.setActivatorNodeRef}
                        {...dragParams?.attributes}
                        {...dragParams?.listeners}
                        aria-label={t('moveColumnHandle')}
                        title={t('moveColumnHandle')}
                      >
                        <HolderOutlined style={{ fontSize: 12 }} />
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

                          // Get min/max widths from column config or use defaults
                          const minWidth = (column as any).minWidth
                            ? parseInt((column as any).minWidth.replace('px', ''), 10)
                            : 100;
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

                          // Get min/max widths from column config or use defaults
                          const minWidth = column.minWidth
                            ? parseInt(column.minWidth.replace('px', ''), 10)
                            : 100;
                          const maxWidth = column.maxWidth
                            ? parseInt(column.maxWidth.replace('px', ''), 10)
                            : 1200;

                          // Find the scrollable table container
                          const scrollableContainer =
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
                          tableContainer.style.position = 'relative';
                          tableContainer.appendChild(indicator);

                          // Create tooltip
                          const tooltip = document.createElement('div');
                          tooltip.className = 'column-resize-tooltip';
                          document.body.appendChild(tooltip);

                          // Add resizing class
                          handleElement.classList.add('resizing');
                          document.body.classList.add('column-resizing');

                          const updateIndicator = (x: number, width: number) => {
                            // Calculate position relative to table container
                            const containerRect = tableContainer.getBoundingClientRect();
                            const relativeX = x - containerRect.left;
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

                            // Update indicator and tooltip
                            updateIndicator(moveEvent.clientX, newWidth);
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
  ]);

  // Loading and error states
  if (loading || loadingColumns) {
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
      const unmappedGroup = {
        id: 'Unmapped',
        title: 'Unmapped',
        groupType: 'phase',
        groupValue: 'Unmapped', // Use same ID as groupValue for consistency
        collapsed: false,
        tasks: [],
        taskIds: [],
        color: '#fbc84c69',
        actualCount: 0,
        count: 1, // For the add task row
        startIndex: 0,
      };

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
                ref={contentScrollRef}
                className="flex-1 bg-white dark:bg-gray-900 relative"
                style={{
                  overflowX: 'auto',
                  overflowY: 'auto',
                  minHeight: 0,
                }}
              >
                {/* Sticky Column Headers */}
                <div
                  className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-800"
                  style={{ width: '100%', minWidth: 'max-content' }}
                >
                  {renderColumnHeaders()}
                </div>

                <div style={{ minWidth: 'max-content' }}>
                  <div className="mt-2">
                    <TaskGroupHeader
                      group={{
                        id: 'Unmapped',
                        name: 'Unmapped',
                        count: 0,
                        color: '#fbc84c69',
                      }}
                      isCollapsed={false}
                      onToggle={() => {}}
                      projectId={urlProjectId || ''}
                    />
                    <AddTaskRow
                      groupId="Unmapped"
                      groupType="phase"
                      groupValue="Unmapped"
                      projectId={urlProjectId || ''}
                      visibleColumns={visibleColumns}
                      onTaskAdded={handleTaskAdded}
                      rowId="add-task-Unmapped-0"
                      autoFocus={false}
                    />
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
            {/* Task List Content with Sticky Header */}
            <div
              ref={contentScrollRef}
              className="flex-1 bg-white dark:bg-gray-900 relative"
              style={{
                overflowX: 'auto',
                overflowY: 'auto',
                minHeight: 0,
              }}
            >
              {/* Sticky Column Headers */}
              <div
                className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-800"
                style={{ width: '100%', minWidth: 'max-content' }}
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
                <div style={{ minWidth: 'max-content' }}>
                  {/* Render groups manually for debugging */}
                  {virtuosoGroups.map((group, groupIndex) => (
                    <div key={group.id}>
                      {/* Group Header */}
                      {renderGroup(groupIndex)}

                      {/* Group Tasks */}
                      {!collapsedGroups.has(group.id) &&
                        (group.tasks.length > 0
                          ? group.tasks.map((task, taskIndex) => {
                              const globalTaskIndex =
                                virtuosoGroups
                                  .slice(0, groupIndex)
                                  .reduce((sum, g) => sum + g.count, 0) + taskIndex;

                              // Check if this is the first actual task in the group (not AddTaskRow)
                              const isFirstTaskInGroup =
                                taskIndex === 0 && !('isAddTaskRow' in task);

                              // Check if we should show drop spacer
                              const isOverThisTask =
                                activeId && overId === task.id && !('isAddTaskRow' in task);
                              const showDropSpacerBefore =
                                isOverThisTask && dropPosition === 'before';
                              const showDropSpacerAfter =
                                isOverThisTask && dropPosition === 'after';

                              return (
                                <div key={task.id || `add-task-${group.id}-${taskIndex}`}>
                                  {showDropSpacerBefore && (
                                    <DropSpacer
                                      isVisible={true}
                                      visibleColumns={visibleColumns}
                                      isDarkMode={isDarkMode}
                                    />
                                  )}
                                  {renderTask(globalTaskIndex, isFirstTaskInGroup)}
                                  {showDropSpacerAfter && (
                                    <DropSpacer
                                      isVisible={true}
                                      visibleColumns={visibleColumns}
                                      isDarkMode={isDarkMode}
                                    />
                                  )}
                                </div>
                              );
                            })
                          : null)}
                    </div>
                  ))}
                </div>
              </SortableContext>
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
