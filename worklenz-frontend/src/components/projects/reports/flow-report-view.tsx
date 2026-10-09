import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Bar } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartOptions,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Flex, Typography, theme } from '@/shared/antd-imports';

import { softwareReportsApiService } from '@/api/software-reports/software-reports.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSoftwareReport } from '@/hooks/useSoftwareReport';
import { IFlowReport, IFlowStatus } from '@/types/project/softwareReports.types';
import {
  ReportChartArea,
  ReportChartEmpty,
  ReportError,
  ReportLoading,
  ReportPanel,
  ReportStat,
  ReportStatGrid,
} from './report-parts';
import { EMPTY_VALUE, getBaseChartOptions, getChartTheme } from './report-utils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface FlowReportViewProps {
  projectId: string;
}

export const FlowReportView = ({ projectId }: FlowReportViewProps) => {
  const { t } = useTranslation('project-view');
  const { data, isLoading, hasError, reload } = useSoftwareReport<IFlowReport>(projectId, () =>
    softwareReportsApiService.getFlowReport(projectId)
  );

  if (hasError && !data) return <ReportError onRetry={reload} />;
  if (!data) return <ReportLoading />;

  return (
    <Flex vertical gap={12} className={isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <Typography.Text type="secondary" className="text-xs">
        {data.sprint
          ? t('reportsFlowScopeSprint', {
              defaultValue: 'Showing work in {{name}}',
              name: data.sprint.name,
            })
          : t('reportsFlowScopeAll', {
              defaultValue: 'No active sprint. Showing all project work.',
            })}
      </Typography.Text>

      <ReportStatGrid stats={buildFlowStats(t, data)} />

      <ReportPanel
        title={t('reportsFlowDistributionTitle', { defaultValue: 'Current flow distribution' })}
        extra={
          <Typography.Text type="secondary" className="text-xs">
            {t('reportsIssuesUnit', { defaultValue: 'Issues' })}
          </Typography.Text>
        }
      >
        <FlowDistributionChart statuses={data.statuses} />
      </ReportPanel>
    </Flex>
  );
};

const FlowDistributionChart = ({ statuses }: { statuses: IFlowStatus[] }) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const chartTheme = getChartTheme(token);
  const baseOptions = getBaseChartOptions(chartTheme);

  if (!statuses.some(status => status.issue_count > 0)) {
    return (
      <ReportChartEmpty
        description={t('reportsFlowEmpty', { defaultValue: 'No issues to show yet.' })}
      />
    );
  }

  const barColors = statuses.map(status =>
    themeMode === 'dark' ? status.color_code_dark || status.color_code : status.color_code
  );
  const chartData = {
    labels: statuses.map(status => status.name),
    datasets: [
      {
        label: t('reportsIssuesUnit', { defaultValue: 'Issues' }),
        data: statuses.map(status => status.issue_count),
        backgroundColor: barColors,
        borderRadius: 4,
        maxBarThickness: 22,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    ...baseOptions,
    indexAxis: 'y',
    interaction: { mode: 'nearest', intersect: true, axis: 'y' },
    plugins: { ...baseOptions.plugins, legend: { display: false } },
    scales: {
      x: { ...baseOptions.scales.y },
      y: { ...baseOptions.scales.x },
    },
  };

  return (
    <ReportChartArea>
      <Bar
        data={chartData}
        options={options}
        aria-label={t('reportsFlowDistributionTitle', { defaultValue: 'Current flow distribution' })}
        role="img"
      />
    </ReportChartArea>
  );
};

const buildFlowStats = (t: TFunction, report: IFlowReport): ReportStat[] => {
  const openStatuses = report.statuses.filter(status => status.category !== 'done');
  const workInProgress = report.statuses
    .filter(status => status.category === 'doing')
    .reduce((total, status) => total + status.issue_count, 0);
  const largestQueue = openStatuses.reduce<IFlowStatus | null>(
    (largest, status) =>
      status.issue_count > 0 && (!largest || status.issue_count > largest.issue_count)
        ? status
        : largest,
    null
  );
  const throughputDelta = report.throughput_count - report.previous_throughput_count;

  return [
    {
      key: 'wip',
      label: t('reportsWorkInProgress', { defaultValue: 'Work in progress' }),
      value: workInProgress,
      note: t('reportsWorkInProgressNote', { defaultValue: 'Issues in progress statuses' }),
    },
    {
      key: 'queue',
      label: t('reportsLargestQueue', { defaultValue: 'Largest queue' }),
      value: largestQueue?.name ?? EMPTY_VALUE,
      note: largestQueue
        ? t('reportsIssueCount', {
            defaultValue: '{{count}} issues',
            count: largestQueue.issue_count,
          })
        : t('reportsNoOpenIssues', { defaultValue: 'No open issues' }),
    },
    {
      key: 'blocked',
      label: t('reportsBlocked', { defaultValue: 'Blocked' }),
      value: report.blocked_count,
      note:
        report.blocked_count > 0
          ? t('reportsBlockedNote', { defaultValue: 'Needs attention' })
          : t('reportsNothingBlocked', { defaultValue: 'Nothing blocked' }),
      noteTone: report.blocked_count > 0 ? 'danger' : 'default',
    },
    {
      key: 'throughput',
      label: t('reportsThroughput', { defaultValue: 'Throughput' }),
      value: report.throughput_count,
      note:
        throughputDelta === 0
          ? t('reportsThroughputNote', {
              defaultValue: 'Issues done in the last {{days}} days',
              days: report.throughput_days,
            })
          : t('reportsThroughputDelta', {
              defaultValue: '{{delta}} vs previous {{days}} days',
              delta: throughputDelta > 0 ? `+${throughputDelta}` : String(throughputDelta),
              days: report.throughput_days,
            }),
      noteTone: throughputDelta > 0 ? 'success' : throughputDelta < 0 ? 'warning' : 'default',
    },
  ];
};
