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
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { HolderOutlined } from '@/shared/antd-imports';

// Redux hooks and selectors
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
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

// Hooks and utilities
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import { useSocket } from '@/socket/socketContext';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useBulkActions } from './hooks/useBulkActions';

// Constants and types
import { BASE_COLUMNS, ColumnStyle } from './constants/columns';
import { Task } from '@/types/task-management.types';
import { SocketEvents } from '@/shared/socket-events';

const TaskListV2Section: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projectId: urlProjectId } = useParams();
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

  const fields = useAppSelector(state => state.taskManagementFields) || [];
  const columns = useAppSelector(selectColumns);
  const customColumns = useAppSelector(selectCustomColumns);
  const loadingColumns = useAppSelector(selectLoadingColumns);

  // Refs for scroll synchronization
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // State hooks
  const [initializedFromDatabase, setInitializedFromDatabase] = useState(false);
  const [addTaskRows, setAddTaskRows] = useState<{ [groupId: string]: string[] }>({});

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

  // Custom hooks
  const { activeId, overId, dropPosition, handleDragStart, handleDragOver, handleDragEnd } =
    useDragAndDrop(allTasks, groups);
  const bulkActions = useBulkActions();

  // Enable real-time updates via socket handlers
  useTaskSocketHandlers();

  // Filter visible columns based on local fields (primary) and backend columns (fallback)
  const visibleColumns = useMemo(() => {
    // Start with base columns
    const baseVisibleColumns = BASE_COLUMNS.filter(column => {
      // Always show drag handle and title (sticky columns)
      if (column.isSticky) return true;

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

          return {
            id: column.key || column.id || 'unknown',
            label: column.name || t('customColumns.customColumnHeader'),
            width: `${(column as any).width || defaultWidth}px`,
            key: column.key || column.id || 'unknown',
            custom_column: true,
            custom_column_obj: transformedColumnObj,
            isCustom: true,
            name: column.name,
            uuid: column.id,
          };
        }) || [];

    return [...baseVisibleColumns, ...visibleCustomColumns];
  }, [fields, columns, customColumns, t]);

  // Effects
  useEffect(() => {
    if (urlProjectId) {
      dispatch(fetchTasksV3(urlProjectId));
      dispatch(fetchTaskListColumns(urlProjectId));
      dispatch(fetchPhasesByProjectId(urlProjectId));
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
  const renderColumnHeaders = useCallback(
    () => (
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

            const columnStyle: ColumnStyle = {
              width: column.width,
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

            return (
              <div
                key={column.id}
                className={`text-sm font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 ${
                  column.id === 'dragHandle'
                    ? 'flex items-center justify-center'
                    : column.id === 'checkbox'
                      ? 'flex items-center justify-center'
                      : column.id === 'taskKey'
                        ? 'flex items-center pl-3'
                        : column.id === 'title'
                          ? 'flex items-center justify-between'
                          : column.id === 'description'
                            ? 'flex items-center px-2'
                            : column.id === 'labels'
                              ? 'flex items-center gap-0.5 flex-wrap min-w-0 px-2'
                              : column.id === 'assignees'
                                ? 'flex items-center px-2'
                                : 'flex items-center justify-center px-2'
                }`}
                style={columnStyle}
              >
                {column.id === 'dragHandle' || column.id === 'checkbox' ? (
                  <span></span>
                ) : (column as any).isCustom ? (
                  <CustomColumnHeader
                    column={column}
                    onSettingsClick={handleCustomColumnSettings}
                  />
                ) : (
                  t(column.label || '')
                )}
              </div>
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
    ),
    [visibleColumns, t, handleCustomColumnSettings]
  );

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
        <div className="flex flex-col bg-white dark:bg-gray-900 h-full overflow-hidden">
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
        </div>
      </DndContext>
    </>
  );
};

export default TaskListV2Section;
