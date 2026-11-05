import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
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
import {
  chartToPngDataUrl,
  chartToSvgMarkup,
} from '@/lib/reporting/chart-export';
import { InChartEmptyState } from '../states/ReportStateViews';
import type { CfdSeriesResponse, CfdStatusMeta } from '@/types/reporting/analytics-cfd.types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Legend,
  Tooltip
);

export interface CfdChartHandle {
  toPngDataUrl: () => string | null;
  toSvgMarkup: () => string | null;
}

interface CfdChartProps {
  data: CfdSeriesResponse;
  visibleStatusIds: string[];
  statusOrder: string[];
  breachedStatusIds: string[];
  showSprintOverlay: boolean;
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

const AMBER = 'rgba(250, 173, 20, 0.55)';

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return `rgba(24, 144, 255, ${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const CfdChart = forwardRef<CfdChartHandle, CfdChartProps>(
  ({ data, visibleStatusIds, statusOrder, breachedStatusIds, showSprintOverlay }, ref) => {
    const { t } = useTranslation('reporting-analytics');
    const { token } = theme.useToken();
    const chartTheme = getChartTheme(token);
    const chartRef = useRef<ChartJS<'line'>>(null);

    useImperativeHandle(ref, () => ({
          toPngDataUrl: () => chartToPngDataUrl(chartRef.current, token.colorBgContainer),
    toSvgMarkup: () =>
      chartToSvgMarkup(
        chartRef.current,
        t('cumulativeFlow', { defaultValue: 'Cumulative Flow' }),
        token.colorBgContainer
      ),
    }));

    const statusById = useMemo(() => {
      const map = new Map<string, CfdStatusMeta>();
      data.statuses.forEach(s => map.set(s.id, s));
      return map;
    }, [data.statuses]);

    const orderedVisible = useMemo(() => {
      const visible = new Set(visibleStatusIds);
      return statusOrder.filter(id => visible.has(id) && statusById.has(id));
    }, [statusOrder, visibleStatusIds, statusById]);

    const breached = useMemo(() => new Set(breachedStatusIds), [breachedStatusIds]);

    const chartData = useMemo((): ChartData<'line'> => {
      const byStatus = new Map<string, number[]>();
      data.series.forEach(row => {
        if (!orderedVisible.includes(row.status_id)) return;
        const existing = byStatus.get(row.status_id) ?? data.dates.map(() => 0);
        row.values.forEach((v, i) => {
          existing[i] += Number(v ?? 0);
        });
        byStatus.set(row.status_id, existing);
      });

      const datasets = orderedVisible.map((statusId, index) => {
        const status = statusById.get(statusId);
        const baseColor =
          status?.color || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
        const isBreached = breached.has(statusId);
        return {
          label: status?.name ?? statusId,
          data: byStatus.get(statusId) ?? data.dates.map(() => 0),
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: isBreached ? 2.5 : 1.5,
          borderColor: isBreached ? '#d48806' : baseColor,
          backgroundColor: isBreached ? AMBER : hexToRgba(baseColor, 0.45),
        };
      });

      return {
        labels: data.dates,
        datasets,
      };
    }, [data.dates, data.series, orderedVisible, statusById, breached]);

    const sprintPlugin = useMemo((): Plugin<'line'> => {
      return {
        id: 'cfdSprintOverlay',
        afterDraw(chart) {
          if (!showSprintOverlay || !data.sprints?.length) return;
          const { ctx, chartArea, scales } = chart;
          const xScale = scales.x;
          if (!xScale || !chartArea) return;

          ctx.save();
          ctx.strokeStyle = token.colorTextQuaternary;
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.font = `11px ${token.fontFamily}`;
          ctx.fillStyle = token.colorTextSecondary;

          data.sprints.forEach(sprint => {
            if (!sprint.start_date) return;
            const startDay = sprint.start_date.slice(0, 10);
            const weekStarts = data.meta.week_starts ?? [];
            let idx = data.dates.indexOf(startDay);
            if (idx < 0 && weekStarts.length > 0) {
              idx = weekStarts.findIndex((ws, i) => {
                const next = weekStarts[i + 1];
                return startDay >= ws && (!next || startDay < next);
              });
            }
            if (idx < 0) return;
            const x = xScale.getPixelForValue(idx);
            ctx.beginPath();
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.stroke();
            ctx.fillText(sprint.name, x + 4, chartArea.top + 12);
          });
          ctx.restore();
        },
      };
    }, [showSprintOverlay, data.sprints, data.dates, data.meta.week_starts, token]);

    const options = useMemo((): ChartOptions<'line'> => {
      const base = getBaseChartOptions(chartTheme);
      return {
        ...base,
        plugins: {
          ...base.plugins,
          legend: { display: false },
          tooltip: {
            callbacks: {
              footer: items => {
                const total = items.reduce((sum, item) => sum + Number(item.raw ?? 0), 0);
                return `${t('cfdTooltipTotal', { defaultValue: 'Total' })}: ${total}`;
              },
            },
          },
        },
        scales: {
          ...base.scales,
          x: {
            ...base.scales?.x,
            stacked: true,
            ticks: {
              ...base.scales?.x?.ticks,
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 12,
            },
          },
          y: {
            ...base.scales?.y,
            stacked: true,
            beginAtZero: true,
            ticks: {
              ...base.scales?.y?.ticks,
              precision: 0,
            },
          },
        },
      } as ChartOptions<'line'>;
    }, [chartTheme, t]);

    if (!data.dates.length || orderedVisible.length === 0) {
      return (
        <InChartEmptyState
          message={t('cfdChartEmpty', {
            defaultValue: 'No cumulative flow data for these filters.',
          })}
        />
      );
    }

    return (
      <div style={{ height: 420, width: '100%' }}>
        <Chart
          ref={chartRef as never}
          type="line"
          data={chartData}
          options={options}
          plugins={[sprintPlugin]}
          aria-label={t('cumulativeFlow', { defaultValue: 'Cumulative Flow' })}
          role="img"
        />
      </div>
    );
  }
);

CfdChart.displayName = 'CfdChart';
