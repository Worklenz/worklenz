import React, { useMemo } from 'react';
import { ArcElement, Chart as ChartJS, Legend, Tooltip, type ChartOptions } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { Badge, Flex, Typography, theme } from '@/shared/antd-imports';
import { ALPHA_CHANNEL } from '@/shared/constants';
import { InChartEmptyState } from '../states/ReportStateViews';
import type {
  ProjectHealthKpis,
  ProjectHealthRow,
  ProjectHealthTone,
} from '@/types/reporting/analytics-project-health.types';

ChartJS.register(ArcElement, Legend, Tooltip);

const { Text } = Typography;

interface ProjectHealthDonutChartProps {
  projects: ProjectHealthRow[];
  kpis: ProjectHealthKpis;
}

interface HealthSlice {
  tone: ProjectHealthTone;
  labelKey: string;
  defaultLabel: string;
  color: string;
  count: number;
}

const DEFAULT_COLORS: Record<ProjectHealthTone, string> = {
  on_track: '#75c997',
  at_risk: '#f37070',
  off_track: '#fbc84c',
  not_set: '#a9a9a9',
};

const TONE_META: Record<
  ProjectHealthTone,
  { labelKey: string; defaultLabel: string }
> = {
  on_track: { labelKey: 'statOnTrack', defaultLabel: 'On track' },
  at_risk: { labelKey: 'statAtRisk', defaultLabel: 'At risk' },
  off_track: { labelKey: 'statOffTrack', defaultLabel: 'Off track' },
  not_set: { labelKey: 'phHealthNotSet', defaultLabel: 'Not set' },
};

const TONE_ORDER: ProjectHealthTone[] = ['on_track', 'at_risk', 'off_track', 'not_set'];

const resolveColor = (row: ProjectHealthRow): string => {
  const raw = (row.health_color || '').trim();
  if (raw) {
    return raw.startsWith('#') ? raw : `#${raw}`;
  }
  return DEFAULT_COLORS[row.health_tone];
};

export const ProjectHealthDonutChart: React.FC<ProjectHealthDonutChartProps> = ({
  projects,
  kpis,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();

  const slices = useMemo((): HealthSlice[] => {
    const colorByTone = new Map<ProjectHealthTone, string>();
    for (const project of projects) {
      if (!colorByTone.has(project.health_tone)) {
        colorByTone.set(project.health_tone, resolveColor(project));
      }
    }

    const counts: Record<ProjectHealthTone, number> = {
      on_track: kpis.on_track,
      at_risk: kpis.at_risk,
      off_track: kpis.off_track,
      not_set: kpis.not_set,
    };

    return TONE_ORDER.map(tone => ({
      tone,
      ...TONE_META[tone],
      color: colorByTone.get(tone) || DEFAULT_COLORS[tone],
      count: counts[tone],
    }));
  }, [projects, kpis]);

  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const visibleSlices = slices.filter(slice => slice.count > 0);

  const chartData = useMemo(
    () => ({
      labels: visibleSlices.map(slice =>
        t(slice.labelKey, { defaultValue: slice.defaultLabel })
      ),
      datasets: [
        {
          data: visibleSlices.map(slice => slice.count),
          backgroundColor: visibleSlices.map(slice => `${slice.color}${ALPHA_CHANNEL}`),
          borderColor: token.colorBgContainer,
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    }),
    [visibleSlices, t, token.colorBgContainer]
  );

  const options = useMemo((): ChartOptions<'doughnut'> => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        datalabels: { display: false },
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => {
              const value = Number(context.raw ?? 0);
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return t('phDonutTooltip', {
                defaultValue: '{{count}} projects ({{pct}}%)',
                count: value,
                pct,
              });
            },
          },
        },
      },
    };
  }, [t, total]);

  if (total === 0) {
    return (
      <InChartEmptyState
        message={t('phChartEmpty', { defaultValue: 'No projects match these filters.' })}
      />
    );
  }

  return (
    <div
      style={{
        width: '100%',
        minHeight: 280,
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
        {t('phDonutTitle', { defaultValue: 'Health status' })}
      </Text>
      <Flex gap={24} align="center" wrap="wrap">
        <div style={{ width: 180, height: 180, flexShrink: 0, position: 'relative' }}>
          <Doughnut data={chartData} options={options} />
          <Flex
            vertical
            align="center"
            justify="center"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}
          >
            <Text strong style={{ fontSize: 22, lineHeight: 1.1 }}>
              {total}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('statProjects', { defaultValue: 'projects' })}
            </Text>
          </Flex>
        </div>

        <Flex vertical gap={8} style={{ minWidth: 160, flex: 1 }}>
          {slices.map(slice => {
            const label = t(slice.labelKey, { defaultValue: slice.defaultLabel });
            return (
              <Flex key={slice.tone} gap={8} align="center" className="min-w-0">
                <Badge color={slice.color} className="shrink-0" />
                <Text ellipsis={{ tooltip: `${label} (${slice.count})` }} className="min-w-0 flex-1">
                  {label}
                </Text>
                <Text type="secondary" style={{ flexShrink: 0 }}>
                  {slice.count}
                </Text>
              </Flex>
            );
          })}
        </Flex>
      </Flex>
      <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
        {t('phDonutHint', {
          defaultValue: 'Based on health set in project settings',
        })}
      </Text>
    </div>
  );
};
