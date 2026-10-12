import {
  Badge,
  Button,
  Card,
  ExpandAltOutlined,
  Flex,
  message,
  PushpinFilled,
  PushpinOutlined,
  Table,
  TableProps,
  Tooltip,
  Typography,
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
import { TaskTableSettingsMenu } from './TaskTableSettings';
import { WIDGET_DATA_ATTRIBUTE } from '../home-widgets/widgetInteraction';
import { MAX_ROWS, useRowsViewport } from '../home-widgets/useRowsViewport';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import EmptyListPlaceholder from '@components/EmptyListPlaceholder';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import { selectHomeSort, type HomeSortField } from '@/features/home-page/homePreferences.slice';
import { IMyTask } from '@/types/home/my-tasks.types';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
  setNavigationContext,
} from '@/features/task-drawer/task-drawer.slice';
import homePageApi, {
  applyPinToCachedTasks,
  useGetMyTasksQuery,
  useGetTaskFilterOptionsQuery,
  usePinHomeTaskMutation,
  useUnpinHomeTaskMutation,
} from '@/api/home-page/home-page.api.service';
import './tasks-list.css';
import HomeTasksStatusDropdown from '@/components/home-tasks/statusDropdown/HomeTasksStatusDropdown';
import HomeTasksDatePicker from '@/components/home-tasks/taskDatePicker/home-tasks-date-picker';
import TaskTimeTracking from '@/components/task-list-v2/TaskTimeTracking';
import { useTimerInitialization } from '@/hooks/useTimerInitialization';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { setProjectId } from '@/features/project/project.slice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';

/** However few tasks there are, the table area keeps room for this many rows. */
const MIN_ROWS = 5;
const FALLBACK_ROW_HEIGHT = 45;
const FALLBACK_HEADER_HEIGHT = 29;
/** Room kept for the loading and empty states, which have no rows to size the area by. */
const MIN_BODY_HEIGHT = 280;
const MY_TASKS_PATH = '/worklenz/home/my-tasks';

interface TasksListProps {
  cardTitle?: string;
}

type SortField = HomeSortField | null;

