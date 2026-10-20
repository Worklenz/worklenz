import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  ChartOptions,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Flex, Tooltip as AntTooltip, Typography, theme } from '@/shared/antd-imports';

import { softwareReportsApiService } from '@/api/software-reports/software-reports.api.service';
import { useSoftwareReport } from '@/hooks/useSoftwareReport';
import { ICycleTimeReport, ICycleTimeTrendPoint } from '@/types/project/softwareReports.types';
import {
  ReportChartArea,
  ReportChartEmpty,
  ReportError,
  ReportLoading,
  ReportPanel,
  ReportStat,
  ReportStatGrid,
} from './report-parts';
import {
  EMPTY_VALUE,
  formatDuration,
  formatShortDate,
  getBaseChartOptions,
  getChartTheme,
  getCycleDeltaNote,
  roundToOneDecimal,
} from './report-utils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface CycleTimeReportViewProps {
  projectId: string;
}

export const CycleTimeReportView = ({ projectId }: CycleTimeReportViewProps) => {
  const { t } = useTranslation('project-view');
  const { data, isLoading, hasError, reload } = useSoftwareReport<ICycleTimeReport>(
    projectId,
    () => softwareReportsApiService.getCycleTimeReport(projectId)
  );

  if (hasError && !data) return <ReportError onRetry={reload} />;
  if (!data) return <ReportLoading />;

  return (
    <Flex vertical gap={12} className={isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <Typography.Text type="secondary" className="text-xs">
        {t('reportsCycleDefinition', {
          defaultValue: 'Cycle time is measured from when an issue first moves to in progress until it is done.',
        })}
      </Typography.Text>

      <ReportStatGrid stats={buildCycleStats(t, data)} />

      <ReportPanel
        title={t('reportsCycleTrendTitle', { defaultValue: 'Cycle time trend' })}
        extra={
          <Typography.Text type="secondary" className="text-xs">
            {t('reportsCycleTrendRange', { defaultValue: 'Weekly median, last 12 weeks' })}
          </Typography.Text>
        }
      >
        <CycleTrendChart trend={data.trend} />
      </ReportPanel>
    </Flex>
  );
};

const CycleTrendChart = ({ trend }: { trend: ICycleTimeTrendPoint[] }) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const chartTheme = getChartTheme(token);
  const baseOptions = getBaseChartOptions(chartTheme);

  if (!trend.length) {
    return (
      <ReportChartEmpty
        description={t('reportsCycleTrendEmpty', {
          defaultValue: 'Complete issues to see how cycle time changes over time.',
        })}
      />
    );
  }

  const chartData = {
    labels: trend.map(point =>
      t('reportsWeekOf', { defaultValue: 'Week of {{date}}', date: formatShortDate(point.week_start) })
    ),
    datasets: [
      {
        label: t('reportsMedianDaysLegend', { defaultValue: 'Median days' }),
        data: trend.map(point => roundToOneDecimal(point.median_days)),
        borderColor: chartTheme.primaryColor,
        backgroundColor: chartTheme.primaryColor,
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.25,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: context =>
            t('reportsCycleTrendTooltip', {
              defaultValue: 'Median {{value}} across {{count}} issues',
              value: formatDuration(t, trend[context.dataIndex]?.median_days),
              count: trend[context.dataIndex]?.issue_count ?? 0,
            }),
        },
      },
    },
    scales: {
      ...baseOptions.scales,
      y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, precision: 1 } },
    },
  };

  return (
    <ReportChartArea>
      <Line
        data={chartData}
        options={options}
        aria-label={t('reportsCycleTrendTitle', { defaultValue: 'Cycle time trend' })}
        role="img"
      />
    </ReportChartArea>
  );
};

const buildCycleStats = (t: TFunction, report: ICycleTimeReport): ReportStat[] => {
  const oldest = report.oldest_active_item;

  return [
    {
      key: 'median',
      label: t('reportsMedianCycleTime', { defaultValue: 'Median cycle time' }),
      value: formatDuration(t, report.median_cycle_days),
      ...getCycleDeltaNote(t, report.median_cycle_days, report.previous_median_cycle_days),
    },
    {
      key: 'p85',
      label: t('reportsP85CycleTime', { defaultValue: '85th percentile' }),
      value: formatDuration(t, report.p85_cycle_days),
      note: t('reportsCompletedLast30', {
        defaultValue: '{{count}} issues completed in 30 days',
        count: report.completed_count,
      }),
    },
    {
      key: 'oldest',
      label: t('reportsOldestActiveItem', { defaultValue: 'Oldest active item' }),
      value: oldest ? (
        <AntTooltip title={oldest.name}>
          <span>{oldest.task_key}</span>
        </AntTooltip>
      ) : (
        EMPTY_VALUE
      ),
      note: oldest
        ? t('reportsInProgressFor', {
            defaultValue: 'In progress for {{value}}',
            value: formatDuration(t, oldest.age_days),
          })
        : t('reportsNothingInProgress', { defaultValue: 'Nothing in progress' }),
      noteTone: oldest && oldest.age_days >= STALE_ITEM_DAYS ? 'warning' : 'default',
    },
    {
      key: 'reopened',
      label: t('reportsReopened', { defaultValue: 'Reopened' }),
      value: report.reopened_count,
      note: t('reportsLast30Days', { defaultValue: 'Last 30 days' }),
      noteTone: report.reopened_count > 0 ? 'warning' : 'default',
    },
  ];
};

const STALE_ITEM_DAYS = 10;
