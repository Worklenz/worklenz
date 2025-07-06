import React, { useCallback, useMemo, useEffect } from 'react';
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
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Skeleton } from 'antd';
import { HolderOutlined } from '@ant-design/icons';

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

// Components
import TaskRowWithSubtasks from './TaskRowWithSubtasks';
import TaskGroupHeader from './TaskGroupHeader';
import ImprovedTaskFilters from '@/components/task-management/improved-task-filters';
import OptimizedBulkActionBar from '@/components/task-management/optimized-bulk-action-bar';
import CustomColumnModal from '@/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/custom-column-modal';
import AddTaskRow from './components/AddTaskRow';
import {
  AddCustomColumnButton,
  CustomColumnHeader,
} from './components/CustomColumnComponents';

// Hooks and utilities
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import { useSocket } from '@/socket/socketContext';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useBulkActions } from './hooks/useBulkActions';

// Constants and types
import { BASE_COLUMNS, ColumnStyle } from './constants/columns';
import { Task } from '@/types/task-management.types';
import { SocketEvents } from '@/shared/socket-events';

const TaskListV2: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projectId: urlProjectId } = useParams();
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();

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
  const { activeId, handleDragStart, handleDragOver, handleDragEnd } = useDragAndDrop(allTasks, groups);
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
    const visibleCustomColumns = customColumns
      ?.filter(column => column.pinned)
      ?.map(column => ({
        id: column.key || column.id || 'unknown',
        label: column.name || t('customColumns.customColumnHeader'),
        width: `${(column as any).width || 120}px`,
        key: column.key || column.id || 'unknown',
        custom_column: true,
        custom_column_obj: column.custom_column_obj || (column as any).configuration,
        isCustom: true,
        name: column.name,
        uuid: column.id,
      })) || [];

    return [...baseVisibleColumns, ...visibleCustomColumns];
  }, [fields, columns, customColumns, t]);

  // Sync local field changes with backend column configuration (debounced)
  useEffect(() => {
    if (!urlProjectId || columns.length === 0 || fields.length === 0) return;

    const timeoutId = setTimeout(() => {
      const changedFields = fields.filter(field => {
        const backendColumn = columns.find(c => c.key === field.key);
        if (backendColumn) {
          return (backendColumn.pinned ?? false) !== field.visible;
        }
        return false;
      });

      changedFields.forEach(field => {
        const backendColumn = columns.find(c => c.key === field.key);
        if (backendColumn) {
          dispatch(updateColumnVisibility({
            projectId: urlProjectId,
            item: {
              ...backendColumn,
              pinned: field.visible
            }
          }));
        }
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [fields, columns, urlProjectId, dispatch]);

  // Effects
  useEffect(() => {
    if (urlProjectId) {
      dispatch(fetchTasksV3(urlProjectId));
      dispatch(fetchTaskListColumns(urlProjectId));
    }
  }, [dispatch, urlProjectId]);

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
  const updateTaskCustomColumnValue = useCallback((taskId: string, columnKey: string, value: string) => {
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

      if (socket && connected) {
        socket.emit(SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(), JSON.stringify(body));
      } else {
        console.warn('Socket not connected, unable to emit TASK_CUSTOM_COLUMN_UPDATE event');
      }
    } catch (error) {
      console.error('Error updating custom column value:', error);
    }
  }, [urlProjectId, socket, connected]);

  // Custom column settings handler
  const handleCustomColumnSettings = useCallback((columnKey: string) => {
    if (!columnKey) return;
    
    const columnData = visibleColumns.find(col => col.key === columnKey || col.id === columnKey);
    
    dispatch(setCustomColumnModalAttributes({ 
      modalType: 'edit', 
      columnId: columnKey,
      columnData: columnData
    }));
    dispatch(toggleCustomColumnModalOpen(true));
  }, [dispatch, visibleColumns]);

  // Add callback for task added
  const handleTaskAdded = useCallback(() => {
    if (urlProjectId) {
      dispatch(fetchTasksV3(urlProjectId));
    }
  }, [dispatch, urlProjectId]);

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

      const itemsWithAddTask = !isCurrentGroupCollapsed ? [
        ...tasksForVirtuoso,
        {
          id: `add-task-${group.id}`,
          isAddTaskRow: true,
          groupId: group.id,
          groupType: currentGrouping || 'status',
          groupValue: group.id, // Use the actual database ID from backend
          projectId: urlProjectId,
        }
      ] : tasksForVirtuoso;

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
  }, [groups, allTasks, collapsedGroups, currentGrouping, urlProjectId]);

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
              color: group.color,
            }}
            isCollapsed={isGroupCollapsed}
            onToggle={() => handleGroupCollapse(group.id)}
          />
          {isGroupEmpty && !isGroupCollapsed && (
            <div className="relative w-full">
              <div className="flex items-center min-w-max px-1 py-3">
                {visibleColumns.map((column) => (
                  <div
                    key={`empty-${column.id}`}
                    style={{ width: column.width, flexShrink: 0 }}
                  />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-sm italic text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 px-4 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                  {t('noTasksInGroup')}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    },
    [virtuosoGroups, collapsedGroups, handleGroupCollapse, visibleColumns, t]
  );

  const renderTask = useCallback(
    (taskIndex: number) => {
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
          />
        );
      }
      
      return (
        <TaskRowWithSubtasks
          taskId={item.id}
          projectId={urlProjectId}
          visibleColumns={visibleColumns}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      );
    },
    [virtuosoItems, visibleColumns, urlProjectId, handleTaskAdded, updateTaskCustomColumnValue]
  );

  // Render column headers
  const renderColumnHeaders = useCallback(() => (
            <div className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center px-1 py-3 w-full" style={{ minWidth: 'max-content', height: '44px' }}>
                {visibleColumns.map(column => {
                  const columnStyle: ColumnStyle = {
                    width: column.width,
                    flexShrink: 0,
                    ...(column.id === 'labels' && column.width === 'auto'
                      ? {
                          minWidth: '200px',
                          flexGrow: 1,
                        }
                      : {}),
                    ...((column as any).minWidth && { minWidth: (column as any).minWidth }),
                    ...((column as any).maxWidth && { maxWidth: (column as any).maxWidth }),
                  };

                  return (
                    <div
                      key={column.id}
                      className={`text-sm font-semibold text-gray-600 dark:text-gray-300 ${
                        column.id === 'taskKey' ? 'pl-3' : ''
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
                <div className="flex items-center justify-center" style={{ width: '60px', flexShrink: 0 }}>
                  <AddCustomColumnButton />
                </div>
              </div>
            </div>
  ), [visibleColumns, t, handleCustomColumnSettings]);

  // Loading and error states
  if (loading || loadingColumns) return <Skeleton active />;
  if (error) return <div>Error: {error}</div>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col bg-white dark:bg-gray-900" style={{ height: '100vh', overflow: 'hidden' }}>
        {/* Task Filters */}
        <div className="flex-none px-4 py-3" style={{ height: '66px', flexShrink: 0 }}>
          <ImprovedTaskFilters position="list" />
        </div>

        {/* Table Container */}
        <div 
          className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700" 
          style={{ 
            height: '600px',
            maxHeight: '600px'
          }}
        >
          <div style={{ minWidth: 'max-content' }}>
            {/* Column Headers */}
            {renderColumnHeaders()}

            {/* Task List Content */}
            <div className="bg-white dark:bg-gray-900">
              <SortableContext
                items={virtuosoItems
                  .filter(item => !('isAddTaskRow' in item) && !item.parent_task_id)
                  .map(item => item.id)
                  .filter((id): id is string => id !== undefined)}
                strategy={verticalListSortingStrategy}
              >
                <GroupedVirtuoso
                  style={{ height: '550px' }}
                  groupCounts={virtuosoGroupCounts}
                  groupContent={renderGroup}
                  itemContent={renderTask}
                  components={{
                    List: React.forwardRef<
                      HTMLDivElement,
                      { style?: React.CSSProperties; children?: React.ReactNode }
                    >(({ style, children }, ref) => (
                      <div ref={ref} style={style || {}} className="virtuoso-list-container bg-white dark:bg-gray-900">
                        {children}
                      </div>
                    )),
                  }}
                />
              </SortableContext>
            </div>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-md border-2 border-blue-400 opacity-95">
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <HolderOutlined className="text-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {allTasks.find(task => task.id === activeId)?.name ||
                        allTasks.find(task => task.id === activeId)?.title ||
                        'Task'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {allTasks.find(task => task.id === activeId)?.task_key}
                    </div>
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
              onBulkStatusChange={bulkActions.handleBulkStatusChange}
              onBulkPriorityChange={bulkActions.handleBulkPriorityChange}
              onBulkPhaseChange={bulkActions.handleBulkPhaseChange}
              onBulkAssignToMe={bulkActions.handleBulkAssignToMe}
              onBulkAssignMembers={bulkActions.handleBulkAssignMembers}
              onBulkAddLabels={bulkActions.handleBulkAddLabels}
              onBulkArchive={bulkActions.handleBulkArchive}
              onBulkDelete={bulkActions.handleBulkDelete}
              onBulkDuplicate={bulkActions.handleBulkDuplicate}
              onBulkExport={bulkActions.handleBulkExport}
              onBulkSetDueDate={bulkActions.handleBulkSetDueDate}
            />
          </div>
        )}

        {/* Custom Column Modal */}
        {createPortal(<CustomColumnModal />, document.body, 'custom-column-modal')}
      </div>
    </DndContext>
  );
};

export default TaskListV2;
