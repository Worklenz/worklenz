import React from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { VelocitySeriesResponse } from '@/types/reporting/analytics-velocity.types';
import './velocity-kpi-tiles.css';

interface VelocityKpiTilesProps {
  kpis: VelocitySeriesResponse['kpis'];
  metricLabel: string;
}

const TONES = {
  primary: '#1890ff',
  success: '#52c41a',
  warn: '#faad14',
  muted: '#722ed1',
} as const;

export const VelocityKpiTiles: React.FC<VelocityKpiTilesProps> = ({ kpis, metricLabel }) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const muted = token.colorTextSecondary;

  const tiles = [
    {
      key: 'avg',
      label: t('kpiAvgVelocity', { defaultValue: 'Avg velocity' }),
      value:
        kpis.completed_sprint_count > 0
          ? String(Math.round(kpis.avg_velocity * 10) / 10)
          : '—',
      sub: t('kpiPointsPerSprint', {
        defaultValue: '{{metric}} per sprint',
        metric: metricLabel,
      }),
      tone: TONES.primary,
    },
    {
      key: 'last',
      label: t('kpiLastSprint', { defaultValue: 'Last sprint' }),
      value:
        kpis.last_sprint_velocity === null || kpis.last_sprint_velocity === undefined
          ? '—'
          : String(Math.round(kpis.last_sprint_velocity * 10) / 10),
      sub: '\u00a0',
      tone: TONES.success,
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
    },
    {
      key: 'sprints',
      label: t('kpiSprints', { defaultValue: 'Sprints' }),
      value: String(kpis.completed_sprint_count),
      sub: '\u00a0',
      tone: TONES.muted,
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
            {tile.label}
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
