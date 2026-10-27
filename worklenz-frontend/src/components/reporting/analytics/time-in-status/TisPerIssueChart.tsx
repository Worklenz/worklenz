import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Legend,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import {
  getBaseChartOptions,
  getChartTheme,
} from '@/components/projects/reports/report-utils';
import { InChartEmptyState } from '../states/ReportStateViews';
import type {
  TimeInStatusIssueRow,
  TimeInStatusStatusMeta,
} from '@/types/reporting/analytics-time-in-status.types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

export interface TisPerIssueChartHandle {
  toPngDataUrl: () => string | null;
  toSvgMarkup: () => string | null;
}

interface TisPerIssueChartProps {
  issues: TimeInStatusIssueRow[];
  statuses: TimeInStatusStatusMeta[];
}

const FALLBACK_PALETTE = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#eb2f96',
  '#13c2c2',
  '#722ed1',
  '#fa541c',
  '#2f54eb',
];
const OUTLIER_RED = 'rgba(255, 77, 79, 0.85)';

function hexOrFallback(color: string | null, index: number): string {
  if (color) return color.startsWith('#') ? color : `#${color}`;
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

export const TisPerIssueChart = forwardRef<TisPerIssueChartHandle, TisPerIssueChartProps>(
  ({ issues, statuses }, ref) => {
    const { t } = useTranslation('reporting-analytics');
    const { token } = theme.useToken();
    const chartTheme = getChartTheme(token);
    const chartRef = useRef<ChartJS<'bar'>>(null);

    useImperativeHandle(ref, () => ({
      toPngDataUrl: () => {
        const chart = chartRef.current;
        if (!chart) return null;
        return chart.toBase64Image('image/png', 1);
      },
      toSvgMarkup: () => {
        const chart = chartRef.current;
        if (!chart) return null;
        const png = chart.toBase64Image('image/png', 1);
        const width = chart.width || 800;
        const height = chart.height || 400;
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${t('timeInStatus', { defaultValue: 'Time in Status' })}</title>
  <image href="${png}" width="${width}" height="${height}" />
</svg>`;
      },
    }));

    const chartData: ChartData<'bar'> = useMemo(() => {
      const labels = issues.map(i => i.task_key || i.task_name);
      const datasets = statuses.map((status, idx) => ({
        label: status.name,
        data: issues.map(issue => {
          const seg = issue.segments.find(s => s.status_id === status.id);
          return seg?.days ?? 0;
        }),
        backgroundColor: issues.map(issue => {
          const seg = issue.segments.find(s => s.status_id === status.id);
          if (seg?.is_outlier) return OUTLIER_RED;
          return hexOrFallback(status.color, idx);
        }),
        stack: 'tis',
        barThickness: 14,
      }));
      return { labels, datasets };
    }, [issues, statuses]);

    const options: ChartOptions<'bar'> = useMemo(() => {
      const base = getBaseChartOptions(chartTheme);
      return {
        ...base,
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...base.plugins,
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: chartTheme.textColor, boxWidth: 12 },
          },
          tooltip: {
            ...base.plugins?.tooltip,
            callbacks: {
              afterBody: items => {
                const idx = items[0]?.dataIndex;
                if (idx === undefined) return [];
                const issue = issues[idx];
                if (!issue) return [];
                const lines = [
                  `${t('tisColTotalDays', { defaultValue: 'Total' })}: ${issue.total_days}`,
                ];
                if (issue.is_outlier) {
                  lines.push(
                    t('tisOutlierFlag', {
                      defaultValue: 'Outlier (> 1.5× status avg)',
                    })
                  );
                }
                return lines;
              },
            },
          },
        },
        scales: {
          x: {
            ...base.scales?.x,
            stacked: true,
            beginAtZero: true,
            title: {
              display: true,
              text: t('tisAxisDays', { defaultValue: 'Days' }),
              color: chartTheme.textColor,
            },
          },
          y: {
            ...base.scales?.y,
            stacked: true,
            ticks: {
              ...base.scales?.y?.ticks,
              autoSkip: false,
            },
          },
        },
      };
    }, [chartTheme, issues, t]);

    if (issues.length === 0) {
      return (
        <InChartEmptyState
          message={t('tisChartEmpty', {
            defaultValue: 'No status duration data for these filters.',
          })}
        />
      );
    }

    const height = Math.max(320, issues.length * 28 + 80);

    return (
      <div style={{ height, width: '100%' }}>
        <Chart ref={chartRef} type="bar" data={chartData} options={options} />
      </div>
    );
  }
);

TisPerIssueChart.displayName = 'TisPerIssueChart';
