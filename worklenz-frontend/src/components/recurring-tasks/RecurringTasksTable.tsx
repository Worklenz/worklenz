import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Table,
  TableProps,
  Badge,
  Tooltip,
  Typography,
  Skeleton,
  theme,
  ExpandAltOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
} from '@/shared/antd-imports';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import AvatarGroup from '@/components/AvatarGroup';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
  setNavigationContext,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { IRecurringTaskRow } from '@/api/tasks/recurring-tasks-list.api.service';
import CustomTableTitle from '@/components/CustomTableTitle';
import TablePagination from '@/components/TablePagination';
import './recurring-tasks.css';

export type RecurringTasksSortField =
  | 'name'
  | 'project'
  | 'start_date'
  | 'end_date'
  | 'est_time'
  | 'priority'
  | 'recur_type';

interface RecurringTasksTableProps {
  tasks: IRecurringTaskRow[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  sortField: RecurringTasksSortField | null;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: RecurringTasksSortField) => void;
  selectedPriorityIds: string[];
  onPriorityFilterChange: (ids: string[]) => void;
  selectedRecurringModes: string[];
  onRecurringModeFilterChange: (values: string[]) => void;
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Compact stacked up/down carets, matching the sort-toggle used in Home > Overview's
// priority table (src/pages/home/task-list/TasksList.tsx) — clicking the header cycles
// the sort direction for that column.
const SortArrows: React.FC<{ active: 'asc' | 'desc' | null }> = ({ active }) => {
  const { token } = theme.useToken();
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', marginLeft: 4, lineHeight: 0 }}>
      <CaretUpOutlined
        style={{ fontSize: 12, color: active === 'asc' ? token.colorPrimary : token.colorTextQuaternary }}
      />
      <CaretDownOutlined
        style={{
          fontSize: 12,
          marginTop: -2,
          color: active === 'desc' ? token.colorPrimary : token.colorTextQuaternary,
        }}
      />
    </span>
  );
};

