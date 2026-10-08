import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Bar, Line } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartOptions,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import {
  Col,
  Empty,
  Flex,
  InfoCircleOutlined,
  Row,
  Select,
  Tag,
  Tooltip as AntTooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';

import { softwareReportsApiService } from '@/api/software-reports/software-reports.api.service';
import { useSoftwareReport } from '@/hooks/useSoftwareReport';
import {
  ISprintBurndownPoint,
  ISprintReport,
  ISprintReportSummary,
} from '@/types/project/softwareReports.types';
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
  formatDuration,
  formatPoints,
  formatShortDate,
  getBaseChartOptions,
  getChartTheme,
  getCycleDeltaNote,
  getPercentage,
  roundToOneDecimal,
} from './report-utils';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

interface SprintReportViewProps {
  projectId: string;
}

export const SprintReportView = ({ projectId }: SprintReportViewProps) => {
  const { t } = useTranslation('project-view');
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const { data, isLoading, hasError, reload } = useSoftwareReport<ISprintReport>(
    `${projectId}:${selectedSprintId ?? 'current'}`,
    () => softwareReportsApiService.getSprintReport(projectId, selectedSprintId)
  );

  if (hasError && !data) return <ReportError onRetry={reload} />;
  if (!data) return <ReportLoading />;

  if (!data.sprint) {
    return (
      <Empty
        className="py-12"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Flex vertical gap={2}>
            <strong>{t('reportsNoSprintTitle', { defaultValue: 'No started sprints yet' })}</strong>
            <Typography.Text type="secondary" className="text-xs">
              {t('reportsNoSprintHint', {
                defaultValue: 'Start a sprint from the Backlog to see progress, burndown and velocity.',
              })}
            </Typography.Text>
          </Flex>
        }
      />
    );
  }

  const sprint = data.sprint;
  const sprintOptions = data.sprints.map(option => ({
    value: option.id,
    label:
      option.sprint_status === 'active'
        ? t('reportsActiveSprintOption', { defaultValue: '{{name}} (active)', name: option.name })
        : option.name,
  }));

  return (
    <Flex vertical gap={12} className={isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <Flex align="center" gap={8} wrap="wrap">
        <Select
          size="small"
          value={sprint.id}
          options={sprintOptions}
          onChange={setSelectedSprintId}
          className="min-w-[200px]"
          aria-label={t('reportsSprintSelector', { defaultValue: 'Select sprint' })}
          popupMatchSelectWidth={false}
        />
        <Typography.Text type="secondary" className="text-xs">
          {getSprintDateRange(t, sprint)}
        </Typography.Text>
        {sprint.sprint_goal && (
          <Typography.Text type="secondary" className="text-xs truncate max-w-full">
            {t('reportsSprintGoal', { defaultValue: 'Goal: {{goal}}', goal: sprint.sprint_goal })}
          </Typography.Text>
        )}
      </Flex>

      <ReportStatGrid stats={buildSprintStats(t, data, sprint)} />

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={14}>
          <ReportPanel
            title={t('reportsBurndownTitle', { defaultValue: 'Sprint burndown' })}
            extra={
              <Typography.Text type="secondary" className="text-xs">
                {t('reportsStoryPointsUnit', { defaultValue: 'Story points' })}
              </Typography.Text>
            }
          >
            <BurndownChart points={data.burndown} />
          </ReportPanel>
        </Col>
        <Col xs={24} lg={10}>
          <ReportPanel title={t('reportsVelocityTitle', { defaultValue: 'Velocity' })}>
            <VelocityChart report={data} />
          </ReportPanel>
        </Col>
      </Row>
    </Flex>
  );
};

const BurndownChart = ({ points }: { points: ISprintBurndownPoint[] }) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const chartTheme = getChartTheme(token);

  const chartData = useMemo(
    () => ({
      labels: points.map(point => formatShortDate(point.date)),
      datasets: [
        {
          label: t('reportsIdealLine', { defaultValue: 'Ideal' }),
          data: points.map(point => roundToOneDecimal(point.ideal)),
          borderColor: chartTheme.mutedColor,
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
        },
        {
          label: t('reportsActualLine', { defaultValue: 'Remaining' }),
          data: points.map(point => point.remaining),
          borderColor: chartTheme.primaryColor,
          backgroundColor: chartTheme.primaryColor,
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.2,
          spanGaps: false,
        },
        {
          label: t('reportsScopeAddedMarker', { defaultValue: 'Scope added' }),
          data: points.map(point => (point.scope_added > 0 ? point.remaining : null)),
          borderColor: chartTheme.warningColor,
          backgroundColor: chartTheme.warningColor,
          showLine: false,
          pointStyle: 'triangle' as const,
          pointRadius: 7,
          pointHoverRadius: 8,
        },
      ],
    }),
    [points, t, chartTheme.mutedColor, chartTheme.primaryColor, chartTheme.warningColor]
  );

  if (!points.length) {
    return (
      <ReportChartEmpty
        description={t('reportsBurndownEmpty', {
          defaultValue: 'Set sprint dates to see the burndown.',
        })}
      />
    );
  }

  const options: ChartOptions<'line'> = {
    ...getBaseChartOptions(chartTheme),
    plugins: {
      ...getBaseChartOptions(chartTheme).plugins,
      tooltip: {
        callbacks: {
          label: context => {
            if (context.datasetIndex === SCOPE_DATASET_INDEX) {
              return t('reportsScopeAddedTooltip', {
                defaultValue: 'Scope added: +{{points}} points',
                points: formatPoints(points[context.dataIndex]?.scope_added ?? 0),
              });
            }
            return `${context.dataset.label}: ${context.formattedValue}`;
          },
        },
      },
    },
  };

  return (
    <ReportChartArea>
      <Line
        data={chartData}
        options={options}
        aria-label={t('reportsBurndownTitle', { defaultValue: 'Sprint burndown' })}
        role="img"
      />
    </ReportChartArea>
  );
};

