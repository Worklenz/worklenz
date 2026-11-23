import { selectEffectiveStatusCategoryOrder } from '@/features/project/project.slice';
import { getDoneStatusGroupIds, getCollapsedGroupIds } from '@/utils/status-category-order';
import { BacklogSectionColumnHeader } from './components/BacklogSectionColumnHeader';
import {
  BACKLOG_COLUMN_HEADER_HEIGHT,
  BACKLOG_VIRTUOSO_COMPONENTS,
} from './components/BacklogVirtuosoComponents';
import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GroupedVirtuoso } from 'react-virtuoso';
import {
  DndContext,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  TouchSensor,
  closestCenter,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { theme } from '@/shared/antd-imports';
import './column-resize.css';

// Redux hooks and selectors
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  selectAllTasksArray,
  selectGroups,
  selectLoading,
  selectError,
  fetchTasksV3,
  fetchTaskListColumns,
  selectLoadingColumns,
  selectLoadedProjectId,
  setDuplicateTaskModalStatus,
} from '@/features/task-management/task-management.slice';
import { setProjectContext } from '@/features/task-management/taskListFields.slice';
import {
  selectCurrentGrouping,
  selectCollapsedGroups,
  setGroupCollapsed,
  selectGroupStates,
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
  selectHasTaskListFilters,
  selectShouldFetchInitialTaskList,
} from '@/features/task-management/task-management.selectors';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { useTaskListMode } from '@/features/task-management/task-list-mode-context';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import { useAuthService } from '@/hooks/useAuth';
import useTaskCreationPermission from '@/hooks/useTaskCreationPermission';
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import { useSocket } from '@/socket/socketContext';
import { evt_project_task_list_visit } from '@/shared/worklenz-analytics-events';

// Subcomponents and hooks
import { TaskListColumnHeaders } from './components/TaskListColumnHeaders';
import { TaskListGroupRow } from './components/TaskListGroupRow';
import { TaskListRowItem } from './components/TaskListRowItem';
import { TaskListEmptyState } from './components/TaskListEmptyState';
import { TaskListDragOverlay } from './components/TaskListDragOverlay';
import { TaskListBulkActionBar } from './components/TaskListBulkActionBar';
import { TaskListPortals } from './components/TaskListPortals';
import TaskListSkeleton from './components/TaskListSkeleton';
import { TASK_LIST_VIRTUOSO_COMPONENTS } from './components/VirtuosoGroup';
import { TASK_LIST_VIRTUALIZATION } from './constants/virtualization';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useBulkActions } from './hooks/useBulkActions';
import { useVirtuosoGroups } from './hooks/useVirtuosoGroups';
import { useTaskListScrollContainer } from './hooks/useTaskListScrollContainer';
import { useTaskListMeasurement } from './hooks/useTaskListMeasurement';
import { useTaskListColumns } from './hooks/useTaskListColumns';
import { useTaskInlineOperations } from './hooks/useTaskInlineOperations';
import { useSortableTaskIds } from './hooks/useSortableTaskIds';
import { isTaskListProfilingEnabled, recordTaskListRender } from './task-list-profiling';

interface TaskListV2SectionProps {
  isGuest?: boolean;
}

