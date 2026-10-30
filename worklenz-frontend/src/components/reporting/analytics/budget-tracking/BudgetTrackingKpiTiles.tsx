import React from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { BudgetTrackingKpis } from '@/types/reporting/analytics-budget-tracking.types';
import { MetricCalcHint } from '../MetricCalcHint';
import './budget-tracking-kpi-tiles.css';

interface BudgetTrackingKpiTilesProps {
  kpis: BudgetTrackingKpis;
  currency?: string;
}

const TONES = {
  budget: '#1890ff',
  spent: '#722ed1',
  remaining: '#52c41a',
  over: '#ff4d4f',
  ok: '#52c41a',
} as const;

const fmtMoney = (value: number, currency = 'USD'): string =>
  `${currency.toUpperCase()} ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)}`;

export const BudgetTrackingKpiTiles: React.FC<BudgetTrackingKpiTilesProps> = ({
  kpis,
  currency = 'USD',
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const muted = token.colorTextSecondary;

  const tiles = [
    {
      key: 'budget',
      label: t('btStatTotalBudget', { defaultValue: 'Total budget' }),
      value: fmtMoney(kpis.total_budget, currency),
      sub: t('btStatTotalBudgetSub', { defaultValue: 'across projects with a budget' }),
      tone: TONES.budget,
      tooltip: t('btCalcTotalBudget', {
        defaultValue: 'Sum of project budgets for all selected projects that have a budget set.',
      }),
    },
    {
      key: 'spent',
      label: t('btStatSpent', { defaultValue: 'Spent' }),
      value: fmtMoney(kpis.spent, currency),
      sub: t('btStatSpentSub', {
        defaultValue: '{{pct}}% utilized',
        pct: kpis.utilization_pct,
      }),
      tone: TONES.spent,
      tooltip: t('btCalcSpent', {
        defaultValue:
          'Sum of task fixed costs plus logged time cost (hours × rate) across selected projects.',
      }),
    },
    {
      key: 'remaining',
      label: t('btStatRemaining', { defaultValue: 'Remaining' }),
      value: fmtMoney(kpis.remaining, currency),
      sub:
        kpis.remaining < 0
          ? t('btStatRemainingOverSub', { defaultValue: 'over budget overall' })
          : t('btStatRemainingSub', { defaultValue: 'budget left' }),
      tone: kpis.remaining < 0 ? TONES.over : TONES.remaining,
      tooltip: t('btCalcRemaining', {
        defaultValue: 'Total budget − spent. Negative means overall spend exceeds budget.',
      }),
    },
    {
      key: 'over',
      label: t('btStatOverBudget', { defaultValue: 'Over budget' }),
      value: String(kpis.over_budget_count),
      sub:
        kpis.over_budget_count > 0
          ? t('btStatOverBudgetSub', { defaultValue: 'projects over budget' })
          : t('btStatWithinBudgetSub', { defaultValue: 'all within budget' }),
      tone: kpis.over_budget_count > 0 ? TONES.over : TONES.ok,
      tooltip: t('btCalcOverBudget', {
        defaultValue: 'Number of selected projects where spent is greater than the project budget.',
      }),
    },
  ];

  return (
    <div className="bt-kpi-tiles">
      {tiles.map(tile => (
        <div
          key={tile.key}
          className="bt-kpi-tile"
          style={{
            borderColor,
            background: token.colorBgContainer,
            color: token.colorText,
          }}
        >
          <div className="bt-kpi-tile__label" style={{ color: muted }}>
            <span className="bt-kpi-tile__dot" style={{ background: tile.tone }} />
            <span>{tile.label}</span>
            <MetricCalcHint title={tile.tooltip} color={muted} />
          </div>
          <div className="bt-kpi-tile__value" style={{ color: tile.tone }}>
            {tile.value}
          </div>
          <div className="bt-kpi-tile__sub" style={{ color: muted }}>
            {tile.sub}
          </div>
        </div>
      ))}
    </div>
  );
};
