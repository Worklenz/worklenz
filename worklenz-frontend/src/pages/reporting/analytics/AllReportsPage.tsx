import React, { useMemo, useState } from 'react';
import {
  Button,
  Dropdown,
  Empty,
  Flex,
  Input,
  Select,
  Table,
  Tag,
  Typography,
  theme,
} from '@/shared/antd-imports';
import {
  MoreOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined,
} from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  ANALYTICS_NAV,
  CUSTOM_REPORTS_GROUP_KEY,
  analyticsPath,
  customReportPath,
  getAnalyticsNavIcon,
  type AnalyticsNavItem,
} from '@/lib/reporting/analytics-nav';
import { useAnalyticsCustomReports } from '@/features/reporting/analytics-custom-reports';
import './all-reports-gallery.css';

const { Title, Text, Link } = Typography;

type GalleryTab = 'all' | 'builtin' | 'custom' | 'sched' | 'fav';
type GallerySort = 'recent' | 'created' | 'name' | 'type';

interface GalleryReportRow {
  key: string;
  path: string;
  name: string;
  description: string;
  category: string;
  categoryKey: string;
  type: 'builtin' | 'custom';
  creator: string;
  lastAccessed: string;
  scheduled: string | null;
  enabled?: boolean;
  iconColor: string;
}

const REPORT_DESCRIPTIONS: Record<string, { descKey: string; defaultDesc: string; color: string }> = {
  'project-health': {
    descKey: 'descProjectHealth',
    defaultDesc: 'Status, progress and overdue work by project',
    color: '#52c41a',
  },
  'planned-vs-actual-tasks': {
    descKey: 'descPlannedVsActualTasks',
    defaultDesc: 'Compare planned task dates with actual completion',
    color: '#1890ff',
  },
  'planned-vs-actual-milestones': {
    descKey: 'descPlannedVsActualMilestones',
    defaultDesc: 'Milestone plan vs delivery variance',
    color: '#722ed1',
  },
  utilization: {
    descKey: 'descUtilization',
    defaultDesc: 'Team capacity and billable utilization',
    color: '#13c2c2',
  },
  'time-report': {
    descKey: 'descTimeReport',
    defaultDesc: 'Logged time by project, member and date',
    color: '#fa8c16',
  },
  'budget-tracking': {
    descKey: 'descBudgetTracking',
    defaultDesc: 'Budget spent vs remaining by project',
    color: '#eb2f96',
  },
  velocity: {
    descKey: 'descVelocity',
    defaultDesc: 'Committed vs completed work per sprint',
    color: '#2f54eb',
  },
  'cumulative-flow': {
    descKey: 'descCumulativeFlow',
    defaultDesc: 'Work in each status over time',
    color: '#1890ff',
  },
  'time-in-status': {
    descKey: 'descTimeInStatus',
    defaultDesc: 'Average days work spends in each status',
    color: '#faad14',
  },
  sla: {
    descKey: 'descSla',
    defaultDesc: 'Response and resolution SLA compliance',
    color: '#f5222d',
  },
  dashboards: {
    descKey: 'descDashboards',
    defaultDesc: 'Personalised dashboards with gadgets',
    color: '#597ef7',
  },
  'client-dashboard': {
    descKey: 'descClientDashboard',
    defaultDesc: 'Read-only shared view for clients',
    color: '#36cfc9',
  },
};

const STAT_TONES = {
  ok: '#52c41a',
  warn: '#faad14',
  bad: '#ff4d4f',
} as const;

