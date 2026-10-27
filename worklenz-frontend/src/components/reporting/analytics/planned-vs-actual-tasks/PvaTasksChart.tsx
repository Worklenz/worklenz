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
import type { PlannedVsActualTasksRow } from '@/types/reporting/analytics-planned-vs-actual-tasks.types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

export interface PvaTasksChartHandle {
  toPngDataUrl: () => string | null;
  toSvgMarkup: () => string | null;
}

interface PvaTasksChartProps {
  projects: PlannedVsActualTasksRow[];
}

/** Prototype colors: Planned c1, Completed c2, Overdue c5 */
const PLANNED_COLOR = '#1890ff';
const COMPLETED_COLOR = '#13c2c2';
const OVERDUE_COLOR = '#eb2f96';

const shortLabel = (name: string, max = 14): string => {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
};

export const PvaTasksChart = forwardRef<PvaTasksChartHandle, PvaTasksChartProps>(
  ({ projects }, ref) => {
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
  <title>${t('plannedVsActualTasks', { defaultValue: 'Planned vs Actual: Tasks' })}</title>
  <image href="${png}" width="${width}" height="${height}" />
</svg>`;
      },
    }));

    const chartData = useMemo((): ChartData<'bar'> => {
      return {
        labels: projects.map(p => shortLabel(p.project_name)),
        datasets: [
          {
            label: t('pvaTasksLegendPlanned', { defaultValue: 'Planned' }),
            data: projects.map(p => p.planned),
            backgroundColor: PLANNED_COLOR,
            borderRadius: 3,
            maxBarThickness: 24,
          },
          {
            label: t('pvaTasksLegendCompleted', { defaultValue: 'Completed' }),
            data: projects.map(p => p.completed),
            backgroundColor: COMPLETED_COLOR,
            borderRadius: 3,
            maxBarThickness: 24,
          },
          {
            label: t('pvaTasksLegendOverdue', { defaultValue: 'Overdue' }),
            data: projects.map(p => p.overdue),
            backgroundColor: OVERDUE_COLOR,
            borderRadius: 3,
            maxBarThickness: 24,
          },
        ],
      };
    }, [projects, t]);

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
                return projects[index]?.project_name ?? '';
              },
              label: item => {
                const label = item.dataset.label ?? '';
                const value = Number(item.raw ?? 0);
                return `${label}: ${value}`;
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
            ticks: {
              ...base.scales?.y?.ticks,
              precision: 0,
            },
          },
        },
      };
    }, [chartTheme, projects]);

    if (projects.length === 0) {
      return (
        <InChartEmptyState
          message={t('pvaTasksChartEmpty', {
            defaultValue: 'No projects match these filters.',
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

PvaTasksChart.displayName = 'PvaTasksChart';
