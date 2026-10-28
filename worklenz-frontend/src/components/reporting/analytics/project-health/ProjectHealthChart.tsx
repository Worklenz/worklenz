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
import { Flex, Typography, theme } from '@/shared/antd-imports';
import {
  getBaseChartOptions,
  getChartTheme,
} from '@/components/projects/reports/report-utils';
import { InChartEmptyState } from '../states/ReportStateViews';
import type {
  ProjectHealthRow,
  ProjectHealthTone,
} from '@/types/reporting/analytics-project-health.types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

const { Text } = Typography;

export interface ProjectHealthChartHandle {
  toPngDataUrl: () => string | null;
  toSvgMarkup: () => string | null;
}

interface ProjectHealthChartProps {
  projects: ProjectHealthRow[];
}

const PROGRESS_FALLBACK = '#1890ff';
const BUDGET_COLOR = '#fa8c16';

const TONE_FALLBACK: Record<ProjectHealthTone, string> = {
  on_track: '#75c997',
  at_risk: '#f37070',
  off_track: '#fbc84c',
  not_set: '#a9a9a9',
};

const TONE_LABEL: Record<
  ProjectHealthTone,
  { key: string; defaultValue: string }
> = {
  on_track: { key: 'statOnTrack', defaultValue: 'On track' },
  at_risk: { key: 'statAtRisk', defaultValue: 'At risk' },
  off_track: { key: 'statOffTrack', defaultValue: 'Off track' },
  not_set: { key: 'phHealthNotSet', defaultValue: 'Not set' },
};

const shortLabel = (name: string, max = 14): string => {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
};

const resolveHealthColor = (row: ProjectHealthRow): string => {
  const raw = (row.health_color || '').trim();
  if (raw) {
    return raw.startsWith('#') ? raw : `#${raw}`;
  }
  return TONE_FALLBACK[row.health_tone] || PROGRESS_FALLBACK;
};

export const ProjectHealthChart = forwardRef<ProjectHealthChartHandle, ProjectHealthChartProps>(
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
  <title>${t('projectHealth', { defaultValue: 'Project Health' })}</title>
  <image href="${png}" width="${width}" height="${height}" />
</svg>`;
      },
    }));

    const healthLegend = useMemo(() => {
      const seen = new Map<ProjectHealthTone, string>();
      for (const project of projects) {
        if (!seen.has(project.health_tone)) {
          seen.set(project.health_tone, resolveHealthColor(project));
        }
      }
      const order: ProjectHealthTone[] = ['on_track', 'at_risk', 'off_track', 'not_set'];
      return order
        .filter(tone => seen.has(tone))
        .map(tone => ({
          tone,
          color: seen.get(tone) || TONE_FALLBACK[tone],
          ...TONE_LABEL[tone],
        }));
    }, [projects]);

    const chartData = useMemo((): ChartData<'bar'> => {
      return {
        labels: projects.map(p => shortLabel(p.project_name)),
        datasets: [
          {
            label: t('phLegendProgress', { defaultValue: 'Progress %' }),
            data: projects.map(p => p.progress_pct),
            // Progress bars use the manually set project health color from settings.
            backgroundColor: projects.map(p => resolveHealthColor(p)),
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
              generateLabels: chart => {
                const datasets = chart.data.datasets;
                return datasets.map((dataset, index) => {
                  const isProgress = index === 0;
                  const fill = isProgress
                    ? PROGRESS_FALLBACK
                    : typeof dataset.backgroundColor === 'string'
                      ? dataset.backgroundColor
                      : BUDGET_COLOR;
                  return {
                    text: dataset.label || '',
                    fillStyle: fill,
                    strokeStyle: fill,
                    hidden: !chart.isDatasetVisible(index),
                    datasetIndex: index,
                    pointStyle: 'circle' as const,
                  };
                });
              },
            },
          },
          tooltip: {
            ...base.plugins?.tooltip,
            callbacks: {
              title: items => {
                const index = items[0]?.dataIndex ?? 0;
                return projects[index]?.project_name ?? '';
              },
              beforeBody: items => {
                const index = items[0]?.dataIndex ?? 0;
                const row = projects[index];
                if (!row) return [];
                const toneMeta = TONE_LABEL[row.health_tone];
                const healthLabel =
                  row.health_name ||
                  t(toneMeta.key, { defaultValue: toneMeta.defaultValue });
                return [
                  `${t('phColHealth', { defaultValue: 'Health' })}: ${healthLabel}`,
                ];
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
    }, [chartTheme, projects, t]);

    if (projects.length === 0) {
      return (
        <InChartEmptyState
          message={t('phChartEmpty', { defaultValue: 'No projects match these filters.' })}
        />
      );
    }

    return (
      <div style={{ width: '100%' }}>
        <div style={{ height: 360, width: '100%' }}>
          <Chart ref={chartRef} type="bar" data={chartData} options={options} />
        </div>
        {healthLegend.length > 0 ? (
          <Flex
            wrap="wrap"
            gap={12}
            align="center"
            justify="center"
            style={{ marginTop: 4, paddingBottom: 4 }}
            aria-label={t('phHealthLegendAria', {
              defaultValue: 'Project health from project settings',
            })}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('phHealthLegend', { defaultValue: 'Health (from project settings):' })}
            </Text>
            {healthLegend.map(item => (
              <Flex key={item.tone} gap={6} align="center">
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: item.color,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <Text style={{ fontSize: 12 }}>
                  {t(item.key, { defaultValue: item.defaultValue })}
                </Text>
              </Flex>
            ))}
          </Flex>
        ) : null}
      </div>
    );
  }
);

ProjectHealthChart.displayName = 'ProjectHealthChart';