const TasksList: React.FC<TasksListProps> = React.memo(({ cardTitle }) => {
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const navigate = useNavigate();

  // Seeds redux with any timer already running elsewhere, same as project view —
  // without this the timer button below would show "not started" until a socket event arrives.
  useTimerInitialization();

  const [selectedProjectIds, setSelectedProjectIds] = useState<React.Key[]>([]);
  const [selectedPriorityIds, setSelectedPriorityIds] = useState<React.Key[]>([]);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const savedSort = useAppSelector(selectHomeSort);
  const sortField: SortField = savedSort?.field ?? null;
  const sortOrder = savedSort?.order ?? 'asc';
  const isPinnedTab = homeTasksConfig.current_tab === 'Pinned';

  // Filter/sort stay local to this component rather than being written into the shared
  // homeTasksConfig slice — HomeStatCards also reads tasks_group_by off that same slice, and
  // mutating its shape risks rippling into that unrelated consumer. There is one page only: the
  // first MAX_ROWS tasks, scrolled inside the table, with View all for the rest.
  const queryArg = useMemo(() => ({
    ...homeTasksConfig,
    index: 1,
    size: MAX_ROWS,
    pinFirst: true,
    projectIds: selectedProjectIds.length ? (selectedProjectIds as string[]) : undefined,
    priorityIds: selectedPriorityIds.length ? (selectedPriorityIds as string[]) : undefined,
    sortField: sortField || undefined,
    sortOrder,
  }), [homeTasksConfig, selectedProjectIds, selectedPriorityIds, sortField, sortOrder]);

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

  // Server-filtered, server-sorted and limited to MAX_ROWS already — these are
  // exactly the rows to render, no client-side work needed. The
  // server also puts the user's pinned tasks first within each tab (and the
  // Pinned tab lists only them), so the order here is final.
  const tasks: IMyTask[] = useMemo(() => data?.body?.tasks || [], [data?.body?.tasks]);
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
      // Prev/next navigation in the task drawer is scoped to the rows loaded
      // here (the full tab's task list doesn't exist client-side).
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

  const [pinTask] = usePinHomeTaskMutation();
  const [unpinTask] = useUnpinHomeTaskMutation();

  // The pin icon flips at once (optimistic); the list is then refetched so the task moves to its
  // real place across all pages. If the request fails the icon is put back.
  const handleTogglePin = useCallback(
    async (task: IMyTask) => {
      const taskId = task.id;
      if (!taskId) return;
      const willPin = !task.is_pinned;

      const undo = dispatch((d, getState) => applyPinToCachedTasks(d, getState, taskId, willPin));
      const result = await (willPin ? pinTask(taskId) : unpinTask(taskId));
      if (!('error' in result)) return;

      undo();
      const body = (result.error as { data?: { body?: { code?: string; limit?: number } | null } }).data?.body;
      if (willPin && body?.code === 'PIN_LIMIT_REACHED') {
        message.warning(
          t('tasks.pinLimitReached', {
            defaultValue: 'You can pin up to {{limit}} tasks. Unpin one to pin another.',
            limit: body.limit ?? 25,
          })
        );
      } else {
        message.error(t('tasks.pinFailed', { defaultValue: "Couldn't update the pin. Please try again." }));
      }
      // The task may have changed since the list loaded (completed, unassigned): show what is true now.
      refetch();
    },
    [dispatch, pinTask, unpinTask, refetch, t]
  );

  const columns: TableProps<IMyTask>['columns'] = useMemo(
    () => [
      {
        key: 'name',
        title: t('tasks.name', { defaultValue: 'Task Name' }),
        width: isMobile ? '30%' : '32%',
        render: (_, record) => (
          <div
            className="task-name-cell"
            onClick={() => handleSelectTask(record)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            {/* The pin sits before the name. It always takes up its space so rows don't shift, but
                stays invisible until the name cell is hovered or the button is focused; a pinned
                row keeps its filled pin visible as the persistent indicator. */}
            <div
              className={
                record.is_pinned === true ? 'row-pin-button row-pin-button--active' : 'row-pin-button'
              }
              style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: 4 }}
            >
              <Tooltip
                title={
                  record.is_pinned === true
                    ? t('tasks.unpinTask', { defaultValue: 'Unpin task' })
                    : t('tasks.pinTask', { defaultValue: 'Pin task' })
                }
                placement="top"
              >
                <Button
                  type="text"
                  size="small"
                  aria-pressed={record.is_pinned === true}
                  aria-label={
                    record.is_pinned === true
                      ? t('tasks.unpinTask', { defaultValue: 'Unpin task' })
                      : t('tasks.pinTask', { defaultValue: 'Pin task' })
                  }
                  icon={
                    record.is_pinned === true ? (
                      <PushpinFilled style={{ fontSize: 14, color: token.colorPrimary }} />
                    ) : (
                      <PushpinOutlined style={{ fontSize: 14, color: token.colorTextSecondary }} />
                    )
                  }
                  onClick={event => {
                    // The cell itself opens the task drawer — pinning must not.
                    event.stopPropagation();
                    handleTogglePin(record);
                  }}
                />
              </Tooltip>
            </div>
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
        title: t('tasks.project', { defaultValue: 'Project' }),
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
        width: '10%',
        ellipsis: true,
        render: (_, record) => (
          <div style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
            <HomeTasksStatusDropdown task={record} teamId={record.team_id || ''} />
          </div>
        ),
      },
      {
        key: 'dueDate',
        title: t('tasks.dueDate', { defaultValue: 'Due Date' }),
        width: '14%',
        dataIndex: 'end_date',
        render: (_, record) => <HomeTasksDatePicker record={record} />,
      },
      {
        key: 'priority',
        title: t('tasks.priority', { defaultValue: 'Priority' }),
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
    [t, handleSelectTask, handleTogglePin, isMobile, themeMode, projectFilterOptions, priorityFilterOptions, selectedProjectIds, selectedPriorityIds]
  );

  // Stable, so the menu that holds it doesn't rebuild its items on every render of this table.
  const handleOpenCreateTask = useCallback(() => setAddTaskOpen(true), []);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const viewportLimits = useRowsViewport(scrollerRef, tasks.length, {
    rowSelector: 'tbody > tr.ant-table-row',
    headerSelector: 'thead',
    minRows: MIN_ROWS,
    fallbackRowHeight: FALLBACK_ROW_HEIGHT,
    fallbackHeaderHeight: FALLBACK_HEADER_HEIGHT,
  });

  const handleTaskModeChange = (value: number) => {
    dispatch(setHomeTasksConfig({ ...homeTasksConfig, tasks_group_by: value }));
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
          position: 'relative',
        }}
      >
        <div className="task-list-title" style={{ fontSize: 14, fontWeight: 600 }}>
          {cardTitle || t('tasks.tasks', { defaultValue: 'Tasks' })}
        </div>
        <Flex gap={8} align="center" className="task-list-mobile-controls">
          <PillToggle<'to' | 'by'>
            value={homeTasksConfig.tasks_group_by === 1 ? 'by' : 'to'}
            onChange={v => handleTaskModeChange(v === 'by' ? 1 : 0)}
             options={[
               { value: 'to', label: ready ? t('tasks.assignedToMe', { defaultValue: 'Assigned to me' }) : 'Assigned to me' },
               { value: 'by', label: ready ? t('tasks.assignedByMe', { defaultValue: 'Assigned by me' }) : 'Assigned by me' },
             ]}
          />
          {/* Sits after the toggle on a wide card; pinned to the card's corner on a narrow one (see tasks-list.css). */}
          <span className="task-list-menu">
            <TaskTableSettingsMenu onCreateTask={handleOpenCreateTask} />
          </span>
        </Flex>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: !data?.body || isLoading ? MIN_BODY_HEIGHT : 0,
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
            <div {...{ [WIDGET_DATA_ATTRIBUTE]: '' }} style={{ flexShrink: 0, marginBottom: 12 }}>
              <ListView refetch={refetch} />
            </div>

            {/* task list table — render with different filters and views */}
            {totalCount === 0 && !homeTasksFetching ? (
              // Guard with !homeTasksFetching to avoid flashing the empty state
              // while the new tab response is still in-flight
              <div style={{ minHeight: MIN_BODY_HEIGHT - 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyListPlaceholder
                imageSrc="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
                text={
                  isPinnedTab
                    ? t('tasks.noPinnedTasks', {
                        defaultValue:
                          'No pinned tasks yet. Hover over any task and click the pin icon to keep it here.',
                      })
                    : t('tasks.noTasks', { defaultValue: 'No tasks found' })
                }
                action={
                  isPinnedTab ? undefined : (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddTaskOpen(true)}>
                      {t('tasks.addTaskButton', { defaultValue: 'Add Task' })}
                    </Button>
                  )
                }
              />
              </div>
            ) : (
              <>
                {/* Only this panel scrolls — header row stays stuck to its top via plain
                    CSS `position: sticky` on the header cells (see tasks-list.css); antd's
                    own `sticky` prop kept losing track of this custom scroll container. */}
                <div
                  ref={scrollerRef}
                  {...{ [WIDGET_DATA_ATTRIBUTE]: '' }}
                  style={{
                    // Ten rows tall at most, then it scrolls (up to MAX_ROWS rows); never shorter
                    // than MIN_ROWS, so the card doesn't collapse around a short list. It does not
                    // stretch to its column, so adding a widget beside or below it changes nothing.
                    maxHeight: viewportLimits?.max,
                    minHeight: viewportLimits?.min,
                    overflowY: 'auto',
                    position: 'relative',
                  }}
                >
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
                      setSelectedProjectIds((filters.project as React.Key[]) || []);
                      setSelectedPriorityIds((filters.priority as React.Key[]) || []);
                    }}
                  />
                </div>

                {/* Past the rows shown, the rest of the list is on the My Tasks page. */}
                <div
                  {...{ [WIDGET_DATA_ATTRIBUTE]: '' }}
                  style={{ flexShrink: 0, marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}
                >
                  <Button type="link" size="small" onClick={() => navigate(MY_TASKS_PATH)}>
                    {t('tasks.viewAll', { defaultValue: 'View all ({{total}})', total: totalCount })}
                  </Button>
                </div>
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
