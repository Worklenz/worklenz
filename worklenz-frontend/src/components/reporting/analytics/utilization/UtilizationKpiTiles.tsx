import React from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { UtilizationKpis } from '@/types/reporting/analytics-utilization.types';
import { MetricCalcHint } from '../MetricCalcHint';
import './utilization-kpi-tiles.css';

interface UtilizationKpiTilesProps {
  kpis: UtilizationKpis;
}

const TONES = {
  neutral: '#1890ff',
  ok: '#52c41a',
  bad: '#ff4d4f',
  warn: '#faad14',
} as const;

export const UtilizationKpiTiles: React.FC<UtilizationKpiTilesProps> = ({ kpis }) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const muted = token.colorTextSecondary;

  const avgTone =
    kpis.avg_utilization_pct > 100
      ? TONES.bad
      : kpis.avg_utilization_pct > 80
        ? TONES.ok
        : TONES.warn;

  const tiles = [
    {
      key: 'avg',
      label: t('utilStatAvg', { defaultValue: 'Avg. Utilization' }),
      value: `${kpis.avg_utilization_pct}%`,
      sub: t('utilStatLoggedOfCapacity', {
        defaultValue: '{{logged}}h logged of {{capacity}}h capacity',
        logged: kpis.total_logged_hours,
        capacity: kpis.total_capacity_hours,
      }),
      tone: avgTone,
      tooltip: t('utilCalcAvg', {
        defaultValue:
          'Total logged hours ÷ total capacity hours × 100 across selected members/projects.',
      }),
    },
    {
      key: 'team',
      label: t('utilStatTeamSize', { defaultValue: 'Team Size' }),
      value: String(kpis.team_size),
      sub: t('statAcrossSelection', { defaultValue: 'across selection' }),
      tone: TONES.neutral,
      tooltip: t('utilCalcTeamSize', {
        defaultValue: 'Number of distinct team members included in the utilization selection.',
      }),
    },
    {
      key: 'over',
      label: t('utilStatOverutilized', { defaultValue: 'Overutilized' }),
      value: String(kpis.overutilized_count),
      sub: t('utilStatOverSub', { defaultValue: 'above 100% capacity' }),
      tone: TONES.bad,
      tooltip: t('utilCalcOver', {
        defaultValue: 'Members whose logged hours exceed 100% of their capacity.',
      }),
    },
    {
      key: 'under',
      label: t('utilStatUnderutilized', { defaultValue: 'Underutilized' }),
      value: String(kpis.underutilized_count),
      sub: t('utilStatUnderSub', { defaultValue: 'at or below 80% capacity' }),
      tone: TONES.warn,
      tooltip: t('utilCalcUnder', {
        defaultValue: 'Members whose utilization is at or below 80% of capacity.',
      }),
    },
  ];

  return (
    <div className="util-kpi-tiles">
      {tiles.map(tile => (
        <div
          key={tile.key}
          className="util-kpi-tile"
          style={{
            borderColor,
            background: token.colorBgContainer,
            color: token.colorText,
          }}
        >
          <div className="util-kpi-tile__label" style={{ color: muted }}>
            <span className="util-kpi-tile__dot" style={{ background: tile.tone }} />
            <span>{tile.label}</span>
            <MetricCalcHint title={tile.tooltip} color={muted} />
          </div>
          <div className="util-kpi-tile__value" style={{ color: tile.tone }}>
            {tile.value}
          </div>
          <div className="util-kpi-tile__sub" style={{ color: muted }}>
            {tile.sub}
          </div>
        </div>
      ))}
    </div>
  );
};
