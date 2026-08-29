import React, { useMemo } from 'react';
import Card from 'antd/es/card';
import Skeleton from 'antd/es/skeleton';
import { useGetUserTimeLoggedTasksQuery } from '@/api/home-page/user-activity.api.service';
import { useTranslation } from 'react-i18next';

const RING_SIZE = 68;
const RING_R = 28;
const RING_CIRC = 2 * Math.PI * RING_R;

const formatMinutes = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
};

const HomeFocusTime: React.FC = () => {
  const { t } = useTranslation('home');
  const { data, isLoading } = useGetUserTimeLoggedTasksQuery({ limit: 20 });

  const { totalMinutes, billablePct } = useMemo(() => {
    const tasks = Array.isArray(data)
      ? data
      : Array.isArray((data as any)?.body)
        ? (data as any).body
        : [];

    let total = 0;
    let billable = 0;

    tasks.forEach((t: any) => {
      const mins = Number(t.total_time_logged) || 0;
      total += mins;
      // estimate billable as those logged by timer
      if (t.logged_by_timer) billable += mins;
    });

    const pct = total > 0 ? Math.round((billable / total) * 100) : 0;
    return { totalMinutes: total, billablePct: pct };
  }, [data]);

  const ringDash = RING_CIRC * (billablePct / 100);

  return (
    <Card styles={{ body: { padding: '20px' } }} style={{ borderRadius: 10 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('focusTime.title', { defaultValue: 'Focus & Time' })}</div>
        {billablePct > 0 && (
          <div style={{ fontSize: 11, color: '#52c41a' }}>{billablePct}% {t('focusTime.billable', { defaultValue: 'billable' })}</div>
        )}
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            {/* Billable ring */}
            <div style={{ position: 'relative', width: RING_SIZE, height: RING_SIZE, flexShrink: 0 }}>
              <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} width={RING_SIZE} height={RING_SIZE}>
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_R}
                  fill="none"
                  stroke="var(--colorBorder, #f0f0f0)"
                  strokeWidth={6}
                />
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_R}
                  fill="none"
                  stroke="#1677ff"
                  strokeWidth={6}
                  strokeDasharray={`${ringDash} ${RING_CIRC}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{billablePct}%</div>
                <div style={{ fontSize: 8, opacity: 0.5 }}>{t('focusTime.billable', { defaultValue: 'billable' })}</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>{t('focusTime.loggedToday', { defaultValue: 'Logged today' })}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
                {totalMinutes > 0 ? formatMinutes(totalMinutes) : '0h'}
              </div>
            </div>
          </div>

          <button style={{
            width: '100%',
            padding: '6px 0',
            background: '#1677ff',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}>
            <span style={{ fontSize: 10 }}>▶</span> {t('focusTime.startTimer', { defaultValue: 'Start timer' })}
          </button>
        </>
      )}
    </Card>
  );
};

export default HomeFocusTime;
