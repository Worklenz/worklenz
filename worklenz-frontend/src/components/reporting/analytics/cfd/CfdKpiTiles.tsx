import React from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { CfdSeriesResponse } from '@/types/reporting/analytics-cfd.types';
import { MetricCalcHint } from '../MetricCalcHint';
import './cfd-kpi-tiles.css';

interface CfdKpiTilesProps {
  indicators: CfdSeriesResponse['indicators'];
}

const TONES = {
  primary: '#1890ff',
  success: '#52c41a',
  warn: '#faad14',
  purple: '#722ed1',
} as const;

const formatDays = (value: number | null): string => {
  if (value === null || value === undefined) return '—';
  return String(Math.round(value * 10) / 10);
};

export const CfdKpiTiles: React.FC<CfdKpiTilesProps> = ({ indicators }) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const muted = token.colorTextSecondary;

  const tiles = [
    {
      key: 'wip',
      label: t('cfdKpiWip', { defaultValue: 'Current WIP' }),
      value: String(indicators.current_wip),
      sub: t('cfdKpiWipSub', { defaultValue: 'in progress statuses' }),
      tone: TONES.primary,
      tooltip: t('cfdCalcWip', {
        defaultValue:
          'Count of tasks currently in In Progress (doing) statuses at the end of the selected period.',
      }),
    },
    {
      key: 'throughput',
      label: t('cfdKpiThroughput', { defaultValue: 'Throughput' }),
      value: String(Math.round(indicators.avg_throughput_per_day * 100) / 100),
      sub: t('cfdKpiThroughputSub', { defaultValue: 'issues / day' }),
      tone: TONES.success,
      tooltip: t('cfdCalcThroughput', {
        defaultValue:
          'Average tasks completed per day in the selected date range (done-status entries ÷ days).',
      }),
    },
    {
      key: 'cycle',
      label: t('cfdKpiCycle', { defaultValue: 'Avg cycle time' }),
      value: formatDays(indicators.avg_cycle_days),
      sub: t('cfdKpiDaysSub', { defaultValue: 'days' }),
      tone: TONES.warn,
      tooltip: t('cfdCalcCycle', {
        defaultValue:
          'Average days from when work started (entered doing) to when the task was completed.',
      }),
    },
    {
      key: 'lead',
      label: t('cfdKpiLead', { defaultValue: 'Avg lead time' }),
      value: formatDays(indicators.avg_lead_days),
      sub: t('cfdKpiDaysSub', { defaultValue: 'days' }),
      tone: TONES.purple,
      tooltip: t('cfdCalcLead', {
        defaultValue:
          'Average days from task creation to completion (includes waiting time).',
      }),
    },
  ];

  return (
    <div className="cfd-kpi-tiles">
      {tiles.map(tile => (
        <div
          key={tile.key}
          className="cfd-kpi-tile"
          style={{
            borderColor,
            background: token.colorBgContainer,
            color: token.colorText,
          }}
        >
          <div className="cfd-kpi-tile__label" style={{ color: muted }}>
            <span className="cfd-kpi-tile__dot" style={{ background: tile.tone }} />
            <span>{tile.label}</span>
            <MetricCalcHint title={tile.tooltip} color={muted} />
          </div>
          <div className="cfd-kpi-tile__value">{tile.value}</div>
          <div className="cfd-kpi-tile__sub" style={{ color: muted }}>
            {tile.sub}
          </div>
        </div>
      ))}
    </div>
  );
};