const VelocityChart = ({ report }: { report: ISprintReport }) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const chartTheme = getChartTheme(token);

  if (!report.velocity.length) {
    return (
      <ReportChartEmpty
        description={t('reportsVelocityEmpty', {
          defaultValue: 'Complete sprints to compare committed and completed points.',
        })}
      />
    );
  }

  const chartData = {
    labels: report.velocity.map(point => point.name),
    datasets: [
      {
        label: t('reportsCommittedLegend', { defaultValue: 'Committed' }),
        data: report.velocity.map(point => point.committed_points),
        backgroundColor: chartTheme.mutedColor,
        borderRadius: 4,
        maxBarThickness: 28,
      },
      {
        label: t('reportsCompletedLegend', { defaultValue: 'Completed' }),
        data: report.velocity.map(point => point.completed_points),
        backgroundColor: chartTheme.primaryColor,
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  };

  return (
    <ReportChartArea>
      <Bar
        data={chartData}
        options={getBaseChartOptions(chartTheme) as ChartOptions<'bar'>}
        aria-label={t('reportsVelocityTitle', { defaultValue: 'Velocity' })}
        role="img"
      />
    </ReportChartArea>
  );
};

const buildSprintStats = (
  t: TFunction,
  report: ISprintReport,
  sprint: ISprintReportSummary
): ReportStat[] => {
  const hasPoints = sprint.total_points > 0;
  const progress = hasPoints
    ? getPercentage(sprint.done_points, sprint.total_points)
    : getPercentage(sprint.done_issue_count, sprint.issue_count);

  return [
    {
      key: 'progress',
      label: t('reportsSprintProgress', { defaultValue: 'Sprint progress' }),
      value: `${progress}%`,
      ...getPaceNote(t, report, sprint),
    },
    {
      key: 'committed',
      label: t('reportsCommittedCompleted', { defaultValue: 'Committed / completed' }),
      value: (
        <Flex align="center" gap={6}>
          {`${formatPoints(sprint.committed_points)} / ${formatPoints(sprint.done_points)}`}
          {sprint.is_committed_estimated && (
            <AntTooltip
              title={t('reportsCommittedEstimatedHint', {
                defaultValue:
                  'This sprint started before scope tracking, so committed points are estimated from its current scope.',
              })}
            >
              <Tag className="text-[11px] font-normal m-0">
                <InfoCircleOutlined className="mr-1" />
                {t('reportsEstimated', { defaultValue: 'Estimated' })}
              </Tag>
            </AntTooltip>
          )}
        </Flex>
      ),
      note:
        sprint.scope_added_points > 0
          ? t('reportsScopeAddedNote', {
              defaultValue: '+{{points}} points after start',
              points: formatPoints(sprint.scope_added_points),
            })
          : t('reportsNoScopeAdded', { defaultValue: 'No scope added after start' }),
      noteTone: sprint.scope_added_points > 0 ? 'warning' : 'default',
    },
    {
      key: 'bugs',
      label: t('reportsOpenBugs', { defaultValue: 'Open bugs' }),
      value: sprint.open_bug_count,
      note: t('reportsCriticalBugs', {
        defaultValue: '{{count}} critical',
        count: sprint.open_critical_bug_count,
      }),
      noteTone: sprint.open_critical_bug_count > 0 ? 'danger' : 'default',
    },
    {
      key: 'cycle',
      label: t('reportsMedianCycleTime', { defaultValue: 'Median cycle time' }),
      value: formatDuration(t, report.median_cycle_days),
      ...getCycleDeltaNote(t, report.median_cycle_days, report.previous_median_cycle_days),
    },
  ];
};

const getPaceNote = (
  t: TFunction,
  report: ISprintReport,
  sprint: ISprintReportSummary
): Pick<ReportStat, 'note' | 'noteTone'> => {
  if (sprint.sprint_status === 'completed') {
    return {
      note: t('reportsSprintCompletedOn', {
        defaultValue: 'Completed {{date}}',
        date: formatShortDate(sprint.completed_at ?? sprint.end_date),
      }),
    };
  }

  const today = [...report.burndown].reverse().find(point => point.remaining !== null);
  if (!today || today.remaining === null) {
    return {
      note: t('reportsIssuesDone', {
        defaultValue: '{{done}} of {{total}} issues done',
        done: sprint.done_issue_count,
        total: sprint.issue_count,
      }),
    };
  }

  const isBehind = today.remaining > today.ideal + PACE_TOLERANCE_POINTS;
  return isBehind
    ? { note: t('reportsBehindPace', { defaultValue: 'Behind ideal pace' }), noteTone: 'warning' }
    : { note: t('reportsOnPace', { defaultValue: 'On or ahead of ideal pace' }), noteTone: 'success' };
};

const getSprintDateRange = (t: TFunction, sprint: ISprintReportSummary): string => {
  if (!sprint.start_date && !sprint.end_date) {
    return t('reportsNoSprintDates', { defaultValue: 'No sprint dates' });
  }
  return t('reportsSprintDateRange', {
    defaultValue: '{{start}} – {{end}}',
    start: formatShortDate(sprint.start_date),
    end: formatShortDate(sprint.end_date),
  });
};

const SCOPE_DATASET_INDEX = 2;
const PACE_TOLERANCE_POINTS = 0.01;