const AllReportsPage: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  useDocumentTitle(t('reportsTitle', { defaultValue: 'Reports' }));

  const { customReports, hasCustomReports } = useAnalyticsCustomReports();
  const session = useAppSelector(state => state.auth.user);

  const [tab, setTab] = useState<GalleryTab>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<GallerySort>('name');
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());

  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const cardBg = token.colorBgContainer;
  const muted = token.colorTextSecondary;

  // If custom reports disappear while that tab is selected, fall back to All.
  React.useEffect(() => {
    if (tab === 'custom' && !hasCustomReports) setTab('all');
  }, [tab, hasCustomReports]);

  const allRows: GalleryReportRow[] = useMemo(() => {
    const builtinRows = ANALYTICS_NAV.groups.flatMap(group =>
      group.items.map((item: AnalyticsNavItem) => {
        const meta = REPORT_DESCRIPTIONS[item.key] ?? {
          descKey: 'descGeneric',
          defaultDesc: 'Analytics report',
          color: token.colorPrimary,
        };
        return {
          key: item.key,
          path: item.path,
          name: t(item.labelKey, { defaultValue: item.defaultLabel }),
          description: t(meta.descKey, { defaultValue: meta.defaultDesc }),
          category: t(group.labelKey, { defaultValue: group.defaultLabel }),
          categoryKey: group.key,
          type: 'builtin' as const,
          creator: t('worklenzSystem', { defaultValue: 'Worklenz' }),
          lastAccessed: '—',
          scheduled: null,
          enabled: item.enabled,
          iconColor: meta.color,
        };
      })
    );

    const customRows: GalleryReportRow[] = customReports.map(report => ({
      key: `custom-${report.id}`,
      path: customReportPath(report.id),
      name: report.name,
      description:
        report.description ||
        t('descCustomReport', { defaultValue: 'Saved custom report' }),
      category: t('navGroupCustomReports', { defaultValue: 'Custom reports' }),
      categoryKey: CUSTOM_REPORTS_GROUP_KEY,
      type: 'custom' as const,
      creator: report.creatorName || session?.name || t('you', { defaultValue: 'You' }),
      lastAccessed: report.accessedAt
        ? new Date(report.accessedAt).toLocaleDateString()
        : '—',
      scheduled: null,
      enabled: true,
      iconColor: '#597ef7',
    }));

    return [...builtinRows, ...customRows];
  }, [t, token.colorPrimary, customReports, session?.name]);

  const tabCounts = useMemo(
    () => ({
      all: allRows.length,
      builtin: allRows.filter(r => r.type === 'builtin').length,
      custom: allRows.filter(r => r.type === 'custom').length,
      sched: allRows.filter(r => r.scheduled).length,
      fav: allRows.filter(r => favorites.has(r.key)).length,
    }),
    [allRows, favorites]
  );

  const filteredRows = useMemo(() => {
    let rows = allRows.filter(r => {
      if (tab === 'builtin') return r.type === 'builtin';
      if (tab === 'custom') return r.type === 'custom';
      if (tab === 'sched') return !!r.scheduled;
      if (tab === 'fav') return favorites.has(r.key);
      return true;
    });

    if (category !== 'all') {
      rows = rows.filter(r => r.categoryKey === category);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          r.creator.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    const sorters: Record<GallerySort, (a: GalleryReportRow, b: GalleryReportRow) => number> = {
      recent: (a, b) => a.name.localeCompare(b.name),
      created: (a, b) => a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      type: (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
    };
    return [...rows].sort(sorters[sort]);
  }, [allRows, tab, category, query, sort, favorites]);

  const toggleFavorite = (key: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openReport = (row: GalleryReportRow) => {
    navigate(analyticsPath(row.path));
  };

  // Placeholder portfolio health stats — wired to real APIs in a later phase
  const stats = [
    {
      key: 'on-track',
      label: t('statOnTrack', { defaultValue: 'On track' }),
      value: 0,
      sub: t('statProjects', { defaultValue: 'projects' }),
      tone: 'ok' as const,
    },
    {
      key: 'at-risk',
      label: t('statAtRisk', { defaultValue: 'At risk' }),
      value: 0,
      sub: t('statProjects', { defaultValue: 'projects' }),
      tone: 'warn' as const,
    },
    {
      key: 'off-track',
      label: t('statOffTrack', { defaultValue: 'Off track' }),
      value: 0,
      sub: t('statProjects', { defaultValue: 'projects' }),
      tone: 'bad' as const,
    },
    {
      key: 'overdue',
      label: t('statOverdueTasks', { defaultValue: 'Overdue tasks' }),
      value: 0,
      sub: t('statAcrossProjects', { defaultValue: 'across all projects' }),
      tone: 'bad' as const,
    },
  ];

  const columns: ColumnsType<GalleryReportRow> = [
    {
      key: 'fav',
      width: 48,
      render: (_, row) => {
        const isFav = favorites.has(row.key);
        return (
          <Button
            type="text"
            size="small"
            aria-label={
              isFav
                ? t('removeFavorite', { defaultValue: 'Remove from favourites' })
                : t('addFavorite', { defaultValue: 'Add to favourites' })
            }
            aria-pressed={isFav}
            icon={
              isFav ? (
                <StarFilled style={{ color: '#faad14' }} />
              ) : (
                <StarOutlined style={{ color: muted }} />
              )
            }
            onClick={e => {
              e.stopPropagation();
              toggleFavorite(row.key);
            }}
          />
        );
      },
    },
    {
      title: t('colName', { defaultValue: 'Name' }),
      key: 'name',
      render: (_, row) => (
        <div className="all-reports-gallery__rname">
          <span className="all-reports-gallery__rico" style={{ background: row.iconColor }}>
            {getAnalyticsNavIcon(row.type === 'custom' ? 'dashboards' : row.key)}
          </span>
          <div>
            <Link onClick={() => openReport(row)}>
              <Text strong style={{ color: 'inherit' }}>
                {row.name}
              </Text>
            </Link>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {row.description}
              </Text>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: t('colType', { defaultValue: 'Type' }),
      key: 'type',
      width: 120,
      render: (_, row) => (
        <Tag color={row.type === 'custom' ? 'blue' : undefined}>
          {row.type === 'custom'
            ? t('typeCustom', { defaultValue: 'Custom' })
            : t('typeWorklenz', { defaultValue: 'Worklenz' })}
        </Tag>
      ),
    },
    {
      title: t('colCategory', { defaultValue: 'Category' }),
      dataIndex: 'category',
      key: 'category',
      responsive: ['md'],
    },
    {
      title: t('colCreatedBy', { defaultValue: 'Created by' }),
      dataIndex: 'creator',
      key: 'creator',
      responsive: ['lg'],
    },
    {
      title: t('colLastAccessed', { defaultValue: 'Last accessed' }),
      dataIndex: 'lastAccessed',
      key: 'lastAccessed',
      responsive: ['lg'],
    },
    {
      title: t('colScheduled', { defaultValue: 'Scheduled' }),
      key: 'scheduled',
      width: 110,
      render: (_, row) =>
        row.scheduled ? (
          <Tag color="success">{row.scheduled}</Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      key: 'actions',
      width: 48,
      render: (_, row) => (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'open',
                label: t('actionOpen', { defaultValue: 'Open' }),
                onClick: () => openReport(row),
              },
              {
                key: 'dup',
                label:
                  row.type === 'custom'
                    ? t('actionDuplicate', { defaultValue: 'Duplicate' })
                    : t('actionSaveAsCustom', { defaultValue: 'Save as custom report' }),
                disabled: true,
              },
              {
                key: 'share',
                label: t('actionShare', { defaultValue: 'Share' }),
                disabled: true,
              },
              {
                key: 'sched',
                label: t('actionSchedule', { defaultValue: 'Schedule' }),
                disabled: true,
              },
            ],
          }}
        >
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            aria-label={t('rowActions', { defaultValue: 'Actions', name: row.name })}
            onClick={e => e.stopPropagation()}
          />
        </Dropdown>
      ),
    },
  ];

  const tabs: { key: GalleryTab; label: string; count: number }[] = [
    { key: 'all', label: t('tabAll', { defaultValue: 'All' }), count: tabCounts.all },
    {
      key: 'builtin',
      label: t('tabWorklenz', { defaultValue: 'Worklenz reports' }),
      count: tabCounts.builtin,
    },
    ...(hasCustomReports
      ? [
          {
            key: 'custom' as const,
            label: t('tabCustom', { defaultValue: 'Custom reports' }),
            count: tabCounts.custom,
          },
        ]
      : []),
    {
      key: 'sched',
      label: t('tabScheduled', { defaultValue: 'Scheduled' }),
      count: tabCounts.sched,
    },
    {
      key: 'fav',
      label: t('tabFavourites', { defaultValue: 'Favourites' }),
      count: tabCounts.fav,
    },
  ];

  return (
    <div className="all-reports-gallery">
      <div className="all-reports-gallery__header">
        <div>
          <Title level={2} style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
            {t('reportsTitle', { defaultValue: 'Reports' })}
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            {t('allReportsSubtitle', {
              defaultValue:
                'Every report in one place. Open, filter, save as your own, schedule or share.',
            })}
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} disabled>
          {t('newReport', { defaultValue: 'New report' })}
        </Button>
      </div>

      <div className="all-reports-gallery__stats">
        {stats.map(stat => (
          <button
            key={stat.key}
            type="button"
            className="all-reports-gallery__stat"
            style={{
              borderColor,
              background: cardBg,
              color: token.colorText,
            }}
            onClick={() => navigate(analyticsPath('project-health'))}
          >
            <div className="all-reports-gallery__stat-label" style={{ color: muted }}>
              <span
                className="all-reports-gallery__stat-dot"
                style={{ background: STAT_TONES[stat.tone] }}
              />
              {stat.label}
            </div>
            <div className="all-reports-gallery__stat-value">{stat.value}</div>
            <div className="all-reports-gallery__stat-sub" style={{ color: muted }}>
              {stat.sub}
            </div>
          </button>
        ))}
      </div>

      <div className="all-reports-gallery__tabs" style={{ borderColor }} role="tablist">
        {tabs.map(item => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`all-reports-gallery__tab${active ? ' is-active' : ''}`}
              style={{
                color: active ? token.colorPrimary : muted,
                borderBottomColor: active ? token.colorPrimary : 'transparent',
              }}
              onClick={() => setTab(item.key)}
            >
              {item.label}
              <span className="all-reports-gallery__tab-count">{item.count}</span>
            </button>
          );
        })}
      </div>

      <div className="all-reports-gallery__filters">
        <Input.Search
          allowClear
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('searchReports', { defaultValue: 'Search by name or creator' })}
          aria-label={t('searchReports', { defaultValue: 'Search by name or creator' })}
          style={{ width: 260, maxWidth: '100%' }}
        />
        <Select
          value={category}
          onChange={setCategory}
          style={{ minWidth: 160 }}
          aria-label={t('filterCategory', { defaultValue: 'Category' })}
          options={[
            { value: 'all', label: t('allCategories', { defaultValue: 'All categories' }) },
            ...ANALYTICS_NAV.groups
              .filter(g => g.key !== 'share')
              .map(g => ({
                value: g.key,
                label: t(g.labelKey, { defaultValue: g.defaultLabel }),
              })),
            ...(hasCustomReports
              ? [
                  {
                    value: CUSTOM_REPORTS_GROUP_KEY,
                    label: t('navGroupCustomReports', { defaultValue: 'Custom reports' }),
                  },
                ]
              : []),
          ]}
        />
        <Select
          value={sort}
          onChange={setSort}
          style={{ minWidth: 180 }}
          aria-label={t('sortReports', { defaultValue: 'Sort reports' })}
          options={[
            { value: 'recent', label: t('sortRecent', { defaultValue: 'Recently accessed' }) },
            { value: 'created', label: t('sortCreated', { defaultValue: 'Created date' }) },
            { value: 'name', label: t('sortName', { defaultValue: 'Name' }) },
            { value: 'type', label: t('sortType', { defaultValue: 'Type' }) },
          ]}
        />
      </div>

      <div
        className="all-reports-gallery__table-card"
        style={{ borderColor, background: cardBg }}
      >
        {filteredRows.length === 0 ? (
          <div className="all-reports-gallery__empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Flex vertical gap={4} align="center">
                  <Text strong>
                    {t('noReportsFound', { defaultValue: 'No reports found' })}
                  </Text>
                  <Text type="secondary">
                    {tab === 'sched'
                      ? t('noScheduledHint', {
                          defaultValue:
                            'Open any report and choose Schedule to email it on a recurring basis.',
                        })
                      : t('noReportsHint', {
                          defaultValue: 'Try a different search or create a custom report.',
                        })}
                  </Text>
                </Flex>
              }
            >
              <Button type="primary" icon={<PlusOutlined />} disabled>
                {t('newReport', { defaultValue: 'New report' })}
              </Button>
            </Empty>
          </div>
        ) : (
          <Table
            rowKey="key"
            columns={columns}
            dataSource={filteredRows}
            pagination={false}
            size="middle"
            onRow={row => ({
              onClick: () => openReport(row),
              style: { cursor: 'pointer' },
            })}
          />
        )}
      </div>
    </div>
  );
};

export default AllReportsPage;
