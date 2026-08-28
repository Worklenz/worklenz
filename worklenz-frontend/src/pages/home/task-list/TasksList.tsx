import { ExpandAltOutlined } from '@/shared/antd-imports';
import SortArrows from '@/components/SortArrows';
import {
  Badge,
  Button,
  Card,
  Flex,
  Table,
  TableProps,
  Tooltip,
  Typography,
  Pagination,
  theme,
  PlusOutlined,
} from '@/shared/antd-imports';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDebouncedMediaQuery } from '@/hooks/useDebouncedMediaQuery';

import ListView from './ListView';
import HomeAddTaskModal from './HomeAddTaskModal';
import PillToggle from '../PillToggle';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import EmptyListPlaceholder from '@components/EmptyListPlaceholder';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import { IMyTask } from '@/types/home/my-tasks.types';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
  setNavigationContext,
} from '@/features/task-drawer/task-drawer.slice';
import homePageApi, { useGetMyTasksQuery, useGetTaskFilterOptionsQuery } from '@/api/home-page/home-page.api.service';
import './tasks-list.css';
import HomeTasksStatusDropdown from '@/components/home-tasks/statusDropdown/HomeTasksStatusDropdown';
import HomeTasksDatePicker from '@/components/home-tasks/taskDatePicker/home-tasks-date-picker';
import TaskTimeTracking from '@/components/task-list-v2/TaskTimeTracking';
import { useTimerInitialization } from '@/hooks/useTimerInitialization';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { setProjectId } from '@/features/project/project.slice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';

interface TasksListProps {
  cardTitle?: string;
}

type SortField = 'name' | 'project_name' | 'end_date' | 'priority' | null;

