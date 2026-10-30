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
import type { ProjectHealthRow } from '@/types/reporting/analytics-project-health.types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

export interface ProjectHealthChartHandle {
  toPngDataUrl: () => string | null;
  toSvgMarkup: () => string | null;
}

interface ProjectHealthChartProps {
  projects: ProjectHealthRow[];
}

const PROGRESS_COLOR = '#1890ff';
const BUDGET_COLOR = '#fa8c16';

const shortLabel = (name: string, max = 14): string => {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
};

export const ProjectHealthChart = forwardRef<ProjectHealthChartHandle, ProjectHealthChartProps>(
  ({ projects }, ref) => {
    const { t } = useTranslation('reporting-analytics');
    const { token } = theme.useToken();
    const chartTheme = getChartTheme(token);
    const chartRef = useRef<ChartJS<'bar'>>(null);

    useImperativeHandle(ref, () => ({
      toPngDataUrl: () => chartToPngDataUrl(chartRef.current, token.colorBgContainer),
      toSvgMarkup: () =>
        chartToSvgMarkup(
          chartRef.current,
          t('projectHealth', { defaultValue: 'Project Health' }),
          token.colorBgContainer
        ),
    }));

    const chartData = useMemo((): ChartData<'bar'> => {
      return {
        labels: projects.map(p => shortLabel(p.project_name)),
        datasets: [
          {
            label: t('phLegendProgress', { defaultValue: 'Progress %' }),
            data: projects.map(p => p.progress_pct),
            backgroundColor: PROGRESS_COLOR,
            borderRadius: 3,
            maxBarThickness: 28,
          },
          {
            label: t('phLegendBudget', { defaultValue: 'Budget used %' }),
            data: projects.map(p => p.budget_used_pct),
            backgroundColor: BUDGET_COLOR,
            borderRadius: 3,
            maxBarThickness: 28,
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
                return `${label}: ${value}%`;
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
            suggestedMax: 100,
            ticks: {
              ...base.scales?.y?.ticks,
              callback: value => `${value}%`,
            },
          },
        },
      };
    }, [chartTheme, projects]);

    if (projects.length === 0) {
      return (
        <InChartEmptyState
          message={t('phChartEmpty', { defaultValue: 'No projects match these filters.' })}
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

ProjectHealthChart.displayName = 'ProjectHealthChart';
