import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
  type Chart as ChartInstance,
  type ChartOptions,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import { useTranslation } from 'react-i18next';
import { Badge, Flex, Typography, theme } from '@/shared/antd-imports';
import { MetricCalcHint } from '../MetricCalcHint';
import { InChartEmptyState } from '../states/ReportStateViews';
import { PROJECT_HEALTH_TONE_COLORS } from './project-health-colors';
import type {
  ProjectHealthKpis,
  ProjectHealthTone,
} from '@/types/reporting/analytics-project-health.types';

ChartJS.register(ArcElement, Legend, Tooltip);

const { Text } = Typography;

export interface ProjectHealthDonutChartHandle {
  /** Captures chart body (center total, legend, hint). Topic title is drawn by the PDF. */
  toPngDataUrl: () => Promise<string | null>;
}

interface ProjectHealthDonutChartProps {
  kpis: ProjectHealthKpis;
}

interface HealthSlice {
  tone: ProjectHealthTone;
  labelKey: string;
  defaultLabel: string;
  color: string;
  count: number;
}

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

export const ProjectHealthDonutChart = forwardRef<
  ProjectHealthDonutChartHandle,
  ProjectHealthDonutChartProps
>(({ kpis }, ref) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const chartRef = useRef<ChartInstance<'doughnut'>>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    toPngDataUrl: async () => {
      const card = cardRef.current;
      if (!card) return null;

      // Export as a light card matching PDF (page may be in dark mode).
      const prev = {
        border: card.style.border,
        background: card.style.background,
        color: card.style.color,
      };
      card.style.border = 'none';
      card.style.background = '#ffffff';
      card.style.color = 'rgba(0,0,0,0.88)';

      // PDF draws "Health status" as the chart topic — hide the on-card title for capture.
      const hideEls = Array.from(
        card.querySelectorAll('[data-pdf-hide]')
      ) as HTMLElement[];
      const hidePrev = hideEls.map(el => ({ el, display: el.style.display }));
      hideEls.forEach(el => {
        el.style.display = 'none';
      });

      const texts = Array.from(card.querySelectorAll('.ant-typography')) as HTMLElement[];
      const textPrev = texts.map(el => ({
        el,
        color: el.style.color,
      }));
      texts.forEach(el => {
        const isSecondary = el.classList.contains('ant-typography-secondary');
        el.style.color = isSecondary ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.88)';
      });

      try {
        const canvas = await html2canvas(card, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });
        return canvas.toDataURL('image/png', 1);
      } catch {
        return null;
      } finally {
        card.style.border = prev.border;
        card.style.background = prev.background;
        card.style.color = prev.color;
        hidePrev.forEach(({ el, display }) => {
          el.style.display = display;
        });
        textPrev.forEach(({ el, color }) => {
          el.style.color = color;
        });
      }
    },
  }));

  const slices = useMemo((): HealthSlice[] => {
    const counts: Record<ProjectHealthTone, number> = {
      on_track: kpis.on_track,
      at_risk: kpis.at_risk,
      off_track: kpis.off_track,
      not_set: kpis.not_set,
    };

    return TONE_ORDER.map(tone => ({
      tone,
      ...TONE_META[tone],
      color: PROJECT_HEALTH_TONE_COLORS[tone],
      count: counts[tone],
    }));
  }, [kpis]);

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
          backgroundColor: visibleSlices.map(slice => slice.color),
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
      ref={cardRef}
      style={{
        width: '100%',
        minHeight: 280,
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <Flex align="center" gap={6} style={{ marginBottom: 12 }} data-pdf-hide>
        <Text strong style={{ fontSize: 14 }}>
          {t('phDonutTitle', { defaultValue: 'Health status' })}
        </Text>
        <MetricCalcHint
          title={t('phCalcHealthStatus', {
            defaultValue:
              'Distribution of selected projects by health setting: Good (On track), At Risk, Needs Attention (Off track), or Not set.',
          })}
          color={token.colorTextSecondary}
        />
      </Flex>
      <Flex gap={24} align="center" wrap="wrap">
        <div style={{ width: 180, height: 180, flexShrink: 0, position: 'relative' }}>
          <Doughnut ref={chartRef} data={chartData} options={options} />
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
                <Text
                  ellipsis={{ tooltip: `${label} (${slice.count})` }}
                  className="min-w-0 flex-1"
                  style={{ color: token.colorText }}
                >
                  {label}
                </Text>
                <Text style={{ flexShrink: 0, color: token.colorTextSecondary }}>
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
});

ProjectHealthDonutChart.displayName = 'ProjectHealthDonutChart';
