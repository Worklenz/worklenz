import React from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useGetUserTimeLoggedSummaryQuery } from '@/api/home-page/user-activity.api.service';
import { useGetTaskStatsQuery } from '@/api/home-page/home-page.api.service';
import { theme, Tooltip, InfoCircleOutlined } from '@/shared/antd-imports';
import type { HomePeriod } from '../HomeOverviewView';
import { useTranslation } from 'react-i18next';

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

// Backend returns total_time_logged in seconds (SUM of task_work_log.time_spent).
// Truncate to whole minutes here so the card never shows a seconds component.
const formatSecondsAsHM = (totalSeconds: number): string => {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

interface StatCard {
  label: string;
  value: number | string;
  color?: string;
  /** Renders two values side by side within the tile instead of one (e.g. billable/non-billable). */
  split?: { leftLabel: string; leftValue: string; rightLabel: string; rightValue: string };
  /** Shown in a tooltip behind the info icon next to the card's label. */
  tooltip: string;
}

interface HomeStatCardsProps {
  period: HomePeriod;
}

const HomeStatCards: React.FC<HomeStatCardsProps> = ({ period }) => {
  const groupBy = useAppSelector(state => state.homePageReducer.homeTasksConfig.tasks_group_by);
  const { data: statsData } = useGetTaskStatsQuery({ group_by: groupBy, time_zone: TIME_ZONE });
  const { data: timeSummaryData } = useGetUserTimeLoggedSummaryQuery({
    period,
    time_zone: TIME_ZONE,
  });
  const { token } = theme.useToken();
  const { t } = useTranslation('home');

  const stats = statsData?.body;
  const tasksCount = period === 'today' ? (stats?.today ?? 0) : (stats?.week ?? 0);
  const overdueCount = stats?.overdue ?? 0;
  const completedCount = period === 'today' ? (stats?.completed_today ?? 0) : (stats?.completed_week ?? 0);

  const billableSeconds = timeSummaryData?.body?.billable_seconds ?? 0;
  const nonBillableSeconds = timeSummaryData?.body?.non_billable_seconds ?? 0;

  const billableStr = billableSeconds > 0 ? formatSecondsAsHM(billableSeconds) : '0h';
  const nonBillableStr = nonBillableSeconds > 0 ? formatSecondsAsHM(nonBillableSeconds) : '0h';

  const focusTimeSplit = {
    leftLabel: t('statCards.billable', { defaultValue: 'Billable' }),
    leftValue: billableStr,
    rightLabel: t('statCards.nonBillable', { defaultValue: 'Non-Billable' }),
    rightValue: nonBillableStr,
  };

  const periodWord = period === 'today' ? 'today' : 'this week';
  const tasksTooltip = t('statCards.tasksTooltip', { periodWord, defaultValue: 'Total tasks assigned for {{periodWord}}.' });
  const overdueTooltip = t('statCards.overdueTooltip', { defaultValue: 'Tasks past their due date.' });
  const completedTooltip = t('statCards.completedTooltip', { periodWord, defaultValue: 'Tasks completed {{periodWord}}.' });
  const focusTimeTooltip = t('statCards.focusTimeTooltip', { periodWord, defaultValue: 'Time spent on tasks {{periodWord}}.' });

  const cards: StatCard[] =
    period === 'today'
      ? [
          { label: t('statCards.tasksToday', { defaultValue: "Today's Tasks" }),         value: tasksCount,     color: undefined,     tooltip: tasksTooltip },
          { label: t('statCards.overdue', { defaultValue: 'Overdue' }),             value: overdueCount,   color: '#ff4d4f',     tooltip: overdueTooltip },
          { label: t('statCards.completedToday', { defaultValue: 'Completed Today' }),     value: completedCount, color: '#52c41a',     tooltip: completedTooltip },
          { label: t("statCards.todaysFocusTime", { defaultValue: "Today's Focus Time" }),  value: '',             split: focusTimeSplit, tooltip: focusTimeTooltip },
        ]
      : [
          { label: t('statCards.tasksThisWeek', { defaultValue: "This Week's Tasks" }),     value: tasksCount,     color: undefined,     tooltip: tasksTooltip },
          { label: t('statCards.overdue', { defaultValue: 'Overdue' }),             value: overdueCount,   color: '#ff4d4f',     tooltip: overdueTooltip },
          { label: t('statCards.completedThisWeek', { defaultValue: 'Completed This Week' }), value: completedCount, color: '#52c41a',     tooltip: completedTooltip },
          { label: t("statCards.weeksFocusTime", { defaultValue: "This Week's Focus Time" }),   value: '',             split: focusTimeSplit, tooltip: focusTimeTooltip },
        ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {cards.map(card => (
        <div
          key={card.label}
          style={{
            borderRadius: 10,
            padding: '12px 16px',
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              marginBottom: 4,
              color: token.colorTextSecondary,
            }}
          >
            <span>{card.label}</span>
            {/* right, auto-flipping to left when the card sits near the
                screen edge — these cards sit right below the greeting
                banner, so the default top placement overlapped it.
                Elevated-surface color (not antd's default black bubble) so
                it reads as a light card-style popover in light mode and a
                dark one in dark mode; the border+shadow keep it visible
                even when it lands on a background the same color. */}
            <Tooltip
              title={card.tooltip}
              placement="right"
              color={token.colorBgElevated}
              styles={{
                body: {
                  color: token.colorText,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  boxShadow: token.boxShadowSecondary,
                },
              }}
            >
              <InfoCircleOutlined style={{ fontSize: 11, cursor: 'help' }} />
            </Tooltip>
          </div>
          {card.split ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, color: '#1677ff' }}>
                  {card.split.leftValue}
                </div>
                <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                  {card.split.leftLabel}
                </div>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: token.colorBorderSecondary }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, color: token.colorText }}>
                  {card.split.rightValue}
                </div>
                <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                  {card.split.rightLabel}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: card.color ?? token.colorText }}>
              {card.value}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default HomeStatCards;
