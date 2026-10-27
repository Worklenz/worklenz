import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type Plugin,
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
  VelocitySeriesPoint,
  VelocitySeriesResponse,
  VelocityViewBy,
} from '@/types/reporting/analytics-velocity.types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Legend,
  Tooltip
);

export interface VelocityChartHandle {
  toPngDataUrl: () => string | null;
  toSvgMarkup: () => string | null;
}

interface VelocityChartProps {
  series: VelocitySeriesPoint[];
  averageLine: VelocitySeriesResponse['average_line'];
  trendLine: VelocitySeriesResponse['trend_line'];
  viewBy: VelocityViewBy;
}

const STACK_PALETTE = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#eb2f96',
  '#13c2c2',
  '#722ed1',
  '#fa541c',
  '#2f54eb',
];

export const VelocityChart = forwardRef<VelocityChartHandle, VelocityChartProps>(
  ({ series, averageLine, trendLine, viewBy }, ref) => {
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
  <title>${t('velocity', { defaultValue: 'Velocity' })}</title>
  <image href="${png}" width="${width}" height="${height}" />
</svg>`;
      },
    }));

    const chartData = useMemo((): ChartData<'bar'> => {
      const labels = series.map(p => p.sprint_name);

      if (viewBy === 'member') {
        const memberIds = new Map<string, string>();
        series.forEach(p => {
          p.stacks?.forEach(s => memberIds.set(s.id, s.name));
        });
        const members = [...memberIds.entries()];
        const datasets: ChartData<'bar'>['datasets'] = members.map(([id, name], index) => ({
          type: 'bar' as const,
          label: name,
          data: series.map(p => p.stacks?.find(s => s.id === id)?.completed ?? 0),
          backgroundColor: STACK_PALETTE[index % STACK_PALETTE.length],
          stack: 'completed',
          maxBarThickness: 36,
          order: 2,
        }));

        datasets.push({
          type: 'line' as const,
          label: t('legendAverage', { defaultValue: 'Average' }),
          data: averageLine.map(p => p.value),
          borderColor: token.colorTextSecondary,
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: 0,
        } as never);

        if (trendLine) {
          datasets.push({
            type: 'line' as const,
            label: t('legendTrend', { defaultValue: 'Trend' }),
            data: trendLine.map(p => p.value),
            borderColor: token.colorWarning,
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1,
          } as never);
        }

        return { labels, datasets };
      }

      if (viewBy === 'team') {
        const teamIds = new Map<string, string>();
        series.forEach(p => {
          p.overlays?.forEach(o => teamIds.set(o.id, o.name));
        });
        const teams = [...teamIds.entries()];
        if (teams.length > 1) {
          const datasets: ChartData<'bar'>['datasets'] = teams.map(([id, name], index) => ({
            type: 'bar' as const,
            label: name,
            data: series.map(p => p.overlays?.find(o => o.id === id)?.completed ?? 0),
            backgroundColor: STACK_PALETTE[index % STACK_PALETTE.length],
            maxBarThickness: 28,
            order: 2,
          }));
          datasets.push({
            type: 'line' as const,
            label: t('legendAverage', { defaultValue: 'Average' }),
            data: averageLine.map(p => p.value),
            borderColor: token.colorTextSecondary,
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 0,
          } as never);
          return { labels, datasets };
        }
      }

      const datasets: ChartData<'bar'>['datasets'] = [
        {
          type: 'bar',
          label: t('legendCommitted', { defaultValue: 'Committed' }),
          data: series.map(p => p.committed),
          backgroundColor: chartTheme.mutedColor,
          borderRadius: 4,
          maxBarThickness: 28,
          order: 2,
        },
        {
          type: 'bar',
          label: t('legendCompleted', { defaultValue: 'Completed' }),
          data: series.map(p => p.completed),
          backgroundColor: chartTheme.primaryColor,
          borderRadius: 4,
          maxBarThickness: 28,
          order: 2,
        },
        {
          type: 'line' as never,
          label: t('legendAverage', { defaultValue: 'Average' }),
          data: averageLine.map(p => p.value),
          borderColor: token.colorTextSecondary,
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: 0,
        } as never,
      ];

      if (trendLine) {
        datasets.push({
          type: 'line' as never,
          label: t('legendTrend', { defaultValue: 'Trend' }),
          data: trendLine.map(p => p.value),
          borderColor: token.colorWarning,
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: 1,
        } as never);
      }

      return { labels, datasets };
    }, [series, averageLine, trendLine, viewBy, t, token, chartTheme]);

    const commitmentPlugin = useMemo((): Plugin<'bar'> => {
      return {
        id: 'velocityCommitmentTooltip',
      };
    }, []);

    const options = useMemo((): ChartOptions<'bar'> => {
      const base = getBaseChartOptions(chartTheme);
      return {
        ...base,
        plugins: {
          ...base.plugins,
          tooltip: {
            ...base.plugins?.tooltip,
            callbacks: {
              afterBody: items => {
                const index = items[0]?.dataIndex;
                if (index === undefined) return [];
                const point = series[index];
                if (!point || point.commitment_accuracy === null) return [];
                return [
                  t('tooltipCommitment', {
                    defaultValue: 'Commitment: {{value}}%',
                    value: Math.round(point.commitment_accuracy),
                  }),
                ];
              },
            },
          },
        },
        scales: {
          ...base.scales,
          x: {
            ...base.scales?.x,
            stacked: viewBy === 'member',
          },
          y: {
            ...base.scales?.y,
            stacked: viewBy === 'member',
            beginAtZero: true,
          },
        },
      } as ChartOptions<'bar'>;
    }, [chartTheme, series, t, viewBy]);

    if (!series.length) {
      return (
        <InChartEmptyState
          message={t('velocityChartEmpty', {
            defaultValue: 'No completed sprints match these filters.',
          })}
        />
      );
    }

    return (
      <div style={{ height: 360, width: '100%' }}>
        <Chart
          ref={chartRef as never}
          type="bar"
          data={chartData}
          options={options}
          plugins={[commitmentPlugin]}
          aria-label={t('velocity', { defaultValue: 'Velocity' })}
          role="img"
        />
      </div>
    );
  }
);

VelocityChart.displayName = 'VelocityChart';
