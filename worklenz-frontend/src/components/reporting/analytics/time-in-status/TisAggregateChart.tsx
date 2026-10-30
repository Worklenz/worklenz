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
import {
  chartToPngDataUrl,
  chartToSvgMarkup,
} from '@/lib/reporting/chart-export';
import { InChartEmptyState } from '../states/ReportStateViews';
import type { TimeInStatusAggregateRow } from '@/types/reporting/analytics-time-in-status.types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

export interface TisAggregateChartHandle {
  toPngDataUrl: () => string | null;
  toSvgMarkup: () => string | null;
}

interface TisAggregateChartProps {
  rows: TimeInStatusAggregateRow[];
}

const FALLBACK = '#1890ff';
const OUTLIER_RED = '#ff4d4f';

function hexOrFallback(color: string | null, fallback: string): string {
  if (!color) return fallback;
  return color.startsWith('#') ? color : `#${color}`;
}

export const TisAggregateChart = forwardRef<TisAggregateChartHandle, TisAggregateChartProps>(
  ({ rows }, ref) => {
    const { t } = useTranslation('reporting-analytics');
    const { token } = theme.useToken();
    const chartTheme = getChartTheme(token);
    const chartRef = useRef<ChartJS<'bar'>>(null);

    useImperativeHandle(ref, () => ({
          toPngDataUrl: () => chartToPngDataUrl(chartRef.current, token.colorBgContainer),
    toSvgMarkup: () =>
      chartToSvgMarkup(
        chartRef.current,
        t('timeInStatus', { defaultValue: 'Time in Status' }),
        token.colorBgContainer
      ),
    }));

    const chartData: ChartData<'bar'> = useMemo(() => {
      const labels = rows.map(r => r.status_name);
      return {
        labels,
        datasets: [
          {
            label: t('tisColAvgDays', { defaultValue: 'Avg days' }),
            data: rows.map(r => r.avg_days),
            backgroundColor: rows.map(r => hexOrFallback(r.color, FALLBACK)),
            borderRadius: 4,
            barThickness: 18,
          },
        ],
      };
    }, [rows, t]);

    const options: ChartOptions<'bar'> = useMemo(() => {
      const base = getBaseChartOptions(chartTheme);
      return {
        ...base,
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...base.plugins,
          legend: { display: false },
          tooltip: {
            ...base.plugins?.tooltip,
            callbacks: {
              label: ctx => {
                const row = rows[ctx.dataIndex];
                if (!row) return '';
                return [
                  `${t('tisColAvgDays', { defaultValue: 'Avg days' })}: ${row.avg_days}`,
                  `${t('tisColMedianDays', { defaultValue: 'Median days' })}: ${row.median_days}`,
                  `${t('tisColCount', { defaultValue: 'Count' })}: ${row.count}`,
                  `${t('tisColPctCycle', { defaultValue: '% cycle time' })}: ${row.pct_cycle_time}%`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            ...base.scales?.x,
            title: {
              display: true,
              text: t('tisAxisDays', { defaultValue: 'Days' }),
              color: chartTheme.textColor,
            },
            beginAtZero: true,
          },
          y: {
            ...base.scales?.y,
            ticks: {
              ...base.scales?.y?.ticks,
              autoSkip: false,
            },
          },
        },
      };
    }, [chartTheme, rows, t]);

    if (rows.length === 0) {
      return (
        <InChartEmptyState
          message={t('tisChartEmpty', {
            defaultValue: 'No status duration data for these filters.',
          })}
        />
      );
    }

    const height = Math.max(280, rows.length * 36 + 48);

    return (
      <div style={{ height, width: '100%' }} data-outlier-accent={OUTLIER_RED}>
        <Chart ref={chartRef} type="bar" data={chartData} options={options} />
      </div>
    );
  }
);

TisAggregateChart.displayName = 'TisAggregateChart';