export const RecurringTasksTable: React.FC<RecurringTasksTableProps> = ({
  tasks,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  sortField,
  sortOrder,
  onSortChange,
  selectedPriorityIds,
  onPriorityFilterChange,
  selectedRecurringModes,
  onRecurringModeFilterChange,
}) => {
  const { t } = useTranslation('recurring-tasks');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { priorities } = useAppSelector(state => state.priorityReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  useEffect(() => {
    dispatch(fetchPriorities());
  }, [dispatch]);

  const recurTypeFilterOptions = useMemo(
    () => [
      { text: t('recurTypeCreateTask', { defaultValue: 'Create New Task' }), value: 'create_task' },
      { text: t('recurTypeChangeStatus', { defaultValue: 'Change Status' }), value: 'change_status' },
    ],
    [t]
  );

  const priorityFilterOptions = useMemo(
    () => priorities.map(p => ({ text: p.name || '', value: p.id || '' })),
    [priorities]
  );

  const handleOpenTask = useCallback(
    (record: IRecurringTaskRow) => {
      const allTaskIds = Array.from(new Set(tasks.map(l => l.id).filter(Boolean)));
      const currentIndex = allTaskIds.indexOf(record.id);

      dispatch(
        setNavigationContext({
          taskIds: allTaskIds,
          currentIndex: currentIndex >= 0 ? currentIndex : 0,
          sourceView: 'home',
          projectId: record.project_id || null,
        })
      );

      if (record.project_id) dispatch(fetchPhasesByProjectId(record.project_id));
      dispatch(setSelectedTaskId(record.id));
      dispatch(fetchTask({ taskId: record.id, projectId: record.project_id }));
      dispatch(setProjectId(record.project_id));
      dispatch(setShowTaskDrawer(true));
    },
    [dispatch, tasks]
  );

  const formatRecurrenceSummary = useCallback(
    (record: IRecurringTaskRow): string => {
      switch (record.schedule_type) {
        case 'daily':
          return t('recurrenceDaily', { defaultValue: 'Daily' });
        case 'weekly': {
          const days = (record.days_of_week || [])
            .slice()
            .sort()
            .map(d => t(`dayShort.${DAY_NAMES[d]}`, { defaultValue: DAY_NAMES[d] }));
          return days.length
            ? t('recurrenceWeeklyOn', {
                defaultValue: 'Weekly on {{days}}',
                days: days.join(', '),
              })
            : t('recurrenceWeekly', { defaultValue: 'Weekly' });
        }
        case 'monthly':
          return record.date_of_month
            ? t('recurrenceMonthlyOnDate', {
                defaultValue: 'Monthly on day {{date}}',
                date: record.date_of_month,
              })
            : t('recurrenceMonthly', { defaultValue: 'Monthly' });
        case 'yearly':
          return t('recurrenceYearly', { defaultValue: 'Yearly' });
        case 'every_x_days':
          return t('recurrenceEveryDaysN', {
            defaultValue: 'Every {{count}} days',
            count: record.interval_days || 1,
          });
        case 'every_x_weeks':
          return t('recurrenceEveryWeeksN', {
            defaultValue: 'Every {{count}} weeks',
            count: record.interval_weeks || 1,
          });
        case 'every_x_months':
          return t('recurrenceEveryMonthsN', {
            defaultValue: 'Every {{count}} months',
            count: record.interval_months || 1,
          });
        default:
          return '-';
      }
    },
    [t]
  );

  const renderSortableTitle = useCallback(
    (label: string, field: RecurringTasksSortField) => (
      <span
        onClick={() => onSortChange(field)}
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
    [sortField, sortOrder, onSortChange]
  );

  const columns: TableProps<IRecurringTaskRow>['columns'] = useMemo(
    () => [
      {
        key: 'taskKey',
        title: <CustomTableTitle title={t('colTaskKey', { defaultValue: 'Key' })} />,
        width: 90,
        fixed: 'left' as const,
        render: (_, record) => (
          <Typography.Text style={{ fontSize: 12, fontWeight: 600, color: token.colorPrimary }}>
            {record.task_key || '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'task',
        title: renderSortableTitle(t('colTask', { defaultValue: 'Task' }), 'name'),
        width: 220,
        fixed: 'left' as const,
        render: (_, record) => (
          <div
            onClick={() => handleOpenTask(record)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <Typography.Text
              ellipsis={{ tooltip: record.name }}
              style={{ flex: 1, minWidth: 0, marginRight: 8 }}
            >
              {record.name}
            </Typography.Text>
            <div className="row-action-button">
              <Tooltip title="Open the task" placement="right">
                <ExpandAltOutlined style={{ fontSize: 18, color: token.colorTextSecondary }} />
              </Tooltip>
            </div>
          </div>
        ),
      },
      {
        key: 'recurType',
        title: renderSortableTitle(t('colRecurType', { defaultValue: 'Recur Type' }), 'recur_type'),
        width: 150,
        filters: recurTypeFilterOptions,
        filteredValue: selectedRecurringModes,
        render: (_, record) => (
          <Typography.Text
            style={{
              fontSize: 12,
              fontWeight: 500,
              color:
                record.recurring_mode === 'change_status' ? token.colorWarning : token.colorPrimary,
            }}
          >
            {record.recurring_mode === 'change_status'
              ? t('recurTypeChangeStatus', { defaultValue: 'Change Status' })
              : t('recurTypeCreateTask', { defaultValue: 'Create New Task' })}
          </Typography.Text>
        ),
      },
      {
        key: 'project',
        title: renderSortableTitle(t('colProject', { defaultValue: 'Project' }), 'project'),
        width: 160,
        render: (_, record) => (
          <span
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            onClick={() =>
              record.project_id &&
              navigate(`/worklenz/projects/${record.project_id}?tab=tasks-list&pinned_tab=tasks-list`)
            }
          >
            <Badge color={record.project_color || token.colorPrimary} />
            <Typography.Text ellipsis={{ tooltip: record.project_name }} style={{ maxWidth: 130 }}>
              {record.project_name}
            </Typography.Text>
          </span>
        ),
      },
      {
        key: 'assignee',
        title: <CustomTableTitle title={t('colAssignee', { defaultValue: 'Assignee' })} />,
        width: 110,
        render: (_, record) => {
          const assignees = record.assignees || [];
          if (!assignees.length) {
            return <Typography.Text type="secondary">-</Typography.Text>;
          }
          return (
            <AvatarGroup
              members={assignees.map(assignee => ({
                id: assignee.team_member_id,
                team_member_id: assignee.team_member_id,
                name: assignee.name,
                avatar_url: assignee.avatar_url,
              }))}
              maxCount={3}
              size={22}
              isDarkMode={themeMode === 'dark'}
            />
          );
        },
      },
      {
        key: 'recurrence',
        title: <CustomTableTitle title={t('colRecurrence', { defaultValue: 'Recurrence' })} />,
        width: 180,
        render: (_, record) => (
          <Typography.Text style={{ fontSize: 12 }}>
            {formatRecurrenceSummary(record)}
          </Typography.Text>
        ),
      },
      {
        key: 'startDate',
        title: renderSortableTitle(t('colStartDate', { defaultValue: 'Start Date' }), 'start_date'),
        width: 100,
        render: (_, record) => (
          <Typography.Text style={{ fontSize: 12 }}>
            {record.start_date ? dayjs(record.start_date).format('MMM DD') : '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'endDate',
        title: renderSortableTitle(t('colEndDate', { defaultValue: 'End Date' }), 'end_date'),
        width: 100,
        render: (_, record) => (
          <Typography.Text style={{ fontSize: 12 }}>
            {record.end_date ? dayjs(record.end_date).format('MMM DD') : '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'estTime',
        title: renderSortableTitle(t('colEstTime', { defaultValue: 'Est. Time' }), 'est_time'),
        width: 100,
        render: (_, record) => (
          <Typography.Text style={{ fontSize: 12 }}>
            {record.est_time_string || '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'priority',
        title: renderSortableTitle(t('colPriority', { defaultValue: 'Priority' }), 'priority'),
        width: 100,
        filters: priorityFilterOptions,
        filteredValue: selectedPriorityIds,
        render: (_, record) => {
          if (!record.priority_name) {
            return <span style={{ color: token.colorTextQuaternary }}>—</span>;
          }
          return (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 400,
                background:
                  (themeMode === 'dark' ? record.priority_color_dark : record.priority_color) ??
                  record.priority_color ??
                  'transparent',
                color: '#fff',
              }}
            >
              {record.priority_name}
            </span>
          );
        },
      },
    ],
    [
      t,
      token,
      navigate,
      handleOpenTask,
      formatRecurrenceSummary,
      renderSortableTitle,
      priorityFilterOptions,
      selectedPriorityIds,
      recurTypeFilterOptions,
      selectedRecurringModes,
      themeMode,
    ]
  );

  // Column-shaped skeleton instead of antd's spinner overlay — swaps in
  // placeholder rows/cells sized per column while data is loading.
  const skeletonRows = useMemo(
    () => Array.from({ length: pageSize }, (_, i) => ({ id: `skeleton-${i}` }) as IRecurringTaskRow),
    [pageSize]
  );

  const skeletonColumns: TableProps<IRecurringTaskRow>['columns'] = useMemo(
    () =>
      (columns || []).map(col => ({
        ...col,
        render: () => {
          if (col.key === 'assignee') {
            return <Skeleton.Avatar size={22} active shape="circle" />;
          }
          if (col.key === 'priority') {
            return <Skeleton.Button size="small" active style={{ width: 60, minWidth: 60 }} />;
          }
          return <Skeleton.Input size="small" active style={{ width: '70%' }} />;
        },
      })),
    [columns]
  );

  return (
    <div
      className="recurring-tasks-table"
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 8,
        background: token.colorBgContainer,
        overflow: 'hidden',
      }}
    >
      <Table<IRecurringTaskRow>
        dataSource={loading ? skeletonRows : tasks}
        rowKey={record => record.id}
        columns={loading ? skeletonColumns : columns}
        size="middle"
        sticky
        scroll={{ x: 'max-content', y: 'calc(100vh - 340px)' }}
        pagination={false}
        onChange={(_pagination, tableFilters) => {
          const priorityValues = (tableFilters.priority as React.Key[]) || [];
          onPriorityFilterChange(priorityValues.map(String));
          const recurTypeValues = (tableFilters.recurType as React.Key[]) || [];
          onRecurringModeFilterChange(recurTypeValues.map(String));
        }}
        locale={{
          emptyText: (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {t('emptyTitle', { defaultValue: 'No recurring tasks yet' })}
              </div>
              <p style={{ opacity: 0.6, fontSize: 12, margin: 0 }}>
                {t('emptySubtitle', {
                  defaultValue: 'Make a task recurring from its details to see it appear here.',
                })}
              </p>
            </div>
          ),
        }}
      />
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        rowsPerPageLabel={t('rowsPerPage', { defaultValue: 'Rows per page:' })}
      />
    </div>
  );
};
