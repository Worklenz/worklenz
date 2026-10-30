import React from 'react';
import { useTranslation } from 'react-i18next';
import { InfoCircleOutlined, Tooltip, theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { ProjectHealthKpis } from '@/types/reporting/analytics-project-health.types';
import './project-health-kpi-tiles.css';

interface ProjectHealthKpiTilesProps {
  kpis: ProjectHealthKpis;
}

const TONES = {
  ok: '#52c41a',
  warn: '#faad14',
  bad: '#ff4d4f',
} as const;

export const ProjectHealthKpiTiles: React.FC<ProjectHealthKpiTilesProps> = ({ kpis }) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const muted = token.colorTextSecondary;

  const tiles = [
    {
      key: 'on_track',
      label: t('statOnTrack', { defaultValue: 'On track' }),
      value: String(kpis.on_track),
      sub: t('statProjects', { defaultValue: 'projects' }),
      tone: TONES.ok,
      tooltip: t('phCalcOnTrack', {
        defaultValue:
          'Count of selected projects whose health is set to Good in project settings.',
      }),
    },
    {
      key: 'at_risk',
      label: t('statAtRisk', { defaultValue: 'At risk' }),
      value: String(kpis.at_risk),
      sub: t('statProjects', { defaultValue: 'projects' }),
      tone: TONES.warn,
      tooltip: t('phCalcAtRisk', {
        defaultValue:
          'Count of selected projects whose health is set to At Risk in project settings.',
      }),
    },
    {
      key: 'off_track',
      label: t('statOffTrack', { defaultValue: 'Off track' }),
      value: String(kpis.off_track),
      sub: t('statProjects', { defaultValue: 'projects' }),
      tone: TONES.bad,
      tooltip: t('phCalcOffTrack', {
        defaultValue:
          'Count of selected projects whose health is set to Needs Attention in project settings.',
      }),
    },
    {
      key: 'overdue',
      label: t('statOverdueTasks', { defaultValue: 'Overdue tasks' }),
      value: String(kpis.overdue_tasks),
      sub: t('statAcrossSelection', { defaultValue: 'across selection' }),
      tone: TONES.bad,
      tooltip: t('phCalcOverdueTasks', {
        defaultValue:
          'Sum of incomplete, non-archived tasks past their due date across all selected projects.',
      }),
    },
  ];

  return (
    <div className="ph-kpi-tiles">
      {tiles.map(tile => (
        <div
          key={tile.key}
          className="ph-kpi-tile"
          style={{
            borderColor,
            background: token.colorBgContainer,
            color: token.colorText,
          }}
        >
          <div className="ph-kpi-tile__label" style={{ color: muted }}>
            <span className="ph-kpi-tile__dot" style={{ background: tile.tone }} />
            <span>{tile.label}</span>
            <Tooltip title={tile.tooltip}>
              <InfoCircleOutlined
                aria-label={tile.tooltip}
                style={{ color: muted, fontSize: 12, cursor: 'help' }}
              />
            </Tooltip>
          </div>
          <div className="ph-kpi-tile__value">{tile.value}</div>
          <div className="ph-kpi-tile__sub" style={{ color: muted }}>
            {tile.sub}
          </div>
        </div>
      ))}
    </div>
  );
};
