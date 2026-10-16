import React from 'react';
import Card from 'antd/es/card';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useGetMyProgressQuery } from '@/api/home-page/home-page.api.service';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { Tooltip, InfoCircleOutlined, theme } from '@/shared/antd-imports';
import type { HomePeriod } from '../HomeOverviewView';
import { HomeWidgetMenuButton } from '../home-widgets/HomeWidgetMenuButton';
import { WIDGET_DATA_ATTRIBUTE } from '../home-widgets/widgetInteraction';
import { useHomePeriodMenuItems } from '../home-widgets/useHomePeriodMenuItems';
import { useTranslation } from 'react-i18next';

const DONUT_SIZE = 120;
const STROKE_WIDTH = 14;
const GAP = 3;

const cx = DONUT_SIZE / 2;
const cy = DONUT_SIZE / 2;
const r = (DONUT_SIZE - STROKE_WIDTH) / 2;
const circ = 2 * Math.PI * r;

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

// Same rounding the reporting module's project task-progress uses
// (ReportingControllerBase.getPercentage).
const getPercentage = (n: number, total: number) => +(n ? (n / total) * 100 : 0).toFixed();

// Shared legend row styles so the header row ("Assigned this week") and the
// Doing / Done / To Do rows line up: labels stay on one line (ellipsis when
// too narrow) and counts sit in a fixed-width, right-aligned column.
const legendRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
};

const legendLabelStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  opacity: 0.7,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const legendCountStyle: React.CSSProperties = {
  fontWeight: 700,
  minWidth: 20,
  flexShrink: 0,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  paddingRight: 8,
};

interface HomeProgressDonutProps {
  period: HomePeriod;
}

const HomeProgressDonut: React.FC<HomeProgressDonutProps> = ({ period }) => {
  const { token } = theme.useToken();
  // Synced with the Priorities card's assigned-to-me/assigned-by-me toggle
  // so the two cards always agree on whose tasks they're counting.
  const tasksGroupBy = useAppSelector(state => state.homePageReducer.homeTasksConfig.tasks_group_by);
  const { data } = useGetMyProgressQuery({ group_by: tasksGroupBy, time_zone: TIME_ZONE });
  const { t } = useTranslation('home');
  const periodMenuItems = useHomePeriodMenuItems();

  const title = period === 'today' ? t('progressDonut.myProgressToday', { defaultValue: 'My Progress Today' }) : t('progressDonut.myProgressThisWeek', { defaultValue: 'My Progress This Week' });
  const periodWord = period === 'today' ? 'today' : 'this week';
  const counts = period === 'today' ? data?.body?.today : data?.body?.week;

  const titleTooltip = t('progressDonut.titleTooltip', { periodWord, defaultValue: 'Progress breakdown for {{periodWord}}.' });

  const titleRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
      <span>{title}</span>
      {/* right, auto-flipping to left near the screen edge — this card sits
          right below the greeting banner, so top placement overlapped it.
          Elevated-surface color (not antd's default black bubble) so it
          reads as a light card-style popover in light mode and a dark one
          in dark mode; the border+shadow keep it visible even when it
          lands on a background the same color. */}
      <Tooltip
        title={titleTooltip}
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
        <InfoCircleOutlined style={{ fontSize: 12, color: 'currentColor', opacity: 0.55, cursor: 'help' }} />
      </Tooltip>
      <div style={{ marginLeft: 'auto', fontWeight: 400 }}>
        <HomeWidgetMenuButton extraItems={periodMenuItems} />
      </div>
    </div>
  );

  if (!counts) {
    return (
      <Card styles={{ body: { padding: '20px' } }} style={{ borderRadius: 10 }}>
        {titleRow}
        <div
          {...{ [WIDGET_DATA_ATTRIBUTE]: '' }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}
        >
          <WorklenzLogoLoader />
        </div>
      </Card>
    );
  }

  const total = counts.total || 0;
  const donePercentage = getPercentage(counts.done, total);

  // Same status-category buckets (and colors) as the reporting module's
  // project task-progress bars: To Do / Doing / Done.
  const segments = [
    { label: t('progressDonut.done', { defaultValue: 'Done' }), count: counts.done, color: '#52c41a' },
    { label: t('progressDonut.doing', { defaultValue: 'Doing' }), count: counts.doing, color: '#1677ff' },
    { label: t('progressDonut.toDo', { defaultValue: 'To Do' }), count: counts.todo, color: '#faad14' },
  ].filter(s => s.count > 0);

  const assignedLabel = period === 'today' ? t('progressDonut.assignedToday', { defaultValue: 'Assigned Today' }) : t('progressDonut.assignedThisWeek', { defaultValue: 'Assigned This Week' });
  let cumPos = 0;

  return (
    <Card styles={{ body: { padding: '20px' } }} style={{ borderRadius: 10 }}>
      {titleRow}
      <div {...{ [WIDGET_DATA_ATTRIBUTE]: '' }} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="var(--colorBorder, #f0f0f0)"
              strokeWidth={STROKE_WIDTH}
            />
            {total > 0 &&
              segments.map((s, i) => {
                const segLen = (s.count / total) * circ;
                const visLen = Math.max(0, segLen - GAP);
                const startPos = cumPos;
                cumPos += segLen;
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={`${visLen} ${circ - visLen}`}
                    strokeDashoffset={circ - startPos}
                    transform={`rotate(-90 ${cx} ${cy})`}
                  />
                );
              })}
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>
              {total > 0 ? `${donePercentage}%` : 0}
            </div>
            <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2 }}>
              {total > 0 ? t('progressDonut.doneShort', { defaultValue: 'done' }) : t('progressDonut.tasks', { defaultValue: 'tasks' })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={legendRowStyle}>
            <span style={legendLabelStyle} title={assignedLabel}>
              {assignedLabel}
            </span>
            <span style={legendCountStyle}>{total}</span>
          </div>
          {total > 0 ? (
            [
              { label: t('progressDonut.doing', { defaultValue: 'Doing' }), count: counts.doing, color: '#1677ff' },
              { label: t('progressDonut.done', { defaultValue: 'Done' }), count: counts.done, color: '#52c41a' },
              { label: t('progressDonut.toDo', { defaultValue: 'To Do' }), count: counts.todo, color: '#faad14' },
            ].map(s => (
              <div key={s.label} style={legendRowStyle}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: s.color,
                    flexShrink: 0,
                  }}
                />
                <span style={legendLabelStyle} title={s.label}>
                  {s.label}
                </span>
                <span style={legendCountStyle}>{s.count}</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, opacity: 0.45 }}>{t('progressDonut.nothingDue', { defaultValue: 'Nothing due' })}</div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default HomeProgressDonut;