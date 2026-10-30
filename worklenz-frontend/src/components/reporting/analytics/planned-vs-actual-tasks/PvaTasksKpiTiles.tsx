import React from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { PlannedVsActualTasksKpis } from '@/types/reporting/analytics-planned-vs-actual-tasks.types';
import { MetricCalcHint } from '../MetricCalcHint';
import './pva-tasks-kpi-tiles.css';

interface PvaTasksKpiTilesProps {
  kpis: PlannedVsActualTasksKpis;
}

const TONES = {
  neutral: '#1890ff',
  ok: '#52c41a',
  bad: '#ff4d4f',
  warn: '#faad14',
} as const;

export const PvaTasksKpiTiles: React.FC<PvaTasksKpiTilesProps> = ({ kpis }) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const muted = token.colorTextSecondary;

  const varianceTone =
    kpis.avg_variance_days > 0 ? TONES.bad : kpis.avg_variance_days < 0 ? TONES.ok : TONES.neutral;

  const tiles = [
    {
      key: 'planned',
      label: t('pvaTasksStatPlanned', { defaultValue: 'Planned tasks' }),
      value: String(kpis.planned),
      sub: t('statAcrossSelection', { defaultValue: 'across selection' }),
      tone: TONES.neutral,
      tooltip: t('pvaTkCalcPlanned', {
        defaultValue: 'Count of tasks with a planned/due date in the selected project(s).',
      }),
    },
    {
      key: 'completed',
      label: t('pvaTasksStatCompleted', { defaultValue: 'Completed' }),
      value: String(kpis.completed),
      sub: t('pvaTasksPctOfPlan', {
        defaultValue: '{{pct}}% of plan',
        pct: kpis.completed_pct_of_plan,
      }),
      tone: TONES.ok,
      tooltip: t('pvaTkCalcCompleted', {
        defaultValue:
          'Completed tasks in the selection. Percentage = completed ÷ planned × 100.',
      }),
    },
    {
      key: 'overdue',
      label: t('pvaTasksStatOverdue', { defaultValue: 'Overdue' }),
      value: String(kpis.overdue),
      sub: t('statAcrossSelection', { defaultValue: 'across selection' }),
      tone: TONES.bad,
      tooltip: t('pvaTkCalcOverdue', {
        defaultValue:
          'Incomplete tasks past their due date, plus completed tasks finished after the due date.',
      }),
    },
    {
      key: 'variance',
      label: t('pvaTasksStatAvgVariance', { defaultValue: 'Avg variance' }),
      value: t('pvaTasksVarianceDays', {
        defaultValue: '{{days}}d',
        days: kpis.avg_variance_days,
      }),
      sub: t('pvaTasksVsPlannedDates', { defaultValue: 'vs planned dates' }),
      tone: varianceTone,
      tooltip: t('pvaTkCalcAvgVariance', {
        defaultValue:
          'Average days between actual/completed date and planned due date (positive = late).',
      }),
    },
  ];

  return (
    <div className="pva-tasks-kpi-tiles">
      {tiles.map(tile => (
        <div
          key={tile.key}
          className="pva-tasks-kpi-tile"
          style={{
            borderColor,
            background: token.colorBgContainer,
            color: token.colorText,
          }}
        >
          <div className="pva-tasks-kpi-tile__label" style={{ color: muted }}>
            <span className="pva-tasks-kpi-tile__dot" style={{ background: tile.tone }} />
            <span>{tile.label}</span>
            <MetricCalcHint title={tile.tooltip} color={muted} />
          </div>
          <div className="pva-tasks-kpi-tile__value">{tile.value}</div>
          <div className="pva-tasks-kpi-tile__sub" style={{ color: muted }}>
            {tile.sub}
          </div>
        </div>
      ))}
    </div>
  );
};
