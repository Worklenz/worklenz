import { memo, useMemo } from 'react';
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
import { Alert, Button, Card, Empty, Skeleton, Typography, theme } from '@/shared/antd-imports';
import { type GetFlowArgs, useGetTimeInStatusQuery } from '@/api/reporting/progress-chart.api.service';
import { formatDays } from '../report-shell';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, ChartTooltip);

const TimeInStatusChartCard = ({ flowArgs }: { flowArgs: GetFlowArgs }) => {
  const { t } = useTranslation('reporting-flow');
  const { token } = theme.useToken();
  const { data, isLoading, isError, refetch } = useGetTimeInStatusQuery(flowArgs);
  const rows = useMemo(() => data?.body?.rows ?? [], [data]);
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

  let body: React.ReactNode;
  if (isLoading) {
    body = <Skeleton active paragraph={{ rows: 4 }} />;
  } else if (isError) {
    body = (
      <Alert
        type="error"
        showIcon
        message={t('loadFailed', { defaultValue: 'Could not load this report' })}
        action={
          <Button size="small" onClick={() => refetch()}>
            {t('retry', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  } else if (!rows.length) {
    body = <Empty description={t('tis.noChartData', { defaultValue: 'No status history in this period' })} />;
  } else {
    body = (
      <>
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
      </>
    );
  }

  return <Card title={t('tis.chartTitle', { defaultValue: 'Average time per status' })}>{body}</Card>;
};

export default memo(TimeInStatusChartCard);
