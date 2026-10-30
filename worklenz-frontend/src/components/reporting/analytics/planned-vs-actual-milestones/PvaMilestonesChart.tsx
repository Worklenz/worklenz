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
import type { PlannedVsActualMilestonesRow } from '@/types/reporting/analytics-planned-vs-actual-milestones.types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

export interface PvaMilestonesChartHandle {
  toPngDataUrl: () => string | null;
  toSvgMarkup: () => string | null;
}

interface PvaMilestonesChartProps {
  milestones: PlannedVsActualMilestonesRow[];
}

/** Prototype color c4 — Days late */
const VARIANCE_COLOR = '#fa8c16';

const shortLabel = (name: string, max = 16): string => {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
};

export const PvaMilestonesChart = forwardRef<PvaMilestonesChartHandle, PvaMilestonesChartProps>(
  ({ milestones }, ref) => {
    const { t } = useTranslation('reporting-analytics');
    const { token } = theme.useToken();
    const chartTheme = getChartTheme(token);
    const chartRef = useRef<ChartJS<'bar'>>(null);

    useImperativeHandle(ref, () => ({
          toPngDataUrl: () => chartToPngDataUrl(chartRef.current, token.colorBgContainer),
    toSvgMarkup: () =>
      chartToSvgMarkup(
        chartRef.current,
        t('plannedVsActualMilestones', { defaultValue: 'Planned vs Actual: Milestones' }),
        token.colorBgContainer
      ),
    }));

    const chartData = useMemo((): ChartData<'bar'> => {
      return {
        labels: milestones.map(m => shortLabel(m.milestone_name)),
        datasets: [
          {
            label: t('pvaMsLegendDaysLate', { defaultValue: 'Days late' }),
            data: milestones.map(m => m.variance_days),
            backgroundColor: VARIANCE_COLOR,
            borderRadius: 3,
            maxBarThickness: 28,
          },
        ],
      };
    }, [milestones, t]);

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
                const row = milestones[index];
                if (!row) return '';
                return `${row.milestone_name} · ${row.project_name}`;
              },
              label: item => {
                const value = Number(item.raw ?? 0);
                return t('pvaMsTooltipVariance', {
                  defaultValue: 'Variance: {{days}} days',
                  days: value,
                });
              },
            },
          },
        },
        scales: {
          x: {
            ...base.scales?.x,
            ticks: {
              ...base.scales?.x?.ticks,
              maxRotation: 45,
              minRotation: 0,
            },
          },
          y: {
            ...base.scales?.y,
            ticks: {
              ...base.scales?.y?.ticks,
              precision: 0,
              callback: value => `${value}d`,
            },
          },
        },
      };
    }, [chartTheme, milestones, t]);

    if (milestones.length === 0) {
      return (
        <InChartEmptyState
          message={t('pvaMsChartEmpty', {
            defaultValue: 'No milestones match these filters.',
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

PvaMilestonesChart.displayName = 'PvaMilestonesChart';
