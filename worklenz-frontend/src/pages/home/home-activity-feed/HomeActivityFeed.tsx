import React, { useMemo } from 'react';
import Card from 'antd/es/card';
import Skeleton from 'antd/es/skeleton';
import { useGetUserRecentTasksQuery } from '@/api/home-page/user-activity.api.service';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const AV_COLORS = ['#1677ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2', '#ff4d4f'];

const HomeActivityFeed: React.FC = () => {
  const { data, isLoading } = useGetUserRecentTasksQuery({ limit: 10 });

  const tasks = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data.slice(0, 10);
    const body = (data as any)?.body;
    return Array.isArray(body) ? body.slice(0, 10) : [];
  }, [data]);

  return (
    <Card
      style={{ borderRadius: 10, height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' } }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>Today&apos;s Activity</div>
        <a href="#" style={{ fontSize: 12, color: '#1677ff', textDecoration: 'none' }}>View all</a>
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      ) : tasks.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--colorTextDisabled, rgba(0,0,0,.25))', textAlign: 'center', padding: '12px 0' }}>
          No recent activity
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tasks.map((t: any, idx: number) => {
            const initials = (t.task_name || '')
              .split(' ')
              .slice(0, 2)
              .map((w: string) => w[0])
              .join('')
              .toUpperCase();
            const color = AV_COLORS[idx % AV_COLORS.length];
            return (
              <div
                key={t.task_id}
                style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: color,
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {initials || '?'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    <b>{t.task_name}</b>
                    {t.project_name && (
                      <span style={{ color: 'var(--colorTextSecondary, rgba(0,0,0,.45))' }}> · {t.project_name}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--colorTextDisabled, rgba(0,0,0,.25))', marginTop: 1 }}>
                    {t.last_activity_at ? dayjs(t.last_activity_at).fromNow() : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default HomeActivityFeed;
