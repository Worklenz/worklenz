import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Alert, Button, Card, Checkbox, Empty, Flex, Select, Skeleton, Table, Tag, Typography, theme } from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_time_in_status } from '@/shared/worklenz-analytics-events';
import { type TimeInStatusTask, useGetTimeInStatusQuery } from '@/api/reporting/progress-chart.api.service';
import type { OverviewWidgetConfig } from '@/api/reporting/overview-layout.api.service';
import {
  formatDays,
  formatDwell,
  ReportRangePicker,
  ReportShell,
  useReportDateRange,
  useReportOptions,
} from './report-shell';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, ChartTooltip);

const ALL = 'all';
const TASK_PAGE_SIZE = 10;

export const TimeInStatusReportPage = () => {
  const { t } = useTranslation('reporting-flow');
  const { token } = theme.useToken();
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle(t('tis.title', { defaultValue: 'Time in Status' }));

  const { projects, members, isFetching: isLoadingOptions } = useReportOptions();
  const { range, setRange, dateRange } = useReportDateRange();
  const [projectId, setProjectId] = useState<string>(ALL);
  const [assigneeId, setAssigneeId] = useState<string>(ALL);
  const [statusName, setStatusName] = useState<string>(ALL);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_time_in_status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isTeam = projectId === ALL;
  const config = useMemo<OverviewWidgetConfig>(
    () => ({ progressScope: isTeam ? 'team' : 'project', projectId: isTeam ? undefined : projectId, includeSubtasks }),
    [isTeam, projectId, includeSubtasks]
  );
  const { data, isLoading, isError, refetch } = useGetTimeInStatusQuery({
    config,
    includeArchived,
    dateRange,
    assigneeId: assigneeId === ALL ? undefined : assigneeId,
  });
  const result = data?.body;

  const rows = useMemo(
    () => (result?.rows ?? []).filter(row => statusName === ALL || row.band.name === statusName),
    [result, statusName]
  );
  const tasks = useMemo(
    () => (result?.tasks ?? []).filter(task => statusName === ALL || task.status_name === statusName),
    [result, statusName]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set((result?.rows ?? []).map(row => row.band.name))),
    [result]
  );
  const slowest = useMemo(() => rows.slice().sort((a, b) => b.avg_hours - a.avg_hours)[0], [rows]);

  const chartData = useMemo(
    () => ({
      labels: rows.map(row => row.band.name),
      datasets: [
        {
          label: t('tis.averageTimePerTask', { defaultValue: 'Average time per task' }),
          data: rows.map(row => row.avg_hours),
          backgroundColor: rows.map(row => row.band.color),
          borderRadius: 4,
        },
      ],
    }),
    [rows, t]
  );

  const columns: TableColumnsType<TimeInStatusTask> = [
    {
      title: t('tis.task', { defaultValue: 'Task' }),
      dataIndex: 'name',
      render: (name: string, task) => (
        <Flex vertical>
          <Typography.Text strong>{name}</Typography.Text>
          {task.task_key && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              #{task.task_key}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    { title: t('project', { defaultValue: 'Project' }), dataIndex: 'project_name' },
    {
      title: t('tis.currentStatus', { defaultValue: 'Current status' }),
      dataIndex: 'status_name',
      render: (name: string, task) => <Tag color={task.status_color}>{name}</Tag>,
    },
    {
      title: t('tis.timeInStatus', { defaultValue: 'Time in status' }),
      dataIndex: 'hours_in_status',
      sorter: (a, b) => a.hours_in_status - b.hours_in_status,
      defaultSortOrder: 'descend',
      render: (hours: number, task) => (
        <Typography.Text type={task.hours_overdue !== null ? 'danger' : undefined}>{formatDwell(hours)}</Typography.Text>
      ),
    },
    {
      title: t('tis.timeOverdue', { defaultValue: 'Time overdue' }),
      dataIndex: 'hours_overdue',
      render: (hours: number | null) => (hours === null ? '–' : <Typography.Text type="danger">{formatDwell(hours)}</Typography.Text>),
    },
    {
      title: t('tis.assignedTo', { defaultValue: 'Assigned to' }),
      dataIndex: 'assignees',
      render: (names: string[]) => (names.length ? names.join(', ') : t('tis.unassigned', { defaultValue: 'Unassigned' })),
    },
    {
      title: t('tis.lastUpdated', { defaultValue: 'Last updated' }),
      dataIndex: 'updated_at',
      render: (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    },
  ];

  const filters = (
    <>
      <Select
        showSearch
        optionFilterProp="label"
        style={{ minWidth: 200 }}
        loading={isLoadingOptions}
        aria-label={t('project', { defaultValue: 'Project' })}
        value={projectId}
        onChange={value => {
          setProjectId(value);
          setStatusName(ALL);
        }}
        options={[
          { value: ALL, label: t('allProjects', { defaultValue: 'All projects (active team)' }) },
          ...projects.map(project => ({ value: project.id, label: project.name })),
        ]}
      />
      <Select
        showSearch
        optionFilterProp="label"
        style={{ minWidth: 170 }}
        loading={isLoadingOptions}
        aria-label={t('tis.assignee', { defaultValue: 'Assignee' })}
        value={assigneeId}
        onChange={setAssigneeId}
        options={[
          { value: ALL, label: t('tis.allAssignees', { defaultValue: 'All assignees' }) },
          ...members.map(member => ({ value: member.id, label: member.name })),
        ]}
      />
      <Select
        style={{ minWidth: 150 }}
        aria-label={t('tis.status', { defaultValue: 'Status' })}
        value={statusName}
        onChange={setStatusName}
        options={[
          { value: ALL, label: t('tis.allStatuses', { defaultValue: 'All statuses' }) },
          ...statusOptions.map(name => ({ value: name, label: name })),
        ]}
      />
      <ReportRangePicker value={range} onChange={setRange} />
      <Checkbox checked={includeSubtasks} onChange={event => setIncludeSubtasks(event.target.checked)}>
        {t('includeSubtasks', { defaultValue: 'Include sub-tasks' })}
      </Checkbox>
      {isTeam && (
        <Checkbox checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)}>
          {t('includeArchived', { defaultValue: 'Include archived projects' })}
        </Checkbox>
      )}
    </>
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = <Skeleton active paragraph={{ rows: 10 }} />;
  } else if (isError) {
    body = (
      <Alert
        type="error"
        showIcon
        message={t('loadFailed', { defaultValue: 'Could not load this report' })}
        action={<Button size="small" onClick={() => refetch()}>{t('retry', { defaultValue: 'Retry' })}</Button>}
      />
    );
  } else if (!result || (!rows.length && !tasks.length)) {
    body = (
      <Card>
        <Empty description={t('noTasks', { defaultValue: 'No tasks found for this selection' })} />
      </Card>
    );
  } else {
    body = (
      <>
        <Card title={t('tis.chartTitle', { defaultValue: 'Average time per status' })}>
          <div
            role="img"
            aria-label={t('tis.chartAria', {
              defaultValue: 'Average time per status across {{count}} statuses',
              count: rows.length,
            })}
            style={{ height: Math.max(rows.length * 48 + 60, 180) }}
          >
            <Bar
              data={chartData}
              options={{
                indexAxis: 'y',
                maintainAspectRatio: false,
                color: token.colorTextSecondary,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: context => {
                        const row = rows[context.dataIndex];
                        return [
                          t('tis.averageTooltip', { defaultValue: 'Average: {{value}}', value: formatDays(row.avg_hours) }),
                          t('tis.medianTooltip', { defaultValue: 'Median: {{value}}', value: formatDays(row.median_hours) }),
                          t('tis.tasksTooltip', { defaultValue: 'Tasks: {{count}}', count: row.task_count }),
                        ];
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    beginAtZero: true,
                    ticks: { color: token.colorTextSecondary, callback: value => formatDays(Number(value)) },
                    grid: { color: token.colorBorderSecondary },
                  },
                  y: { ticks: { color: token.colorTextSecondary }, grid: { display: false } },
                },
              }}
            />
          </div>
          {slowest && (
            <Typography.Text type="danger" style={{ fontSize: 12 }}>
              {t('tis.slowestHint', {
                defaultValue: '{{status}} has the longest average time ({{value}}). Consider checking for stalled or blocked tasks there.',
                status: slowest.band.name,
                value: formatDays(slowest.avg_hours),
              })}
            </Typography.Text>
          )}
        </Card>
        <Card title={t('tis.taskDetails', { defaultValue: 'Task details' })}>
          <Table<TimeInStatusTask>
            size="small"
            rowKey="id"
            columns={columns}
            dataSource={tasks}
            pagination={{ pageSize: TASK_PAGE_SIZE, hideOnSinglePage: true, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: t('noTasks', { defaultValue: 'No tasks found for this selection' }) }}
          />
        </Card>
      </>
    );
  }

  return (
    <ReportShell
      title={t('tis.title', { defaultValue: 'Time in Status' })}
      subtitle={t('tis.subtitle', {
        defaultValue:
          'Analyse how long tasks spend in each workflow status, so you can find where work stalls or ages and unblock it.',
      })}
      filters={filters}
    >
      {body}
    </ReportShell>
  );
};

export default TimeInStatusReportPage;
