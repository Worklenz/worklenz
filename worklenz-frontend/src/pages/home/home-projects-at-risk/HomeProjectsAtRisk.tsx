import React from 'react';
import Card from 'antd/es/card';
import Tag from 'antd/es/tag';
import Skeleton from 'antd/es/skeleton';
import { useGetProjectsQuery } from '@/api/home-page/home-page.api.service';
import { useTranslation } from 'react-i18next';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';

const AT_RISK_PATTERNS = ['risk', 'block', 'watch'];

const getHealthColor = (healthName?: string): string => {
  const h = (healthName || '').toLowerCase();
  if (h.includes('risk')) return '#ff4d4f';
  if (h.includes('block')) return '#8c8c8c';
  if (h.includes('watch')) return '#faad14';
  return '#52c41a';
};

const isAtRisk = (p: IProjectViewModel): boolean => {
  const h = (p.health_name || '').toLowerCase();
  return AT_RISK_PATTERNS.some(pattern => h.includes(pattern));
};

const HomeProjectsAtRisk: React.FC = () => {
  const { t } = useTranslation('home');
  const { data, isLoading } = useGetProjectsQuery({ view: 0 });
  const projects = (data?.body as IProjectViewModel[] | undefined) || [];
  const atRisk = projects.filter(isAtRisk).slice(0, 5);

  if (!isLoading && atRisk.length === 0) return null;

  return (
    <Card styles={{ body: { padding: '20px' } }} style={{ borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('projectsAtRisk', 'Projects at Risk')}</div>
        {atRisk.length > 0 && (
          <Tag color="red" style={{ borderRadius: 12, fontSize: 10, marginInlineEnd: 0 }}>
            {atRisk.length} {t('flagged', 'flagged')}
          </Tag>
        )}
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      ) : (
        atRisk.map(p => {
          const color = getHealthColor(p.health_name);
          return (
            <div
              key={p.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                </div>
                {p.client_name && (
                  <div style={{ fontSize: 11, color: 'var(--colorTextSecondary, rgba(0,0,0,.45))' }}>{p.client_name}</div>
                )}
              </div>
              {p.health_name && (
                <Tag
                  style={{
                    fontSize: 10,
                    background: `${color}18`,
                    color,
                    borderColor: 'transparent',
                    marginInlineEnd: 0,
                    flexShrink: 0,
                  }}
                >
                  {p.health_name}
                </Tag>
              )}
            </div>
          );
        })
      )}
    </Card>
  );
};

export default HomeProjectsAtRisk;
