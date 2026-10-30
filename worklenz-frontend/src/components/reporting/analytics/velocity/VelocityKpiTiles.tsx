import React from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import type {
  VelocityBucket,
  VelocitySeriesResponse,
} from '@/types/reporting/analytics-velocity.types';
import { MetricCalcHint } from '../MetricCalcHint';
import './velocity-kpi-tiles.css';

interface VelocityKpiTilesProps {
  kpis: VelocitySeriesResponse['kpis'];
  metricLabel: string;
  bucket?: VelocityBucket;
}

const TONES = {
  primary: '#1890ff',
  success: '#52c41a',
  warn: '#faad14',
  muted: '#722ed1',
} as const;

export const VelocityKpiTiles: React.FC<VelocityKpiTilesProps> = ({
  kpis,
  metricLabel,
  bucket = 'sprint',
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const muted = token.colorTextSecondary;

  const perBucketSub =
    bucket === 'phase'
      ? t('kpiPointsPerPhase', {
          defaultValue: '{{metric}} per phase',
          metric: metricLabel,
        })
      : bucket === 'mixed'
        ? t('kpiPointsPerSprintOrPhase', {
            defaultValue: '{{metric}} per sprint/phase',
            metric: metricLabel,
          })
        : t('kpiPointsPerSprint', {
            defaultValue: '{{metric}} per sprint',
            metric: metricLabel,
          });

  const lastBucketLabel =
    bucket === 'phase'
      ? t('kpiLastPhase', { defaultValue: 'Last phase' })
      : bucket === 'mixed'
        ? t('kpiLastSprintOrPhase', { defaultValue: 'Last sprint/phase' })
        : t('kpiLastSprint', { defaultValue: 'Last sprint' });

  const countLabel =
    bucket === 'phase'
      ? t('kpiPhases', { defaultValue: 'Phases' })
      : bucket === 'mixed'
        ? t('kpiSprintsOrPhases', { defaultValue: 'Sprints / Phases' })
        : t('kpiSprints', { defaultValue: 'Sprints' });

  const tiles = [
    {
      key: 'avg',
      label: t('kpiAvgVelocity', { defaultValue: 'Avg velocity' }),
      value:
        kpis.completed_sprint_count > 0
          ? String(Math.round(kpis.avg_velocity * 10) / 10)
          : '—',
      sub: perBucketSub,
      tone: TONES.primary,
      tooltip: t('velCalcAvg', {
        defaultValue:
          'Average completed work per sprint/phase: sum of completed points (or tasks) ÷ number of completed buckets.',
      }),
    },
    {
      key: 'last',
      label: lastBucketLabel,
      value:
        kpis.last_sprint_velocity === null || kpis.last_sprint_velocity === undefined
          ? '—'
          : String(Math.round(kpis.last_sprint_velocity * 10) / 10),
      sub: '\u00a0',
      tone: TONES.success,
      tooltip: t('velCalcLast', {
        defaultValue: 'Completed work in the most recent completed sprint or phase.',
      }),
    },
    {
      key: 'commitment',
      label: t('kpiCommitmentMet', { defaultValue: 'Commitment met' }),
      value:
        kpis.commitment_accuracy_pct === null || kpis.commitment_accuracy_pct === undefined
          ? '—'
          : `${Math.round(kpis.commitment_accuracy_pct)}%`,
      sub: '\u00a0',
      tone: TONES.warn,
      tooltip: t('velCalcCommitment', {
        defaultValue:
          'Average of (completed ÷ committed) × 100 across completed sprints/phases with a commitment.',
      }),
    },
    {
      key: 'sprints',
      label: countLabel,
      value: String(kpis.completed_sprint_count),
      sub: '\u00a0',
      tone: TONES.muted,
      tooltip: t('velCalcCount', {
        defaultValue: 'Number of completed sprints or phases included in this report.',
      }),
    },
  ];

  return (
    <div className="velocity-kpi-tiles">
      {tiles.map(tile => (
        <div
          key={tile.key}
          className="velocity-kpi-tile"
          style={{
            borderColor,
            background: token.colorBgContainer,
            color: token.colorText,
          }}
        >
          <div className="velocity-kpi-tile__label" style={{ color: muted }}>
            <span className="velocity-kpi-tile__dot" style={{ background: tile.tone }} />
            <span>{tile.label}</span>
            <MetricCalcHint title={tile.tooltip} color={muted} />
          </div>
          <div className="velocity-kpi-tile__value">{tile.value}</div>
          <div className="velocity-kpi-tile__sub" style={{ color: muted }}>
            {tile.sub}
          </div>
        </div>
      ))}
    </div>
  );
};
