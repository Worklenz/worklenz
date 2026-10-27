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
import type { UtilizationMemberRow } from '@/types/reporting/analytics-utilization.types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

export interface UtilizationChartHandle {
  toPngDataUrl: () => string | null;
  toSvgMarkup: () => string | null;
}

interface UtilizationChartProps {
  members: UtilizationMemberRow[];
}

/** Capacity = working hours; Logged = logged time */
const CAPACITY_COLOR = '#1890ff';
const LOGGED_COLOR = '#13c2c2';

const shortLabel = (name: string, max = 14): string => {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
};

const fmtHours = (value: number): string => `${Number(value.toFixed(1))}h`;

export const UtilizationChart = forwardRef<UtilizationChartHandle, UtilizationChartProps>(
  ({ members }, ref) => {
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
  <title>${t('utilization', { defaultValue: 'Utilization' })}</title>
  <image href="${png}" width="${width}" height="${height}" />
</svg>`;
      },
    }));

    const chartData = useMemo((): ChartData<'bar'> => {
      return {
        labels: members.map(m => shortLabel(m.member_name)),
        datasets: [
          {
            label: t('utilLegendCapacity', { defaultValue: 'Capacity' }),
            data: members.map(m => m.capacity_hours),
            backgroundColor: CAPACITY_COLOR,
            borderRadius: 3,
            maxBarThickness: 24,
          },
          {
            label: t('utilLegendLogged', { defaultValue: 'Logged' }),
            data: members.map(m => m.logged_hours),
            backgroundColor: LOGGED_COLOR,
            borderRadius: 3,
            maxBarThickness: 24,
          },
        ],
      };
    }, [members, t]);

    const options = useMemo((): ChartOptions<'bar'> => {
      const base = getBaseChartOptions(chartTheme);
      return {
        ...base,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...base.plugins,
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: chartTheme.textColor,
              usePointStyle: true,
              boxWidth: 8,
            },
          },
          tooltip: {
            ...base.plugins?.tooltip,
            callbacks: {
              title: items => {
                const index = items[0]?.dataIndex ?? 0;
                return members[index]?.member_name ?? '';
              },
              label: item => {
                const label = item.dataset.label ?? '';
                const value = Number(item.raw ?? 0);
                return `${label}: ${fmtHours(value)}`;
              },
              afterBody: tooltipItems => {
                const member = members[tooltipItems[0]?.dataIndex];
                if (!member) return [];
                return [
                  `${t('utilColUtilization', { defaultValue: 'Utilization' })}: ${member.utilization_pct}%`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            ...base.scales?.x,
            stacked: false,
            ticks: {
              ...base.scales?.x?.ticks,
              maxRotation: 45,
              minRotation: 0,
            },
          },
          y: {
            ...base.scales?.y,
            beginAtZero: true,
            title: {
              display: true,
              text: t('utilAxisHours', { defaultValue: 'Hours' }),
              color: chartTheme.textColor,
            },
            ticks: {
              ...base.scales?.y?.ticks,
              callback: value => `${value}h`,
            },
          },
        },
      };
    }, [chartTheme, members, t]);

    if (members.length === 0) {
      return (
        <InChartEmptyState
          message={t('utilChartEmpty', {
            defaultValue: 'No team members match these filters.',
          })}
        />
      );
    }

    return (
      <div style={{ height: 360, width: '100%' }}>
        <Chart ref={chartRef} type="bar" data={chartData} options={options} />
      </div>
    );
  }
);

UtilizationChart.displayName = 'UtilizationChart';
