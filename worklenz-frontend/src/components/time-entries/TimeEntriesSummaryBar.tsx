import React from 'react';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { IMySummary } from '@/api/tasks/task-time-logs.api.service';
import '@/pages/time-entries/time-entries.css';

const formatSeconds = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
};

const STAT_DEFS: { key: keyof IMySummary; label: string; color: string }[] = [
  { key: 'today_total', label: 'Today Total', color: '#1677ff' },
  { key: 'today_billable', label: 'Today Billable', color: '#52c41a' },
  { key: 'today_non_billable', label: 'Today Non-Billable', color: '#ff4d4f' },
  { key: 'week_total', label: 'This Week Total', color: '#1677ff' },
  { key: 'week_billable', label: 'Week Billable', color: '#52c41a' },
  { key: 'week_non_billable', label: 'Week Non-Billable', color: '#ff4d4f' },
];

interface TimeEntriesSummaryBarProps {
  summary: IMySummary | null;
  loading: boolean;
}

export const TimeEntriesSummaryBar: React.FC<TimeEntriesSummaryBarProps> = ({ summary, loading }) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();

  const cardStyle: React.CSSProperties = {
    borderRadius: token.borderRadiusLG,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
    padding: 16,
  };

  return (
    <div className="time-entries-stat-cards" style={{ marginBottom: 16 }}>
      {STAT_DEFS.map(stat => (
        <div key={stat.key} style={cardStyle}>
          <div style={{ fontSize: 11, color: token.colorTextSecondary, marginBottom: 4 }}>
            {t(`summary.${stat.key}`, { defaultValue: stat.label })}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>
            {loading ? '—' : formatSeconds((summary?.[stat.key] as number) || 0)}
          </div>
        </div>
      ))}
    </div>
  );
};
