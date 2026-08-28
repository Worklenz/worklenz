import React, { useCallback, useMemo } from 'react';
import {
  Table,
  TableProps,
  Badge,
  Pagination,
  Button,
  theme,
  CaretUpOutlined,
  CaretDownOutlined,
  Tag,
} from '@/shared/antd-imports';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IRecentTimeLog } from '@/api/tasks/task-time-logs.api.service';
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
import '@/pages/time-entries/time-entries.css';

const formatSeconds = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
};

export type LogSortField =
  | 'project_name'
  | 'task_name'
  | 'priority_name'
  | 'time_spent'
  | 'created_at'
  | 'due_date'
  | null;

// Mirrors the sort-arrow affordance used by the Overview page's priority table
// and Home > Log Time's Recently Logged table (TasksList.tsx / HomeLogTime.tsx)
// so every sortable table in the app reads the same way.
const SortArrows: React.FC<{ active: 'asc' | 'desc' | null }> = ({ active }) => {
  const { token } = theme.useToken();
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', marginLeft: 4, lineHeight: 0 }}>
      <CaretUpOutlined
        style={{ fontSize: 9, color: active === 'asc' ? token.colorPrimary : token.colorTextQuaternary }}
      />
      <CaretDownOutlined
        style={{ fontSize: 9, marginTop: -2, color: active === 'desc' ? token.colorPrimary : token.colorTextQuaternary }}
      />
    </span>
  );
};

interface TimeEntriesLogTableProps {
  logs: IRecentTimeLog[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  sortField: LogSortField;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: LogSortField) => void;
  onLogTime: () => void;
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
}) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

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
        width: '22%',
        render: (_, record) => (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => handleOpenTask(record)}
            onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            {record.task_name}
          </span>
        ),
      },
      {
        key: 'project',
        title: renderSortableTitle(t('colProject', { defaultValue: 'Project' }), 'project_name'),
        width: '18%',
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
        title: t('colStatus', { defaultValue: 'Status' }),
        width: '13%',
        render: (_, record) =>
          record.status_name ? (
            <Tag
              color={themeMode === 'dark' ? record.status_color_dark : record.status_color}
              style={{ margin: 0, fontSize: 11 }}
            >
              {record.status_name}
            </Tag>
          ) : null,
      },
      {
        key: 'priority',
        title: renderSortableTitle(t('colPriority', { defaultValue: 'Priority' }), 'priority_name'),
        width: '13%',
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
        title: t('colBillable', { defaultValue: 'Billable' }),
        width: '10%',
        render: (_, record) => (
          <Tag
            color={record.billable ? '#52c41a' : undefined}
            style={{ margin: 0, fontSize: 11 }}
          >
            {record.billable ? t('billableYes', { defaultValue: 'Yes' }) : t('billableNo', { defaultValue: 'No' })}
          </Tag>
        ),
      },
      {
        key: 'time',
        title: renderSortableTitle(t('colTimeLogged', { defaultValue: 'Time' }), 'time_spent'),
        width: '12%',
        render: (_, record) => (
          <Tag color="#1677ff" style={{ margin: 0, fontSize: 11 }}>
            {formatSeconds(record.time_spent || 0)}
          </Tag>
        ),
      },
      {
        key: 'dueDate',
        title: renderSortableTitle(t('colDueDate', { defaultValue: 'Due Date' }), 'due_date'),
        width: '12%',
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
    ],
    [renderSortableTitle, themeMode, token, navigate, handleOpenTask, t]
  );

  return (
    <div
      className="time-entries-log-table"
      style={{
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        overflow: 'hidden',
      }}
    >
      <Table<IRecentTimeLog>
        dataSource={logs}
        rowKey={record => record.id}
        columns={columns}
        size="middle"
        pagination={false}
        tableLayout="fixed"
        loading={loading}
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

      {total > pageSize && (
        <div style={{ padding: '12px 16px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={onPageChange}
            showSizeChanger={false}
            size="small"
          />
        </div>
      )}
    </div>
  );
};
