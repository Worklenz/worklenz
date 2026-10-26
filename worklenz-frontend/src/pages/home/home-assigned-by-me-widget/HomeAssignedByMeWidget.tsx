import React, { useCallback, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  ExpandAltOutlined,
  PlusOutlined,
  Table,
  Tooltip,
  Typography,
  theme,
  type MenuProps,
  type TableProps,
} from '@/shared/antd-imports';
import AvatarGroup from '@/components/AvatarGroup';
import HomeTasksDatePicker from '@/components/home-tasks/taskDatePicker/home-tasks-date-picker';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useGetMyTasksQuery, useGetTaskFilterOptionsQuery } from '@/api/home-page/home-page.api.service';
import type { IHomeTasksConfig } from '@/types/home/home-page.types';
import type { IMyTask } from '@/types/home/my-tasks.types';
import HomeAddTaskModal from '../task-list/HomeAddTaskModal';
import { HomeWidgetCard, WidgetEmpty, WidgetError, WidgetLoading } from '../home-widgets/HomeWidgetCard';
import { useHomeWidget } from '../home-widgets/HomeWidgetContext';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { useOpenHomeTask } from '../home-widgets/useOpenHomeTask';
import { MAX_ROWS, useRowsViewport } from '../home-widgets/useRowsViewport';
import { WIDGET_DATA_ATTRIBUTE } from '../home-widgets/widgetInteraction';
// The same table styling as Today's Priorities (the `task-list-card` class below picks it up).
import '../task-list/tasks-list.css';

const MIN_ROWS = 3;
/** The table's rows are taller than the compact list's. */
const TABLE_ROW_HEIGHT = 45;
const TABLE_HEADER_HEIGHT = 29;
const LIST_ROW_HEIGHT = 55;
/** The full list, already narrowed to the tasks the user assigned (My Tasks > Assigned by me). */
const MY_TASKS_ASSIGNED_BY_ME_PATH = '/worklenz/home/my-tasks?filter=assigned-by-me';

type SortField = 'name' | 'project_name' | 'end_date';
interface SortState {
  field: SortField;
  order: 'asc' | 'desc';
}
/** Soonest due first; undated tasks last. */
const DEFAULT_SORT: SortState = { field: 'end_date', order: 'asc' };

// Always "assigned by me", whatever the priorities table on the same page is showing, so this is
// its own query rather than the shared `homeTasksConfig`.
const ASSIGNED_BY_ME_QUERY: IHomeTasksConfig = {
  current_tab: 'All',
  selected_date: null,
  tasks_group_by: 1,
  current_view: 0,
  is_calendar_view: false,
  time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  index: 1,
  size: MAX_ROWS,
  sortField: DEFAULT_SORT.field,
  sortOrder: DEFAULT_SORT.order,
};

/**
 * Tasks the user has handed to others, so they can follow up. In the main area it is a table in
 * the style of Today's Priorities: task, assignee, project and due date on one row, with the same
 * project filter (and an assignee one) and sortable headings. In the narrow side panel it is the
 * compact two-line list. Ten rows show; the rest (up to 50) scroll, and View all opens them all.
 */
