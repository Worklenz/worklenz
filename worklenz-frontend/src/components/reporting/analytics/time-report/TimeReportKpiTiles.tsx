import React from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { TimeReportKpis } from '@/types/reporting/analytics-time-report.types';
import './time-report-kpi-tiles.css';

interface TimeReportKpiTilesProps {
  kpis: TimeReportKpis;
}

const TONES = {
  neutral: '#1890ff',
  ok: '#52c41a',
  bad: '#ff4d4f',
  warn: '#faad14',
  estimated: '#722ed1',
} as const;

const fmtHours = (value: number): string => `${Number(value.toFixed(1))}h`;

export const TimeReportKpiTiles: React.FC<TimeReportKpiTilesProps> = ({ kpis }) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const muted = token.colorTextSecondary;

  const tiles = [
    {
      key: 'logged',
      label: t('trStatLogged', { defaultValue: 'Logged' }),
      value: fmtHours(kpis.logged_hours),
      sub: t('trStatLoggedSub', { defaultValue: 'total logged time' }),
      tone: TONES.neutral,
    },
    {
      key: 'estimated',
      label: t('trStatEstimated', { defaultValue: 'Estimated' }),
      value: fmtHours(kpis.estimated_hours),
      sub: t('trStatEstimatedSub', { defaultValue: 'planned task effort' }),
      tone: TONES.estimated,
    },
    {
      key: 'billable',
      label: t('trStatBillable', { defaultValue: 'Billable' }),
      value: fmtHours(kpis.billable_hours),
      sub: t('trStatBillableSub', {
        defaultValue: '{{pct}}% of logged',
        pct: kpis.billable_pct,
      }),
      tone: TONES.ok,
    },
    {
      key: 'over',
      label: t('trStatOverEstimate', { defaultValue: 'Over estimate' }),
      value: fmtHours(kpis.over_estimate_hours),
      sub:
        kpis.over_estimate_hours > 0
          ? t('trStatOverEstimateSub', { defaultValue: 'logged above estimate' })
          : t('trStatWithinEstimateSub', { defaultValue: 'within estimate' }),
      tone: kpis.over_estimate_hours > 0 ? TONES.bad : TONES.ok,
    },
  ];

  return (
    <div className="tr-kpi-tiles">
      {tiles.map(tile => (
        <div
          key={tile.key}
          className="tr-kpi-tile"
          style={{
            borderColor,
            background: token.colorBgContainer,
            color: token.colorText,
          }}
        >
          <div className="tr-kpi-tile__label" style={{ color: muted }}>
            <span className="tr-kpi-tile__dot" style={{ background: tile.tone }} />
            {tile.label}
          </div>
          <div className="tr-kpi-tile__value" style={{ color: tile.tone }}>
            {tile.value}
          </div>
          <div className="tr-kpi-tile__sub" style={{ color: muted }}>
            {tile.sub}
          </div>
        </div>
      ))}
    </div>
  );
};
