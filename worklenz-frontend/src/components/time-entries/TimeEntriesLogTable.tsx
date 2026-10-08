import React, { useCallback, useMemo } from 'react';
import {
  Table,
  TableProps,
  Badge,
  Button,
  theme,
  Tag,
  Tooltip,
  Popconfirm,
  Flex,
} from '@/shared/antd-imports';
import { ExpandAltOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import {
  IRecentTimeLog,
  ITimeEntriesStatusOption,
  ITimeLogMember,
  taskTimeLogsApiService,
} from '@/api/tasks/task-time-logs.api.service';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
  setNavigationContext,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { updateTask } from '@/features/task-management/task-management.slice';
import { Task } from '@/types/task-management.types';
import { TruncatedColoredTag } from '@/components/common/truncated-colored-tag/TruncatedColoredTag';
import TablePagination from '@/components/TablePagination';
import { SortArrows } from '@/components/common/SortArrows';
import { useFillRemainingHeight } from '@/hooks/useFillRemainingHeight';
import { formatLoggedDuration, formatLoggedOnDate, formatLoggedOnTooltip } from './time-entries-format';
import { TimeEntryMemberAvatars } from './TimeEntryMemberAvatars';
import { useCanEditTimeEntry } from './useCanEditTimeEntry';
import { EditTimeEntryModal } from './EditTimeEntryModal';
import '@/pages/time-entries/time-entries.css';

export type LogSortField =
  | 'project_name'
  | 'task_name'
  | 'priority_name'
  | 'status_name'
  | 'billable'
  | 'user_name'
  | 'time_spent'
  | 'created_at'
  | 'due_date'
  | null;

// Note: 'created_at' is already included in the sort options

// Column widths as relative weights. Without the Actions column each layout (with / without the
// Member column) adds up to exactly 100 - the old widths summed to 107-111%, so the browser
// squeezed the last column to make them fit, which wrapped its header onto two lines. Turning a
// column on or off re-normalises the weights (getColumnWidths) so the shown columns still total
// exactly 100%. Every weight leaves room for its header's label + sort arrows (+ the filter icon
// on Project/Status/Priority/Billable) down to the 1100px table floor in time-entries.css.
const COLUMN_WEIGHTS = {
  task: { withMember: 12, withoutMember: 21 },
  member: 10,
  project: { withMember: 11, withoutMember: 12 },
  status: 9.5,
  priority: 9.5,
  billable: 9.5,
  description: 9,
  time: 11,
  dueDate: 9,
  loggedOn: 9.5,
  actions: 7,
} as const;

interface ColumnWidths {
  task: string;
  member: string;
  project: string;
  status: string;
  priority: string;
  billable: string;
  description: string;
  time: string;
  dueDate: string;
  loggedOn: string;
  actions: string;
}

const getColumnWidths = (showMember: boolean, showActions: boolean): ColumnWidths => {
  const w = COLUMN_WEIGHTS;
  const task = showMember ? w.task.withMember : w.task.withoutMember;
  const project = showMember ? w.project.withMember : w.project.withoutMember;
  const total =
    task + (showMember ? w.member : 0) + project + w.status + w.priority + w.billable +
    w.description + w.time + w.dueDate + w.loggedOn + (showActions ? w.actions : 0);
  const pct = (weight: number) => `${((weight / total) * 100).toFixed(2)}%`;
  return {
    task: pct(task),
    member: pct(w.member),
    project: pct(project),
    status: pct(w.status),
    priority: pct(w.priority),
    billable: pct(w.billable),
    description: pct(w.description),
    time: pct(w.time),
    dueDate: pct(w.dueDate),
    loggedOn: pct(w.loggedOn),
    actions: pct(w.actions),
  };
};

// A "By task" row spans everyone who logged on the task (`members`); a flat row
// is one entry by one person (the `user_*` fields).
const getRowMembers = (record: IRecentTimeLog): ITimeLogMember[] =>
  record.members ?? [
    {
      user_id: record.user_id ?? '',
      user_name: record.user_name ?? null,
      avatar_url: record.avatar_url,
      color_code: record.user_color_code,
    },
  ];

interface TimeEntriesLogTableProps {
  logs: IRecentTimeLog[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  sortField: LogSortField;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: LogSortField) => void;
  onLogTime: () => void;
  /** Show a "Member" column identifying who logged each entry — only meaningful
   * once the viewer has switched to All scope (own-only rows never need it). */
  showAuthor?: boolean;
  /** Project options for the Project column's header filter — same list the
   * "Filters" panel's Project select uses, so both control the same state. */
  projectOptions: { id: string; name: string }[];
  selectedProjectIds: string[];
  onProjectFilterChange: (ids: string[]) => void;
  statusOptions: ITimeEntriesStatusOption[];
  selectedStatusNames: string[];
  onStatusFilterChange: (names: string[]) => void;
  selectedPriorityIds: string[];
  onPriorityFilterChange: (ids: string[]) => void;
  selectedBillableValues: string[];
  onBillableFilterChange: (values: string[]) => void;
  /** Called after an entry is edited or deleted so the page can refetch. `deleted` lets it step
   * back a page when the deletion emptied the current one. */
  onEntryChange: (change?: { deleted?: boolean }) => void;
  /** Show the hover Edit/Delete actions (and the edit dialog) on each row. Only for the Flat
   * view: a "By task" row sums several entries, so there is no single entry to edit. */
  allowEntryActions?: boolean;
}

export const TimeEntriesLogTable: React.FC<TimeEntriesLogTableProps> = ({
  logs,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  sortField,
  sortOrder,
  onSortChange,
  onLogTime,
  showAuthor,
  projectOptions,
  selectedProjectIds,
  onProjectFilterChange,
  statusOptions,
  selectedStatusNames,
  onStatusFilterChange,
  selectedPriorityIds,
  onPriorityFilterChange,
  selectedBillableValues,
  onBillableFilterChange,
  onEntryChange,
  allowEntryActions = false,
}) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { priorities } = useAppSelector(state => state.priorityReducer);

  React.useEffect(() => {
    dispatch(fetchPriorities());
  }, [dispatch]);

  const canEditEntry = useCanEditTimeEntry();
  const [editingRecord, setEditingRecord] = React.useState<IRecentTimeLog | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const showEntryActions = allowEntryActions;
  const widths = useMemo(
    () => getColumnWidths(!!showAuthor, showEntryActions),
    [showAuthor, showEntryActions]
  );

  // Leaving the Flat view (e.g. switching to "By task") closes any open edit dialog.
  React.useEffect(() => {
    if (!showEntryActions) setEditingRecord(null);
  }, [showEntryActions]);

  const handleDeleteEntry = useCallback(
    async (record: IRecentTimeLog) => {
      if (!record.id || !record.task_id) return;
      setDeletingId(record.id);
      try {
        const res = await taskTimeLogsApiService.deleteEntry(record.id, record.task_id);
        if (res.done) onEntryChange({ deleted: true });
      } catch {
        // The API client already toasted the reason (e.g. "You can only delete your own time entries.").
      } finally {
        setDeletingId(null);
      }
    },
    [onEntryChange]
  );

  const projectFilterOptions = useMemo(
    () => projectOptions.map(p => ({ text: p.name, value: p.id })),
    [projectOptions]
  );
  const statusFilterOptions = useMemo(
    () => statusOptions.map(s => ({ text: s.name, value: s.name.toLowerCase() })),
    [statusOptions]
  );
  const priorityFilterOptions = useMemo(
    () => priorities.map(p => ({ text: p.name || '', value: p.id || '' })),
    [priorities]
  );
  const billableFilterOptions = useMemo(
    () => [
      { text: t('billableYes', { defaultValue: 'Yes' }), value: 'true' },
      { text: t('billableNo', { defaultValue: 'No' }), value: 'false' },
    ],
    [t]
  );

  // Measured, not guessed: how much vertical space is actually left for the
  // table once the pagination bar below it has claimed its own — but instead
  // of measuring the whole card and subtracting a separately-measured
  // pagination height in JS (two independent reads that can drift out of
  // sync for a frame, e.g. while the pagination bar is still settling its
  // own size), this wrapper's height IS that leftover space: it's a flex
  // sibling of the pagination bar with `flex: 1 1 auto; min-height: 200px`,
  // so the browser's own flex layout does the subtraction, exactly and
  // synchronously, before we ever read from it. What's left to compute in
  // JS is only the one thing flexbox can't do for us — AntD's Table splits
  // its header and body into separate elements, so `scroll.y` still needs
  // this wrapper's height minus the header's own height as a real pixel
  // number, matching the Recurring Tasks table's intent
  // (components/recurring-tasks/RecurringTasksTable.tsx).
  const { containerRef: tableAreaRef, height: tableAreaHeight } = useFillRemainingHeight<HTMLDivElement>(
    200,
    [loading, logs.length, total]
  );
  const [scrollY, setScrollY] = React.useState(300);

  React.useLayoutEffect(() => {
    const headerEl = tableAreaRef.current?.querySelector<HTMLElement>('.ant-table-thead');
    const headerHeight = headerEl?.getBoundingClientRect().height ?? 0;
    setScrollY(Math.max(150, Math.round(tableAreaHeight - headerHeight)));
  }, [tableAreaHeight, tableAreaRef, logs.length]);

  const handleOpenTask = useCallback(
    (record: IRecentTimeLog) => {
      if (!record.task_id) return;
      const allTaskIds = Array.from(new Set(logs.map(l => l.task_id).filter(Boolean)));
      const currentIndex = allTaskIds.indexOf(record.task_id);

      // Pre-populate Redux with available task data to prevent loading flash
      dispatch(updateTask({
        id: record.task_id,
        title: record.task_name,
        projectId: record.project_id,
      } as Partial<Task> as Task));

      dispatch(
        setNavigationContext({
          taskIds: allTaskIds,
          currentIndex: currentIndex >= 0 ? currentIndex : 0,
          sourceView: 'home',
          projectId: record.project_id || null,
        })
      );

      if (record.project_id) dispatch(fetchPhasesByProjectId(record.project_id));
      dispatch(setSelectedTaskId(record.task_id));
      dispatch(fetchTask({ taskId: record.task_id, projectId: record.project_id }));
      dispatch(setProjectId(record.project_id));
      dispatch(setShowTaskDrawer(true));
    },
    [dispatch, logs]
  );

  const renderSortableTitle = useCallback(
    (label: string, field: LogSortField) => (
      <span
        onClick={() => onSortChange(field)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer', userSelect: 'none' }}
      >
        <span>{label}</span>
        <SortArrows active={sortField === field ? sortOrder : null} />
      </span>
    ),
    [sortField, sortOrder, onSortChange]
  );

  const columns: TableProps<IRecentTimeLog>['columns'] = useMemo(
    () => [
      {
        key: 'task',
        title: renderSortableTitle(t('colTask', { defaultValue: 'Task' }), 'task_name'),
        width: widths.task,
        render: (_, record) => (
          <div
            onClick={() => handleOpenTask(record)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <span style={{ flex: 1, minWidth: 0, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {record.task_name}
            </span>
            <div className="row-action-button">
              <Tooltip title={t('openTaskTooltip', { defaultValue: 'Open task details' })} placement="right">
                <ExpandAltOutlined style={{ fontSize: 16, color: token.colorTextSecondary }} />
              </Tooltip>
            </div>
          </div>
        ),
      },
      ...(showAuthor
        ? [
            {
              key: 'member',
              title: renderSortableTitle(t('colMember', { defaultValue: 'Member' }), 'user_name'),
              width: widths.member,
              render: (_: unknown, record: IRecentTimeLog) => (
                <TimeEntryMemberAvatars members={getRowMembers(record)} />
              ),
            },
          ]
        : []),
      {
        key: 'project',
        title: renderSortableTitle(t('colProject', { defaultValue: 'Project' }), 'project_name'),
        width: widths.project,
        filters: projectFilterOptions,
        filteredValue: selectedProjectIds,
        render: (_, record) => (
          <span
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            onClick={() => record.project_id && navigate(`/worklenz/projects/${record.project_id}?tab=tasks-list&pinned_tab=tasks-list`)}
          >
            <Badge color={record.project_color || token.colorPrimary} />
            <span style={{ fontWeight: 500 }}>{record.project_name}</span>
          </span>
        ),
      },
      {
        key: 'status',
        title: renderSortableTitle(t('colStatus', { defaultValue: 'Status' }), 'status_name'),
        width: widths.status,
        ellipsis: true,
        filters: statusFilterOptions,
        filteredValue: selectedStatusNames,
        render: (_, record) =>
          record.status_name ? (
            <TruncatedColoredTag
              label={record.status_name}
              color={themeMode === 'dark' ? record.status_color_dark : record.status_color}
            />
          ) : null,
      },
      {
        key: 'priority',
        title: renderSortableTitle(t('colPriority', { defaultValue: 'Priority' }), 'priority_name'),
        width: widths.priority,
        filters: priorityFilterOptions,
        filteredValue: selectedPriorityIds,
        render: (_, record) =>
          record.priority_name ? (
            <Tag
              color={themeMode === 'dark' ? record.priority_color_dark : record.priority_color}
              style={{ margin: 0, fontSize: 11 }}
            >
              {record.priority_name}
            </Tag>
          ) : null,
      },
      {
        key: 'billable',
        title: renderSortableTitle(t('colBillable', { defaultValue: 'Billable' }), 'billable'),
        width: widths.billable,
        filters: billableFilterOptions,
        filteredValue: selectedBillableValues,
        render: (_, record) =>
          record.billable ? t('billableYes', { defaultValue: 'Yes' }) : t('billableNo', { defaultValue: 'No' }),
      },
      {
        key: 'description',
        title: t('colDescription', { defaultValue: 'Description' }),
        width: widths.description,
        ellipsis: true,
        render: (_, record) =>
          record.description ? (
            <Tooltip title={record.description}>
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {record.description}
              </span>
            </Tooltip>
          ) : (
            <span style={{ opacity: 0.5 }}>—</span>
          ),
      },
      {
        key: 'time',
        title: renderSortableTitle(t('colTimeLogged', { defaultValue: 'Time Logged' }), 'time_spent'),
        width: widths.time,
        render: (_, record) => formatLoggedDuration(record.time_spent),
      },
      {
        key: 'dueDate',
        title: renderSortableTitle(t('colDueDate', { defaultValue: 'Due Date' }), 'due_date'),
        width: widths.dueDate,
        render: (_, record) => {
          if (!record.due_date) {
            return <span style={{ opacity: 0.5, fontSize: 11 }}>{t('noDueDate', { defaultValue: 'No due date' })}</span>;
          }
          const isOverdue = !record.is_done && dayjs(record.due_date).isBefore(dayjs(), 'day');
          return (
            <span style={{ fontSize: 11, color: isOverdue ? '#ff4d4f' : undefined, opacity: isOverdue ? 1 : 0.65 }}>
              {dayjs(record.due_date).format('MMM D')}
            </span>
          );
        },
      },
      {
        key: 'loggedOn',
        title: renderSortableTitle(t('colLoggedOn', { defaultValue: 'Logged On' }), 'created_at'),
        width: widths.loggedOn,
        render: (_, record) => {
          if (!record.created_at) {
            return <span style={{ opacity: 0.5, fontSize: 11 }}>-</span>;
          }
          return (
            <span
              style={{ fontSize: 11, opacity: 0.75 }}
              title={formatLoggedOnTooltip(record.created_at)}
            >
              {formatLoggedOnDate(record.created_at)}
            </span>
          );
        },
      },
      ...(showEntryActions
        ? [
            {
              key: 'actions',
              title: (
                <span className="time-entries-sr-only">
                  {t('colActions', { defaultValue: 'Actions' })}
                </span>
              ),
              width: widths.actions,
              render: (_: unknown, record: IRecentTimeLog) =>
                // Only the person who logged it - or an owner/admin - may change an entry.
                canEditEntry(record.user_id) ? (
                  <Flex gap={4} justify="flex-end" className="row-action-button">
                    <Tooltip title={t('editEntry', { defaultValue: 'Edit' })}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        aria-label={t('editEntry', { defaultValue: 'Edit' })}
                        onClick={() => setEditingRecord(record)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={t('deleteEntryConfirm', { defaultValue: 'Delete this time entry?' })}
                      okText={t('deleteEntryOk', { defaultValue: 'Delete' })}
                      cancelText={t('deleteEntryCancel', { defaultValue: 'Cancel' })}
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleDeleteEntry(record)}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        title={t('deleteEntry', { defaultValue: 'Delete' })}
                        aria-label={t('deleteEntry', { defaultValue: 'Delete' })}
                        loading={deletingId === record.id}
                      />
                    </Popconfirm>
                  </Flex>
                ) : null,
            },
          ]
        : []),
    ],
    [
      renderSortableTitle,
      themeMode,
      token,
      navigate,
      handleOpenTask,
      t,
      showAuthor,
      projectFilterOptions,
      selectedProjectIds,
      statusFilterOptions,
      selectedStatusNames,
      priorityFilterOptions,
      selectedPriorityIds,
      billableFilterOptions,
      selectedBillableValues,
      widths,
      showEntryActions,
      canEditEntry,
      deletingId,
      handleDeleteEntry,
    ]
  );

  return (
    <div
      className="time-entries-log-table"
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        overflow: 'hidden',
      }}
    >
      <div ref={tableAreaRef} style={{ flex: '1 1 auto', minHeight: 200 }}>
        <Table<IRecentTimeLog>
          dataSource={logs}
          rowKey={record => record.id}
          columns={columns}
          size="middle"
          sticky
          // Bounds the table body to the space actually available in this
          // flex region (measured live via useFillRemainingHeight, not a
          // hand-tuned calc(100vh - Npx) guess) so only the rows scroll
          // internally, matching the Recurring Tasks table's intent
          // (components/recurring-tasks/RecurringTasksTable.tsx) while staying
          // correct regardless of how much chrome renders above it.
          scroll={{ x: 'max-content', y: scrollY }}
          pagination={false}
          tableLayout="fixed"
          loading={loading}
          onChange={(_pagination, tableFilters) => {
            onProjectFilterChange(((tableFilters.project as React.Key[]) || []).map(String));
            onStatusFilterChange(((tableFilters.status as React.Key[]) || []).map(String));
            onPriorityFilterChange(((tableFilters.priority as React.Key[]) || []).map(String));
            onBillableFilterChange(((tableFilters.billable as React.Key[]) || []).map(String));
          }}
          locale={{
            emptyText: (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {t('emptyLogsTitle', { defaultValue: 'No time logged yet' })}
                </div>
                <p style={{ opacity: 0.6, fontSize: 12, margin: '0 0 16px' }}>
                  {t('emptyLogsSubtitle', { defaultValue: 'Log time against a task to see it appear here.' })}
                </p>
                <Button type="primary" size="small" onClick={onLogTime}>
                  {t('quickLogButton', { defaultValue: 'Log time' })}
                </Button>
              </div>
            ),
          }}
        />
      </div>

      <div style={{ flexShrink: 0 }}>
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          rowsPerPageLabel={t('rowsPerPage', { defaultValue: 'Rows per page:' })}
        />
      </div>

      <EditTimeEntryModal
        entry={editingRecord}
        onClose={() => setEditingRecord(null)}
        onSaved={() => {
          setEditingRecord(null);
          onEntryChange();
        }}
      />
    </div>
  );
};