const TasksList: React.FC<TasksListProps> = React.memo(({ cardTitle }) => {
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const navigate = useNavigate();

  // Seeds redux with any timer already running elsewhere, same as project view —
  // without this the timer button below would show "not started" until a socket event arrives.
  useTimerInitialization();

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedProjectIds, setSelectedProjectIds] = useState<React.Key[]>([]);
  const [selectedPriorityIds, setSelectedPriorityIds] = useState<React.Key[]>([]);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);

  // Reset to page 1 whenever the active tab, group_by, filters, or sort
  // change. Adjusted during render (React's documented pattern) rather than
  // in a useEffect: an effect would let queryArg below fire one request with
  // the stale page and a second, corrected one right after. Comparing
  // against a ref and calling setCurrentPage synchronously here means the
  // page is already 1 by the time queryArg is computed in this same render.
  const filtersSignature = JSON.stringify([
    homeTasksConfig.current_tab, homeTasksConfig.tasks_group_by,
    selectedProjectIds, selectedPriorityIds, sortField, sortOrder,
  ]);
  const prevFiltersSignatureRef = useRef(filtersSignature);
  if (prevFiltersSignatureRef.current !== filtersSignature) {
    prevFiltersSignatureRef.current = filtersSignature;
    if (currentPage !== 1) setCurrentPage(1);
  }

  // Pagination/filter/sort stay local to this component rather than being
  // written into the shared homeTasksConfig slice — HomeStatCards also reads
  // tasks_group_by off that same slice, and mutating its shape risks
  // rippling into that unrelated consumer.
  const queryArg = useMemo(() => ({
    ...homeTasksConfig,
    index: currentPage,
    size: pageSize,
    projectIds: selectedProjectIds.length ? (selectedProjectIds as string[]) : undefined,
    priorityIds: selectedPriorityIds.length ? (selectedPriorityIds as string[]) : undefined,
    sortField: sortField || undefined,
    sortOrder,
  }), [homeTasksConfig, currentPage, pageSize, selectedProjectIds, selectedPriorityIds, sortField, sortOrder]);

  const {
    data,
    isFetching: homeTasksFetching,
    refetch: originalRefetch,
    isLoading,
  } = useGetMyTasksQuery(queryArg, {
    refetchOnMountOrArgChange: true,
    refetchOnReconnect: false,
    refetchOnFocus: false,
  });

  const { t, ready } = useTranslation('home');
  const { priorities } = useAppSelector(state => state.priorityReducer);
  const isMobile = useDebouncedMediaQuery({ query: '(max-width: 768px)' });

  // Filter dropdown options — scoped to the current group_by (not just
  // whatever's on the current page/tab), same endpoint HomeMyTasksView uses.
  const { data: filterOptionsData } = useGetTaskFilterOptionsQuery({ group_by: homeTasksConfig.tasks_group_by });

  const projectFilterOptions = useMemo(
    () => (filterOptionsData?.body?.projects || []).map(p => ({ text: p.project_name, value: p.project_id })),
    [filterOptionsData?.body?.projects]
  );

  const priorityFilterOptions = useMemo(
    () => priorities.map(p => ({ text: p.name, value: p.id || '' })),
    [priorities]
  );

  // Server-filtered, server-sorted, server-paginated already — this is
  // exactly the page of rows to render, no client-side work needed.
  const tasks: IMyTask[] = data?.body?.tasks || [];
  const totalCount = data?.body?.total ?? 0;

  useEffect(() => {
    dispatch(fetchLabels());
    dispatch(fetchPriorities());
    dispatch(
      getTeamMembers({ index: 0, size: 100, field: null, order: null, search: null, all: true })
    );
  }, [dispatch]);

  const handleSelectTask = useCallback(
    (task: IMyTask) => {
      // Prev/next navigation in the task drawer is scoped to the currently
      // loaded page (server-paginated — the full tab's task list no longer
      // exists client-side).
      const allTaskIds = tasks.map(t => t.id || '').filter(Boolean);
      const currentIndex = allTaskIds.indexOf(task.id || '');

      dispatch(
        setNavigationContext({
          taskIds: allTaskIds,
          currentIndex: currentIndex >= 0 ? currentIndex : 0,
          sourceView: 'home',
          projectId: task.project_id || null,
        })
      );

      dispatch(setSelectedTaskId(task.id || ''));
      dispatch(fetchTask({ taskId: task.id || '', projectId: task.project_id || '' }));
      dispatch(setProjectId(task.project_id || ''));
      dispatch(setShowTaskDrawer(true));
      // Deliberately NOT writing anything into homeTasksConfig here — that
      // object feeds useGetMyTasksQuery, so any change to it (even an
      // unused field like the old `selected_task_id`) forces the whole
      // table to refetch on every task click. The drawer already receives
      // the id via setSelectedTaskId above.
    },
    [dispatch, tasks]
  );

  const refetch = useCallback(() => {
    originalRefetch();
    dispatch(homePageApi.util.invalidateTags(['taskCounts']));
  }, [originalRefetch, dispatch]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Clicking a sortable header cycles asc -> desc for that column; clicking a
  // different column switches to it starting at asc.
  const handleSortClick = useCallback(
    (field: SortField) => {
      setCurrentPage(1);
      setSortOrder(prev => (sortField === field && prev === 'asc' ? 'desc' : 'asc'));
      setSortField(field);
    },
    [sortField]
  );

  const renderSortableTitle = useCallback(
    (label: string, field: SortField) => (
      <span
        onClick={() => handleSortClick(field)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span>{label}</span>
        <SortArrows active={sortField === field ? sortOrder : null} />
      </span>
    ),
    [sortField, sortOrder, handleSortClick]
  );

  const columns: TableProps<IMyTask>['columns'] = useMemo(
    () => [
      {
        key: 'name',
        title: renderSortableTitle(t('tasks.name', { defaultValue: 'Task Name' }), 'name'),
        width: isMobile ? '26%' : '28%',
        render: (_, record) => (
          <div
            onClick={() => handleSelectTask(record)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <Typography.Text ellipsis style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
              {record.name}
            </Typography.Text>
            <div className="row-action-button">
              {/* No custom `color`/`styles` override — antd's default Tooltip
                  background already contrasts correctly in both themes. The
                  previous `color={token.colorBgElevated}` resolved to white
                  in light mode (same as the page), so the tooltip had no
                  visible separation there; it only looked right in dark
                  mode because a global `.dark .ant-tooltip-inner` CSS rule
                  elsewhere in the app happened to override it back to a
                  proper dark background. */}
              <Tooltip title={t('myTasksView.openTask', { defaultValue: 'Open task' })} placement="right">
                <ExpandAltOutlined
                  style={{ fontSize: 18, color: token.colorTextSecondary }}
                />
              </Tooltip>
            </div>
          </div>
        ),
      },
      {
        key: 'project',
        title: renderSortableTitle(t('tasks.project', { defaultValue: 'Project' }), 'project_name'),
        width: isMobile ? '20%' : '18%',
        filters: projectFilterOptions,
        filteredValue: selectedProjectIds,
        render: (_, record) => (
          <Typography.Paragraph
            ellipsis={{ rows: 1, tooltip: false }}
            onClick={() => record.project_id && navigate(`/worklenz/projects/${record.project_id}?tab=tasks-list&pinned_tab=tasks-list`)}
            style={{ margin: 0, paddingInlineEnd: 6, cursor: 'pointer' }}
          >
            <Badge color={record.project_color || 'blue'} style={{ marginInlineEnd: 4 }} />
            {record.project_name}
          </Typography.Paragraph>
        ),
      },
      {
        key: 'status',
        title: t('tasks.status', { defaultValue: 'Status' }),
        width: '16%',
        render: (_, record) => (
          <HomeTasksStatusDropdown task={record} teamId={record.team_id || ''} />
        ),
      },
      {
        key: 'dueDate',
        title: renderSortableTitle(t('tasks.dueDate', { defaultValue: 'Due Date' }), 'end_date'),
        width: '14%',
        dataIndex: 'end_date',
        render: (_, record) => <HomeTasksDatePicker record={record} />,
      },
      {
        key: 'priority',
        title: renderSortableTitle(t('tasks.priority', { defaultValue: 'Priority' }), 'priority'),
        width: '12%',
        filters: priorityFilterOptions,
        filteredValue: selectedPriorityIds,
        render: (_, record) => {
          if (!record.priority_name) return <span style={{ color: 'var(--ant-color-text-quaternary)' }}>—</span>;
          return (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 400,
                background: (themeMode === 'dark' ? record.priority_color_dark : record.priority_color) ?? record.priority_color ?? 'transparent',
                color: '#fff',
              }}
            >
              {record.priority_name}
            </span>
          );
        },
      },
      {
        key: 'timeTracking',
        title: t('tasks.time', { defaultValue: 'Time' }),
        width: '12%',
        render: (_, record) => (
          <TaskTimeTracking taskId={record.id || ''} isDarkMode={themeMode === 'dark'} />
        ),
      },
    ],
    [t, currentPage, pageSize, handleSelectTask, isMobile, themeMode, renderSortableTitle, projectFilterOptions, priorityFilterOptions, selectedProjectIds, selectedPriorityIds]
  );

  const handleTaskModeChange = (value: number) => {
    dispatch(setHomeTasksConfig({ ...homeTasksConfig, tasks_group_by: value }));
    setCurrentPage(1);
  };

  return (
    <Card
      className="task-list-card"
      style={
        {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 10,
          border: `1px solid ${token.colorBorderSecondary}`,
          // Real, theme-aware background for the sticky table header (see
          // tasks-list.css) — `--ant-color-bg-container` isn't actually
          // defined anywhere in this app (antd's CSS-variable mode isn't
          // enabled), so that reference always silently resolved to nothing.
          '--sticky-header-bg': token.colorBgContainer,
        } as React.CSSProperties
      }
      styles={{
        body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '20px' },
      }}
    >
      {/* Header — matches HomeProgressDonut's plain title styling */}
      <div
        className="task-list-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>{cardTitle || t('tasks.tasks', { defaultValue: 'Tasks' })}</div>
        <Flex gap={8} align="center" className="task-list-mobile-controls">
          <PillToggle<'to' | 'by'>
            value={homeTasksConfig.tasks_group_by === 1 ? 'by' : 'to'}
            onChange={v => handleTaskModeChange(v === 'by' ? 1 : 0)}
             options={[
               { value: 'to', label: ready ? t('tasks.assignedToMe', { defaultValue: 'Assigned to me' }) : 'Assigned to me' },
               { value: 'by', label: ready ? t('tasks.assignedByMe', { defaultValue: 'Assigned by me' }) : 'Assigned by me' },
             ]}
          />
        </Flex>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {!data?.body || isLoading ? (
          // Absolutely positioned so it always covers the full height of this
          // panel (fixed to the card's bottom edge) instead of a flex:1 box
          // that has to compete with the tabs below it for space in a
          // scrolling flex column — that combination let the loader collapse
          // to its min-height instead of filling down to the bottom.
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <WorklenzLogoLoader />
          </div>
        ) : (
          <>
            {/* Tabs stay fixed above the scroll area — only the table body below scrolls */}
            <div style={{ flexShrink: 0, marginBottom: 12 }}>
              <ListView refetch={refetch} />
            </div>

            {/* task list table — render with different filters and views */}
            {totalCount === 0 && !homeTasksFetching ? (
              // Guard with !homeTasksFetching to avoid flashing the empty state
              // while the new tab response is still in-flight
              <EmptyListPlaceholder
                imageSrc="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
                text={t('tasks.noTasks', { defaultValue: 'No tasks found' })}
                action={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddTaskOpen(true)}>
                    {t('tasks.addTaskButton', { defaultValue: 'Add Task' })}
                  </Button>
                }
              />
            ) : (
              <>
                {/* Only this panel scrolls — header row stays stuck to its top via plain
                    CSS `position: sticky` on the header cells (see tasks-list.css); antd's
                    own `sticky` prop kept losing track of this custom scroll container. */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
                  {/* dataSource is never blanked on `homeTasksFetching` — that flag is also
                      true for background revalidations (e.g. a status change echoed back
                      over the socket), and clearing rows + covering the table for those
                      read as a full table reload for what's really a single-cell update.
                      antd's rowKey-based reconciliation already updates just the changed
                      cell in place once fresh data lands. */}
                  <Table
                    dataSource={tasks}
                    rowKey={record => record.id || ''}
                    columns={columns as TableProps<IMyTask>['columns']}
                    size="middle"
                    rowClassName={() => 'custom-row-height'}
                    pagination={false}
                    tableLayout="fixed"
                    onChange={(_pagination, filters) => {
                      setCurrentPage(1);
                      setSelectedProjectIds((filters.project as React.Key[]) || []);
                      setSelectedPriorityIds((filters.priority as React.Key[]) || []);
                    }}
                  />
                </div>

                {/* Only render pagination when the set has more tasks than one
                    page can show — not gated on `homeTasksFetching` (see note above). */}
                {totalCount > pageSize && (
                  <div
                    style={{
                      flexShrink: 0,
                      marginTop: 16,
                      textAlign: 'right',
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <Pagination
                      current={currentPage}
                      pageSize={pageSize}
                      total={totalCount}
                      onChange={handlePageChange}
                      showSizeChanger={false}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <HomeAddTaskModal
        open={addTaskOpen}
        defaultDate={null}
        onClose={() => setAddTaskOpen(false)}
        onTaskCreated={() => refetch()}
      />
    </Card>
  );
});

export default TasksList;
