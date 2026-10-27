import React from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { PlannedVsActualMilestonesKpis } from '@/types/reporting/analytics-planned-vs-actual-milestones.types';
import './pva-milestones-kpi-tiles.css';

interface PvaMilestonesKpiTilesProps {
  kpis: PlannedVsActualMilestonesKpis;
}

const TONES = {
  neutral: '#722ed1',
  warn: '#faad14',
  ok: '#52c41a',
  slip: '#fa8c16',
} as const;

export const PvaMilestonesKpiTiles: React.FC<PvaMilestonesKpiTilesProps> = ({ kpis }) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const muted = token.colorTextSecondary;

  const tiles = [
    {
      key: 'milestones',
      label: t('pvaMsStatMilestones', { defaultValue: 'Milestones' }),
      value: String(kpis.milestones),
      sub: t('statAcrossSelection', { defaultValue: 'across selection' }),
      tone: TONES.neutral,
    },
    {
      key: 'late',
      label: t('pvaMsStatLate', { defaultValue: 'Late' }),
      value: String(kpis.late),
      sub: t('pvaMsStatLateSub', { defaultValue: 'past planned date' }),
      tone: TONES.warn,
    },
    {
      key: 'on_time',
      label: t('pvaMsStatOnTime', { defaultValue: 'On time' }),
      value: String(kpis.on_time),
      sub: t('pvaMsStatOnTimeSub', { defaultValue: 'on or ahead of plan' }),
      tone: TONES.ok,
    },
    {
      key: 'avg_slip',
      label: t('pvaMsStatAvgSlip', { defaultValue: 'Avg slip' }),
      value: t('pvaMsSlipDays', {
        defaultValue: '{{days}}d',
        days: kpis.avg_slip_days,
      }),
      sub: t('pvaMsVsPlannedDates', { defaultValue: 'vs planned dates' }),
      tone: TONES.slip,
    },
  ];

  return (
    <div className="pva-ms-kpi-tiles">
      {tiles.map(tile => (
        <div
          key={tile.key}
          className="pva-ms-kpi-tile"
          style={{
            borderColor,
            background: token.colorBgContainer,
            color: token.colorText,
          }}
        >
          <div className="pva-ms-kpi-tile__label" style={{ color: muted }}>
            <span className="pva-ms-kpi-tile__dot" style={{ background: tile.tone }} />
            {tile.label}
          </div>
          <div className="pva-ms-kpi-tile__value">{tile.value}</div>
          <div className="pva-ms-kpi-tile__sub" style={{ color: muted }}>
            {tile.sub}
          </div>
        </div>
      ))}
    </div>
  );
};