const TaskListV2Section: React.FC<TaskListV2SectionProps> = ({ isGuest = false }) => {
  const dispatch = useAppDispatch();
  const { projectId: urlProjectId } = useParams();
  const activeProjectIdRef = useRef(urlProjectId);
  activeProjectIdRef.current = urlProjectId;
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';
  const { token: themeToken } = theme.useToken();

  // Task creation/assignment restriction (Business Plan feature)
  const { canCreateTask: canCreateTaskPermission } = useTaskCreationPermission();

  // Redux state selectors
  const allTasks = useAppSelector(selectAllTasksArray);
  const groups = useAppSelector(selectGroups);
  const loading = useAppSelector(selectLoading);
  const error = useAppSelector(selectError);
  const loadedProjectId = useAppSelector(selectLoadedProjectId);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const selectedTaskIds = useAppSelector(selectSelectedTaskIds);
  const lastSelectedTaskId = useAppSelector(selectLastSelectedTaskId);
  const statusCategoryOrder = useAppSelector(selectEffectiveStatusCategoryOrder);
  const statuses = useAppSelector(state => state.taskStatusReducer.status);
  const sortField = useAppSelector(state => state.taskManagement.sortField);
  const sortOrder = useAppSelector(state => state.taskManagement.sortOrder);
  const persistedCollapsedGroups = useAppSelector(selectCollapsedGroups);
  const groupStates = useAppSelector(selectGroupStates);
  const doneStatusGroupIds = useMemo(
    () => getDoneStatusGroupIds(groups, statuses),
    [groups, statuses]
  );
  const collapsedGroups = useMemo(
    () => getCollapsedGroupIds(groups, doneStatusGroupIds, persistedCollapsedGroups, groupStates),
    [groups, doneStatusGroupIds, persistedCollapsedGroups, groupStates]
  );
  const isOpenDuplicateTaskModal = useAppSelector(
    state => state.taskManagement.isOpenDuplicateTaskModal
  );
  const isOpenConvertToSubtaskDrawer = useAppSelector(
    state => state.taskReducer.convertToSubtaskDrawerOpen
  );
  const selectedTaskId = useAppSelector(state => state.taskDrawerReducer.selectedTaskId);
  const showTaskDrawer = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);
  const loadingColumns = useAppSelector(selectLoadingColumns);

  const listMode = useTaskListMode();
  const isBacklogMode = listMode === 'backlog';
  const projectType = useAppSelector(state => state.projectReducer.project?.project_type);
  const isSoftwareProject = isSoftwareProjectType(projectType);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const canCreateTask = canCreateTaskPermission;
  const isWorkReadOnly = isGuest;

  const activeSprintGroupIds = useMemo(
    () =>
      new Set(
        phaseList
          .filter(phase => phase.sprint_status === 'active')
          .flatMap(phase => [phase.id, `phase-${phase.id}`])
      ),
    [phaseList]
  );

  useEffect(() => {
    if (isWorkReadOnly && selectedTaskIds.length > 0) {
      dispatch(clearSelection());
    }
  }, [dispatch, isWorkReadOnly, selectedTaskIds.length]);

  // Refs for scroll synchronization
  const { outerScrollRef, scrollContainer, attachScrollContainer } = useTaskListScrollContainer();
  const contentScrollRef = useRef<HTMLDivElement>(null); // handles vertical scroll (customScrollParent for virtuoso)
  const scheduleListMeasurement = useTaskListMeasurement({
    projectId: urlProjectId,
    loadedProjectId,
    groups,
    collapsedGroups,
    outerScrollRef,
    scrollContainer,
  });

  // Column management
  const {
    visibleColumns,
    columnWidths,
    setColumnWidths,
    containerStyle,
    activeColumnId,
    overColumnId,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragEnd,
    handleCustomColumnSettings,
  } = useTaskListColumns({
    projectId: urlProjectId,
    isBacklogMode,
    isSoftwareProject,
    scrollContainer,
  });

  // Task inline creation & drawer operations
  const {
    activeAddRowsByGroup,
    setActiveAddRowsByGroup,
    insertAnchor,
    setInsertAnchor,
    handleActivateAddRow,
    handleDeactivateAddRow,
    handleTaskCreated,
    updateTaskCustomColumnValue,
  } = useTaskInlineOperations({
    projectId: urlProjectId,
    groups,
    allTasks,
    currentGrouping,
    socket,
    connected,
    currentSession,
    showTaskDrawer,
    selectedTaskId,
  });

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

  // Drag and drop hook
  const {
    activeId,
    overId,
    overGroupId,
    dropPosition,
    handleDragStart: originalHandleDragStart,
    handleDragOver: originalHandleDragOver,
    handleDragEnd,
  } = useDragAndDrop(allTasks, groups, t);

  // Wrap drag handlers to prevent dragging when work items are locked
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (isWorkReadOnly) return;
      originalHandleDragStart(event);
    },
    [isWorkReadOnly, originalHandleDragStart]
  );

  const handleDragOver = useCallback(
    (event: any) => {
      if (isWorkReadOnly) return;
      originalHandleDragOver(event);
    },
    [isWorkReadOnly, originalHandleDragOver]
  );

  const handleDragEndWrapper = useCallback(
    (event: DragEndEvent) => {
      if (isWorkReadOnly) return;
      handleDragEnd(event);
    },
    [isWorkReadOnly, handleDragEnd]
  );

  const bulkActions = useBulkActions();

  // Enable real-time updates via socket handlers
  useTaskSocketHandlers();

  // Set project context for field visibility when project changes
  useEffect(() => {
    if (urlProjectId) {
      dispatch(setProjectContext(urlProjectId));
    }
  }, [dispatch, urlProjectId]);

  // Effects
  const shouldFetchInitialData = useAppSelector(state =>
    selectShouldFetchInitialTaskList(state, urlProjectId)
  );

  const shouldShowInitialSkeleton = useMemo(() => {
    return !!urlProjectId && shouldFetchInitialData && groups.length === 0;
  }, [urlProjectId, shouldFetchInitialData, groups.length]);

  const hasActiveFilters = useAppSelector(state =>
    selectHasTaskListFilters(state, listMode !== 'backlog')
  );

  const hasNoTasks = useMemo(
    () => allTasks.length === 0 && !hasActiveFilters,
    [allTasks, hasActiveFilters]
  );

  const initialFetchProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !urlProjectId ||
      !shouldFetchInitialData ||
      initialFetchProjectRef.current === urlProjectId
    ) {
      return;
    }

    initialFetchProjectRef.current = urlProjectId;
    void dispatch(fetchTasksV3(urlProjectId)).finally(() => {
      if (initialFetchProjectRef.current === urlProjectId) initialFetchProjectRef.current = null;
    });
    dispatch(fetchTaskListColumns(urlProjectId))
      .unwrap()
      .then(res => {
        const hasPinnedCustom =
          Array.isArray(res?.custom) && res.custom.some((col: any) => col.pinned !== false);
        if (hasPinnedCustom && urlProjectId && activeProjectIdRef.current === urlProjectId) {
          dispatch(fetchTasksV3(urlProjectId));
        }
      })
      .catch(() => {});
    dispatch(fetchPhasesByProjectId(urlProjectId));
    dispatch(fetchStatusesCategories());
  }, [dispatch, urlProjectId, shouldFetchInitialData]);

  const prevGroupingRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevGroupingRef.current === undefined) {
      prevGroupingRef.current = currentGrouping;
      return;
    }

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

  const handleGroupCollapse = useCallback(
    (groupId: string) => {
      dispatch(setGroupCollapsed({ groupId, collapsed: !collapsedGroups.has(groupId) }));
    },
    [dispatch, collapsedGroups]
  );

  const virtuosoGroups = useVirtuosoGroups({
    groups,
    allTasks,
    collapsedGroups,
    currentGrouping,
    urlProjectId,
    insertAnchor,
    isBacklogMode,
    isSoftwareProject,
    phaseList,
    statuses,
    statusCategoryOrder,
    sortField,
    sortOrder,
  });

  const virtuosoGroupCounts = useMemo(() => {
    return virtuosoGroups.map(group => group.count);
  }, [virtuosoGroups]);

  const virtuosoItems = useMemo(() => {
    return virtuosoGroups.flatMap(group => group.tasks);
  }, [virtuosoGroups]);

  const sortableTaskIds = useSortableTaskIds(allTasks, virtuosoItems);

  // Loading and error states
  if (loading || loadingColumns || shouldShowInitialSkeleton) {
    return <TaskListSkeleton visibleColumns={visibleColumns} />;
  }
  if (error) {
    return (
      <div>
        {t('emptyStates.errorPrefix')} {error}
      </div>
    );
  }

  // Show message when no data - handles phase grouping unmapped state or empty groups
  if (groups.length === 0 && !loading) {
    return (
      <TaskListEmptyState
        currentGrouping={currentGrouping}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEndWrapper}
        attachScrollContainer={attachScrollContainer}
        outerScrollRef={outerScrollRef}
        contentScrollRef={contentScrollRef}
        visibleColumns={visibleColumns}
        overColumnId={overColumnId}
        activeColumnId={activeColumnId}
        columnSensors={columnSensors}
        handleColumnDragStart={handleColumnDragStart}
        handleColumnDragOver={handleColumnDragOver}
        handleColumnDragEnd={handleColumnDragEnd}
        handleCustomColumnSettings={handleCustomColumnSettings}
        columnWidths={columnWidths}
        setColumnWidths={setColumnWidths}
        isBacklogMode={isBacklogMode}
        isGuest={isGuest}
        isDarkMode={isDarkMode}
        projectId={urlProjectId || ''}
        hasNoTasks={hasNoTasks}
        canCreateTask={canCreateTask}
        isWorkReadOnly={isWorkReadOnly}
        onTaskCreated={(task, groupId, openDrawer) =>
          handleTaskCreated(task, groupId, openDrawer, null)
        }
      />
    );
  }

  return (
    <>
      <style>
        {`
          .group:hover .sticky-column-hover {
            background-color: var(--tl-sticky-cell-hover-bg) !important;
          }

          .virtuoso-group-header-wrapper {
            top: 40px !important;
            z-index: 20 !important;
            background-color: var(--tl-group-header-bg) !important;
            transition: background-color 200ms cubic-bezier(0.4, 0, 0.2, 1);
          }

          .tasklist-backlog .virtuoso-group-header-wrapper,
          .tasklist-backlog-group-header {
            top: ${BACKLOG_COLUMN_HEADER_HEIGHT}px !important;
            background-color: var(--tl-backlog-group-header-bg) !important;
          }

          .tasklist-backlog .ant-select-borderless .ant-select-selector {
            background-color: transparent !important;
            border: 1px solid transparent !important;
            transition: border-color 0.15s ease;
          }

          .tasklist-backlog .ant-select-borderless:hover .ant-select-selector,
          .tasklist-backlog .ant-select-borderless.ant-select-focused .ant-select-selector {
            border-color: ${themeToken.colorBorder} !important;
          }

          .tasklist-backlog .epic-inline-select .ant-select-selection-item {
            color: ${themeToken.colorText};
            font-size: 11px;
          }

          .column-header-cell {
            will-change: auto;
          }

          [data-column-id] {
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
          }

          .overflow-x-auto,
          .labels-scroll-container,
          .single-line-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .overflow-x-auto::-webkit-scrollbar,
          .labels-scroll-container::-webkit-scrollbar,
          .single-line-scroll::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEndWrapper}
        modifiers={[restrictToVerticalAxis]}
      >
        <div
          id="task-list-container"
          className={`flex flex-col h-full overflow-hidden ${
            isBacklogMode ? 'tasklist-backlog' : 'bg-[var(--tl-surface-bg)]'
          }`}
          style={containerStyle}
        >
          {/* Table Container */}
          <div
            className={
              isBacklogMode ? '' : 'border border-gray-200 dark:border-gray-700 rounded-lg'
            }
            style={{
              height: 'calc(100vh - 240px)',
              contain: 'layout',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              ref={attachScrollContainer}
              className={`flex-1 relative ${isBacklogMode ? '' : 'bg-[var(--tl-surface-bg)] transition-colors duration-200'}`}
              style={{
                overflowX: 'auto',
                overflowY: 'auto',
                minHeight: 0,
              }}
            >
              <div
                ref={contentScrollRef}
                style={{
                  minWidth: 'max-content',
                  overflowX: 'visible',
                  overflowY: 'visible',
                }}
              >
                {isBacklogMode ? (
                  <div
                    className="sticky top-0 z-30 bg-[var(--tl-header-bg)]"
                    style={{ minWidth: 'max-content', height: BACKLOG_COLUMN_HEADER_HEIGHT }}
                  >
                    <BacklogSectionColumnHeader
                      visibleColumns={visibleColumns}
                      pinned
                      isGuest={isGuest}
                      handleCustomColumnSettings={handleCustomColumnSettings}
                    />
                  </div>
                ) : (
                  <div
                    className="sticky top-0 z-30 bg-[var(--tl-header-bg)] transition-colors duration-200"
                    style={{ minWidth: 'max-content' }}
                  >
                    <TaskListColumnHeaders
                      visibleColumns={visibleColumns}
                      overColumnId={overColumnId}
                      activeColumnId={activeColumnId}
                      columnSensors={columnSensors}
                      handleColumnDragStart={handleColumnDragStart}
                      handleColumnDragOver={handleColumnDragOver}
                      handleColumnDragEnd={handleColumnDragEnd}
                      handleCustomColumnSettings={handleCustomColumnSettings}
                      columnWidths={columnWidths}
                      setColumnWidths={setColumnWidths}
                      outerScrollRef={outerScrollRef}
                      contentScrollRef={contentScrollRef}
                      isBacklogMode={isBacklogMode}
                      isGuest={isGuest}
                    />
                  </div>
                )}
                <SortableContext items={sortableTaskIds} strategy={verticalListSortingStrategy}>
                  {scrollContainer && (
                    <GroupedVirtuoso
                      customScrollParent={scrollContainer}
                      {...TASK_LIST_VIRTUALIZATION}
                      components={
                        isBacklogMode ? BACKLOG_VIRTUOSO_COMPONENTS : TASK_LIST_VIRTUOSO_COMPONENTS
                      }
                      itemsRendered={scheduleListMeasurement}
                      groupCounts={virtuosoGroupCounts}
                      groupContent={groupIndex => {
                        const group = virtuosoGroups[groupIndex];
                        return (
                          <TaskListGroupRow
                            groupIndex={groupIndex}
                            group={group}
                            isCollapsed={collapsedGroups.has(group.id)}
                            onToggleCollapse={handleGroupCollapse}
                            isDropActive={activeId !== null && overGroupId === group.id}
                            isBacklogMode={isBacklogMode}
                            isActiveSprint={activeSprintGroupIds.has(group.id)}
                            visibleColumns={visibleColumns}
                            isDarkMode={isDarkMode}
                            hasNoTasks={hasNoTasks}
                            isGuest={isGuest}
                            isWorkReadOnly={isWorkReadOnly}
                            isSoftwareProject={isSoftwareProject}
                            currentGrouping={currentGrouping}
                            projectId={urlProjectId || ''}
                            canCreateTask={canCreateTask}
                            onTaskCreated={(task, groupId, openDrawer) =>
                              handleTaskCreated(task, groupId, openDrawer, null)
                            }
                          />
                        );
                      }}
                      itemContent={(index, groupIndex) => {
                        const item = virtuosoItems[index];
                        if (!item) return <div />;
                        const group = virtuosoGroups[groupIndex];

                        return (
                          <TaskListRowItem
                            key={item.id ?? `virtuoso-item-${index}`}
                            item={item}
                            index={index}
                            group={group}
                            projectId={urlProjectId || ''}
                            visibleColumns={visibleColumns}
                            isDarkMode={isDarkMode}
                            isBacklogMode={isBacklogMode}
                            activeSprintGroupIds={activeSprintGroupIds}
                            activeId={activeId}
                            overId={overId}
                            dropPosition={dropPosition}
                            canCreateTask={canCreateTask}
                            isWorkReadOnly={isWorkReadOnly}
                            isActiveAddRow={!!activeAddRowsByGroup[group.id]}
                            onActivateAddRow={handleActivateAddRow}
                            onDeactivateAddRow={handleDeactivateAddRow}
                            onTaskCreated={handleTaskCreated}
                            onSetInsertAnchor={anchor => {
                              setInsertAnchor(anchor);
                              setActiveAddRowsByGroup(prev => ({ ...prev, [group.id]: true }));
                            }}
                            updateTaskCustomColumnValue={updateTaskCustomColumnValue}
                          />
                        );
                      }}
                      style={{ minWidth: 'max-content' }}
                    />
                  )}
                </SortableContext>
              </div>
            </div>
          </div>

          <TaskListDragOverlay
            activeId={activeId}
            allTasks={allTasks}
            visibleColumns={visibleColumns}
          />

          {!isWorkReadOnly && (
            <TaskListBulkActionBar
              selectedTaskIds={selectedTaskIds}
              projectId={urlProjectId || ''}
              canCreateTask={canCreateTask}
              bulkActions={bulkActions}
            />
          )}

          <TaskListPortals
            isOpenConvertToSubtaskDrawer={isOpenConvertToSubtaskDrawer}
            isOpenDuplicateTaskModal={isOpenDuplicateTaskModal}
            onCloseDuplicateTaskModal={() => dispatch(setDuplicateTaskModalStatus(false))}
          />
        </div>
      </DndContext>
    </>
  );
};

const ProfiledTaskListV2Section = (props: TaskListV2SectionProps) => (
  <React.Profiler id="table" onRender={recordTaskListRender}>
    <TaskListV2Section {...props} />
  </React.Profiler>
);

export default isTaskListProfilingEnabled ? ProfiledTaskListV2Section : TaskListV2Section;
