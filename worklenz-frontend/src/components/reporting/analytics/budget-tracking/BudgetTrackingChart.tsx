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
import type { BudgetTrackingRow } from '@/types/reporting/analytics-budget-tracking.types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

export interface BudgetTrackingChartHandle {
  toPngDataUrl: () => string | null;
  toSvgMarkup: () => string | null;
}

interface BudgetTrackingChartProps {
  projects: BudgetTrackingRow[];
}

const BUDGET_COLOR = '#1890ff';
const SPENT_COLOR = '#eb2f96';

const shortLabel = (name: string, max = 16): string => {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
};

const fmtMoney = (value: number, currency = 'USD'): string =>
  `${currency.toUpperCase()} ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)}`;

export const BudgetTrackingChart = forwardRef<
  BudgetTrackingChartHandle,
  BudgetTrackingChartProps
>(({ projects }, ref) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const chartTheme = getChartTheme(token);
  const chartRef = useRef<ChartJS<'bar'>>(null);

  // Show every project passed from the page (selected / latest-20 set),
  // including zero-budget rows so the chart matches the Projects filter.
  const chartProjects = projects;

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
  <title>${t('budgetTracking', { defaultValue: 'Budget Tracking' })}</title>
  <image href="${png}" width="${width}" height="${height}" />
</svg>`;
    },
  }));

  const chartData = useMemo((): ChartData<'bar'> => {
    return {
      labels: chartProjects.map(p => shortLabel(p.project_name)),
      datasets: [
        {
          label: t('btLegendBudget', { defaultValue: 'Budget' }),
          data: chartProjects.map(p => p.budget),
          backgroundColor: BUDGET_COLOR,
          borderRadius: 3,
          maxBarThickness: 28,
        },
        {
          label: t('btLegendSpent', { defaultValue: 'Spent' }),
          data: chartProjects.map(p => p.spent),
          backgroundColor: SPENT_COLOR,
          borderRadius: 3,
          maxBarThickness: 28,
        },
      ],
    };
  }, [chartProjects, t]);

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
              return chartProjects[index]?.project_name ?? '';
            },
            label: item => {
              const label = item.dataset.label ?? '';
              const value = Number(item.raw ?? 0);
              const currency = chartProjects[item.dataIndex]?.currency || 'USD';
              return `${label}: ${fmtMoney(value, currency)}`;
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
            text: t('btAxisAmount', { defaultValue: 'Amount' }),
            color: chartTheme.textColor,
          },
        },
      },
    };
  }, [chartTheme, chartProjects, t]);

  if (chartProjects.length === 0) {
    return (
      <InChartEmptyState
        message={t('btChartEmpty', {
          defaultValue: 'No budget data matches these filters.',
        })}
      />
    );
  }

  return (
    <div style={{ height: 360, width: '100%' }}>
      <Chart ref={chartRef} type="bar" data={chartData} options={options} />
    </div>
  );
});

BudgetTrackingChart.displayName = 'BudgetTrackingChart';