export const HomeAssignedByMeWidget: React.FC = () => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const openTask = useOpenHomeTask();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isWide = useHomeWidget()?.column === 'main';
  const [isCreating, setIsCreating] = useState(false);

  // Filters and sorting only apply to the table; the compact list is always soonest-due-first.
  const [projectIds, setProjectIds] = useState<React.Key[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<React.Key[]>([]);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const hasFilters = isWide && (projectIds.length > 0 || assigneeIds.length > 0);

  const queryArg = useMemo<IHomeTasksConfig>(
    () =>
      isWide
        ? {
            ...ASSIGNED_BY_ME_QUERY,
            projectIds: projectIds.length ? (projectIds as string[]) : undefined,
            assigneeIds: assigneeIds.length ? (assigneeIds as string[]) : undefined,
            sortField: sort.field,
            sortOrder: sort.order,
          }
        : ASSIGNED_BY_ME_QUERY,
    [isWide, projectIds, assigneeIds, sort]
  );
  const { data, isLoading, isError, refetch } = useGetMyTasksQuery(queryArg, { refetchOnMountOrArgChange: 30 });
  // The options the filter menus offer, scoped to the tasks the user assigned.
  const { data: filterOptionsData } = useGetTaskFilterOptionsQuery({ group_by: 1 }, { skip: !isWide });

  const tasks = useMemo(() => data?.body?.tasks ?? [], [data?.body?.tasks]);
  const total = data?.body?.total ?? 0;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const viewportLimits = useRowsViewport(scrollerRef, tasks.length, {
    rowSelector: isWide ? 'tbody > tr.ant-table-row' : '.home-widget-row',
    headerSelector: isWide ? 'thead' : undefined,
    minRows: MIN_ROWS,
    fallbackRowHeight: isWide ? TABLE_ROW_HEIGHT : LIST_ROW_HEIGHT,
    fallbackHeaderHeight: TABLE_HEADER_HEIGHT,
  });

  const openCreate = useCallback(() => setIsCreating(true), []);
  const menuItems = useMemo<MenuProps['items']>(
    () => [
      {
        key: 'assign',
        icon: <PlusOutlined aria-hidden />,
        label: t('assignedByMe.assignNewTask', { defaultValue: 'Assign new task' }),
        onClick: openCreate,
      },
    ],
    [openCreate, t]
  );

  const projectFilterOptions = useMemo(
    () =>
      (filterOptionsData?.body?.projects ?? []).map(p => ({
        text: decodeHtmlEntities(p.project_name),
        value: p.project_id,
      })),
    [filterOptionsData?.body?.projects]
  );
  const assigneeFilterOptions = useMemo(
    () =>
      (filterOptionsData?.body?.assignees ?? []).map(a => ({
        text: a.name || a.team_member_id || '',
        value: a.team_member_id,
      })),
    [filterOptionsData?.body?.assignees]
  );

  const sortOrderOf = (field: SortField) =>
    sort.field === field ? (sort.order === 'asc' ? ('ascend' as const) : ('descend' as const)) : null;

  const columns = useMemo<TableProps<IMyTask>['columns']>(
    () => [
      {
        key: 'name',
        title: t('tasks.name', { defaultValue: 'Task Name' }),
        width: '32%',
        sorter: true,
        sortOrder: sortOrderOf('name'),
        render: (_, record) => (
          <div
            className="task-name-cell"
            onClick={() => openTask(record.id ?? '', record.project_id ?? '')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <Typography.Text ellipsis style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
              {decodeHtmlEntities(record.name)}
            </Typography.Text>
            <div className="row-action-button">
              <Tooltip title={t('myTasksView.openTask', { defaultValue: 'Open task' })} placement="right">
                <ExpandAltOutlined style={{ fontSize: 18, color: token.colorTextSecondary }} />
              </Tooltip>
            </div>
          </div>
        ),
      },
      {
        key: 'assignee',
        title: t('myTasksView.columnAssignee', { defaultValue: 'Assignee' }),
        width: '23%',
        filters: assigneeFilterOptions,
        filteredValue: assigneeIds,
        render: (_, record) => <Assignees task={record} isDarkMode={themeMode === 'dark'} />,
      },
      {
        key: 'project',
        title: t('tasks.project', { defaultValue: 'Project' }),
        width: '23%',
        sorter: true,
        sortOrder: sortOrderOf('project_name'),
        filters: projectFilterOptions,
        filteredValue: projectIds,
        render: (_, record) => (
          <Typography.Paragraph
            ellipsis={{ rows: 1, tooltip: false }}
            onClick={() =>
              record.project_id && navigate(`/worklenz/projects/${record.project_id}?tab=tasks-list&pinned_tab=tasks-list`)
            }
            style={{ margin: 0, paddingInlineEnd: 6, cursor: 'pointer' }}
          >
            <Badge color={record.project_color || 'blue'} style={{ marginInlineEnd: 4 }} />
            {decodeHtmlEntities(record.project_name)}
          </Typography.Paragraph>
        ),
      },
      {
        key: 'dueDate',
        title: t('tasks.dueDate', { defaultValue: 'Due Date' }),
        // The date picker needs this much, however narrow the rest gets: a percentage would push it out of its cell.
        width: 140,
        dataIndex: 'end_date',
        sorter: true,
        sortOrder: sortOrderOf('end_date'),
        render: (_, record) => <HomeTasksDatePicker record={record} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, token, openTask, navigate, themeMode, assigneeFilterOptions, projectFilterOptions, assigneeIds, projectIds, sort]
  );

  const handleTableChange: TableProps<IMyTask>['onChange'] = (_pagination, filters, sorter) => {
    setProjectIds((filters.project as React.Key[]) || []);
    setAssigneeIds((filters.assignee as React.Key[]) || []);
    const next = Array.isArray(sorter) ? sorter[0] : sorter;
    const field = next?.columnKey === 'name' ? 'name' : next?.columnKey === 'project' ? 'project_name' : next?.columnKey === 'dueDate' ? 'end_date' : null;
    // Clearing a sort goes back to soonest-due-first rather than to no order at all.
    setSort(field && next.order ? { field, order: next.order === 'ascend' ? 'asc' : 'desc' } : DEFAULT_SORT);
  };

  return (
    <HomeWidgetCard
      title={t('customize.widgets.assignedByMe', { defaultValue: 'Tasks assigned by me' })}
      menuItems={menuItems}
    >
      {isLoading && <WidgetLoading />}
      {isError && !data && <WidgetError onRetry={refetch} />}
      {data &&
        (tasks.length === 0 && !hasFilters ? (
          <WidgetEmpty
            text={t('assignedByMe.empty', { defaultValue: "You haven't assigned any open tasks." })}
            action={
              <Button size="small" icon={<PlusOutlined aria-hidden />} onClick={openCreate}>
                {t('assignedByMe.assignNewTask', { defaultValue: 'Assign new task' })}
              </Button>
            }
          />
        ) : (
          <div className="task-list-card" style={{ '--sticky-header-bg': token.colorBgContainer } as React.CSSProperties}>
            <div
              ref={scrollerRef}
              {...{ [WIDGET_DATA_ATTRIBUTE]: '' }}
              style={{
                // Ten rows tall at most, then it scrolls; never shorter than a few rows. Never
                // sideways: the table's columns share the width instead of overflowing it.
                maxHeight: viewportLimits?.max,
                minHeight: viewportLimits?.min,
                overflowY: 'auto',
                overflowX: 'hidden',
                position: 'relative',
              }}
            >
              {isWide ? (
                <Table
                  dataSource={tasks}
                  rowKey={record => record.id || ''}
                  columns={columns}
                  size="middle"
                  rowClassName={() => 'custom-row-height'}
                  pagination={false}
                  tableLayout="fixed"
                  onChange={handleTableChange}
                  locale={{ emptyText: t('tasks.noTasks', { defaultValue: 'No tasks found' }) }}
                />
              ) : (
                tasks.map(task => (
                  <button
                    key={task.id}
                    type="button"
                    className="home-widget-row"
                    onClick={() => openTask(task.id ?? '', task.project_id ?? '')}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        marginTop: 6,
                        flexShrink: 0,
                        borderRadius: '50%',
                        background: task.project_color || token.colorTextQuaternary,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text ellipsis style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>
                        {decodeHtmlEntities(task.name)}
                      </Typography.Text>
                      <Typography.Text ellipsis style={{ display: 'block', fontSize: 12, color: token.colorTextSecondary }}>
                        {decodeHtmlEntities(task.project_name)}
                      </Typography.Text>
                    </span>
                    <DueDate task={task} />
                  </button>
                ))
              )}
            </div>
            {/* Past the rows shown, the rest of the list is on My Tasks, already on Assigned by me. */}
            <div {...{ [WIDGET_DATA_ATTRIBUTE]: '' }} style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="link" size="small" onClick={() => navigate(MY_TASKS_ASSIGNED_BY_ME_PATH)}>
                {t('assignedByMe.viewAll', { defaultValue: 'View all assigned tasks ({{total}})', total })}
              </Button>
            </div>
          </div>
        ))}

      <HomeAddTaskModal
        open={isCreating}
        defaultDate={null}
        onClose={() => setIsCreating(false)}
        onTaskCreated={() => refetch()}
      />
    </HomeWidgetCard>
  );
};

interface AssigneeMember {
  team_member_id?: string;
  name?: string;
  avatar_url?: string;
  color_code?: string;
}

/** Who the task was given to: their avatars, and the name when there is just one. */
const Assignees: React.FC<{ task: IMyTask; isDarkMode: boolean }> = ({ task, isDarkMode }) => {
  const { token } = theme.useToken();
  const members = (task.assignees?.length ? task.assignees : (task.names ?? [])) as AssigneeMember[];
  if (members.length === 0) return <span style={{ color: token.colorTextQuaternary }}>—</span>;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <AvatarGroup members={members} maxCount={3} size={24} isDarkMode={isDarkMode} />
      {members.length === 1 && (
        <Typography.Text ellipsis style={{ fontSize: 12, color: token.colorTextSecondary, minWidth: 0 }}>
          {members[0].name}
        </Typography.Text>
      )}
    </span>
  );
};

/** The due date of the compact list, in the error color once it has passed. Nothing for no date. */
const DueDate: React.FC<{ task: IMyTask }> = ({ task }) => {
  const { token } = theme.useToken();
  if (!task.end_date) return null;
  const due = dayjs(task.end_date);
  const isOverdue = due.isBefore(dayjs(), 'day');
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 12,
        whiteSpace: 'nowrap',
        color: isOverdue ? token.colorError : token.colorTextSecondary,
      }}
    >
      {due.format('MMM D')}
    </span>
  );
};

export default HomeAssignedByMeWidget;
