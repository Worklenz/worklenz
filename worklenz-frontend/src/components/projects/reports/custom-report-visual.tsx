import { useTranslation } from 'react-i18next';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  ArcElement,
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
import { Flex, Table, Typography, theme } from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';
import type { GlobalToken } from 'antd';

import {
  CustomReportGroup,
  CustomReportMetric,
  CustomReportSource,
  CustomReportVisualization,
  ICustomReportData,
} from '@/types/project/softwareReports.types';
import { ReportChartArea, ReportChartEmpty } from './report-parts';
import { formatReportValue, getGroupLabel, getMetricLabel, getRowLabel } from './custom-report-config';
import { getBaseChartOptions, getChartTheme } from './report-utils';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

interface CustomReportVisualProps {
  data: ICustomReportData;
  source: CustomReportSource;
  metric: CustomReportMetric;
  groupBy: CustomReportGroup;
  visualization: CustomReportVisualization;
}

/** Renders custom report results as the chosen chart, table or KPI. */
export const CustomReportVisual = ({
  data,
  source,
  metric,
  groupBy,
  visualization,
}: CustomReportVisualProps) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const metricLabel = getMetricLabel(t, metric, source);

  if (visualization === 'kpi') {
    return (
      <Flex vertical align="center" justify="center" className="h-[260px]" gap={4}>
        <Typography.Text type="secondary" className="text-xs">
          {metricLabel}
        </Typography.Text>
        <span className="text-5xl font-semibold" style={{ color: token.colorText }}>
          {formatReportValue(t, data.total, data.unit)}
        </span>
        <Typography.Text type="secondary" className="text-xs">
          {t('customReportKpiGroups', {
            defaultValue: 'Across {{count}} groups',
            count: data.rows.length,
          })}
        </Typography.Text>
      </Flex>
    );
  }

  if (!data.rows.length) {
    return (
      <ReportChartEmpty
        description={t('customReportNoData', { defaultValue: 'No data matches this report yet.' })}
      />
    );
  }

  const labels = data.rows.map(row => getRowLabel(t, row, groupBy));
  const values = data.rows.map(row => row.value);
  const formatValue = (value: number) => formatReportValue(t, value, data.unit);

  if (visualization === 'table') {
    const tableRows = data.rows.map((row, index) => ({
      key: row.key ?? `none-${index}`,
      label: labels[index],
      value: row.value,
    }));
    const columns: TableColumnsType<(typeof tableRows)[number]> = [
      { key: 'label', dataIndex: 'label', title: getGroupLabel(t, groupBy) },
      {
        key: 'value',
        dataIndex: 'value',
        title: metricLabel,
        align: 'right',
        width: 160,
        render: (value: number) => formatValue(value),
      },
    ];
    return (
      <Table
        size="small"
        columns={columns}
        dataSource={tableRows}
        pagination={false}
        scroll={{ y: 260 }}
      />
    );
  }

  const chartTheme = getChartTheme(token);
  const baseOptions = getBaseChartOptions(chartTheme);
  const colors = data.rows.map((row, index) => row.color || getPaletteColor(token, index));
  const tooltipLabel = (value: number, label: string) => `${label}: ${formatValue(value)}`;

  if (visualization === 'donut') {
    const options: ChartOptions<'doughnut'> = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: chartTheme.textColor,
            boxWidth: 12,
            usePointStyle: true,
            font: { family: chartTheme.fontFamily, size: 12 },
          },
        },
        tooltip: {
          callbacks: { label: context => tooltipLabel(Number(context.raw), context.label) },
        },
      },
    };
    return (
      <ReportChartArea>
        <Doughnut
          data={{
            labels,
            datasets: [
              { data: values, backgroundColor: colors, borderColor: token.colorBgContainer, borderWidth: 2 },
            ],
          }}
          options={options}
          aria-label={metricLabel}
          role="img"
        />
      </ReportChartArea>
    );
  }

  if (visualization === 'line') {
    const options: ChartOptions<'line'> = {
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        legend: { display: false },
        tooltip: {
          callbacks: { label: context => tooltipLabel(Number(context.raw), context.label) },
        },
      },
    };
    return (
      <ReportChartArea>
        <Line
          data={{
            labels,
            datasets: [
              {
                label: metricLabel,
                data: values,
                borderColor: chartTheme.primaryColor,
                backgroundColor: chartTheme.primaryColor,
                borderWidth: 2,
                pointRadius: 3,
                tension: 0.25,
              },
            ],
          }}
          options={options}
          aria-label={metricLabel}
          role="img"
        />
      </ReportChartArea>
    );
  }

  const barOptions: ChartOptions<'bar'> = {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      legend: { display: false },
      tooltip: {
        callbacks: { label: context => tooltipLabel(Number(context.raw), context.label) },
      },
    },
  };
  return (
    <ReportChartArea>
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: metricLabel,
              data: values,
              backgroundColor: colors,
              borderRadius: 4,
              maxBarThickness: 36,
            },
          ],
        }}
        options={barOptions}
        aria-label={metricLabel}
        role="img"
      />
    </ReportChartArea>
  );
};

const getPaletteColor = (token: GlobalToken, index: number): string => {
  const palette = [
    token.colorPrimary,
    token.colorSuccess,
    token.colorWarning,
    token.purple,
    token.cyan,
    token.magenta,
    token.orange,
    token.geekblue,
  ];
  return palette[index % palette.length];
};
