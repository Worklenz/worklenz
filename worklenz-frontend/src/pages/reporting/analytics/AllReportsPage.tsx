import React, { useEffect, useMemo, useState } from 'react';
import { Empty, Typography, theme } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  ANALYTICS_NAV,
  analyticsPath,
  customReportPath,
} from '@/lib/reporting/analytics-nav';
import { analyticsProjectHealthApiService } from '@/api/reporting/analytics-project-health.api.service';
import { analyticsTimeReportApiService } from '@/api/reporting/analytics-time-report.api.service';
import { analyticsBudgetTrackingApiService } from '@/api/reporting/analytics-budget-tracking.api.service';
import { analyticsUtilizationApiService } from '@/api/reporting/analytics-utilization.api.service';
import { analyticsVelocityApiService } from '@/api/reporting/analytics-velocity.api.service';
import { analyticsPlannedVsActualTasksApiService } from '@/api/reporting/analytics-planned-vs-actual-tasks.api.service';
import { analyticsPlannedVsActualMilestonesApiService } from '@/api/reporting/analytics-planned-vs-actual-milestones.api.service';
import { analyticsCfdApiService } from '@/api/reporting/analytics-cfd.api.service';
import { analyticsTimeInStatusApiService } from '@/api/reporting/analytics-time-in-status.api.service';
import { ReportCardPreview } from '@/components/reporting/analytics/ReportCardPreview';
import {
  syncTemplatesToCustomReports,
  useAnalyticsCustomReports,
} from '@/features/reporting/analytics-custom-reports';
import { analyticsTemplatesApiService } from '@/api/reporting/analytics-templates.api.service';
import './all-reports-gallery.css';

const { Title, Text } = Typography;

type HubTab = 'reports' | 'scheduled' | 'custom';

interface HubCardDef {
  key: string;
  path: string;
  titleKey: string;
  defaultTitle: string;
  descKey: string;
  defaultDesc: string;
  metricSubKey: string;
  defaultMetricSub: string;
  sparkHeights: number[];
  categoryKey: string;
}

interface CardMetrics {
  primary: string;
  spark: number[];
}

/** Descriptions + spark fallbacks for hub chart cards (enabled reports only). */
const REPORT_CARD_META: Record<
  string,
  {
    descKey: string;
    defaultDesc: string;
    metricSubKey: string;
    defaultMetricSub: string;
    sparkHeights: number[];
  }
> = {
  'project-health': {
    descKey: 'descProjectHealth',
    defaultDesc: 'Status, progress and overdue work by project',
    metricSubKey: 'hubProjectHealthMetricSub',
    defaultMetricSub: 'need attention',
    sparkHeights: [70, 55, 48, 62, 40, 52, 36, 44, 30, 38],
  },
  'planned-vs-actual-tasks': {
    descKey: 'descPlannedVsActualTasks',
    defaultDesc: 'Compare planned task dates with actual completion',
    metricSubKey: 'hubPvaTasksMetricSub',
    defaultMetricSub: 'completed vs planned',
    sparkHeights: [40, 52, 48, 64, 58, 70, 62, 74, 68, 80],
  },
  'planned-vs-actual-milestones': {
    descKey: 'descPlannedVsActualMilestones',
    defaultDesc: 'Milestone plan vs delivery variance',
    metricSubKey: 'hubPvaMsMetricSub',
    defaultMetricSub: 'late milestones',
    sparkHeights: [30, 42, 36, 50, 44, 58, 48, 62, 54, 66],
  },
  utilization: {
    descKey: 'descUtilization',
    defaultDesc: 'Team capacity (working hours) vs logged time',
    metricSubKey: 'hubUtilizationMetricSub',
    defaultMetricSub: 'team average',
    sparkHeights: [55, 62, 58, 70, 66, 74, 68, 72, 64, 76],
  },
  'time-report': {
    descKey: 'descTimeReport',
    defaultDesc: 'Logged vs estimated hours with billable split',
    metricSubKey: 'hubTimeBillingMetricSub',
    defaultMetricSub: 'billable this period',
    sparkHeights: [38, 52, 44, 68, 56, 72, 48, 80, 60, 74],
  },
  'budget-tracking': {
    descKey: 'descBudgetTracking',
    defaultDesc: 'Budget spent vs remaining by project',
    metricSubKey: 'hubBudgetBurnMetricSub',
    defaultMetricSub: 'of budget used',
    sparkHeights: [30, 40, 48, 56, 62, 70, 66, 74, 78, 84],
  },
  velocity: {
    descKey: 'descVelocity',
    defaultDesc: 'Committed vs completed work per sprint',
    metricSubKey: 'hubVelocityMetricSub',
    defaultMetricSub: 'avg velocity',
    sparkHeights: [45, 58, 52, 66, 60, 72, 64, 70, 68, 76],
  },
  'cumulative-flow': {
    descKey: 'descCumulativeFlow',
    defaultDesc: 'Work in each status over time',
    metricSubKey: 'hubCfdMetricSub',
    defaultMetricSub: 'current WIP',
    sparkHeights: [28, 36, 44, 52, 58, 64, 70, 74, 78, 82],
  },
  'time-in-status': {
    descKey: 'descTimeInStatus',
    defaultDesc: 'Average days work spends in each status',
    metricSubKey: 'hubTisMetricSub',
    defaultMetricSub: 'avg cycle days',
    sparkHeights: [62, 54, 48, 58, 42, 50, 38, 46, 34, 40],
  },
};

/** Share views (dashboards) excluded — enabled chart reports only. */
const CHART_REPORT_KEYS = new Set(Object.keys(REPORT_CARD_META));

const DEFAULT_SPARK = [40, 52, 44, 60, 50, 68, 56, 72, 58, 66];

const formatHours = (hours: number): string => {
  if (!Number.isFinite(hours)) return '0h';
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded.toLocaleString()}h`;
};

const formatPct = (pct: number): string => {
  if (!Number.isFinite(pct)) return '0%';
  return `${Math.round(pct)}%`;
};

const toSpark = (values: number[], fallback: number[]): number[] => {
  if (values.length === 0) return fallback;
  const max = Math.max(...values, 1);
  return values.slice(0, 10).map(v => Math.max(12, Math.round((v / max) * 100)));
};

const AllReportsPage: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const { customReports, hasCustomReports, refreshCustomReports } = useAnalyticsCustomReports();
  useDocumentTitle(t('reportsTitle', { defaultValue: 'Reports' }));

  const [tab, setTab] = useState<HubTab>('reports');
  const [metricsByKey, setMetricsByKey] = useState<Record<string, CardMetrics>>({});

  // Backfill Custom reports from API (all report kinds).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await analyticsTemplatesApiService.listTemplates('all');
        if (!cancelled && res.done && Array.isArray(res.body)) {
          syncTemplatesToCustomReports(res.body);
          refreshCustomReports();
        }
      } catch {
        // Custom reports remain local-only if API is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCustomReports]);

  useEffect(() => {
    if (tab === 'custom' && !hasCustomReports) {
      setTab('reports');
    }
  }, [tab, hasCustomReports]);

  const cards: HubCardDef[] = useMemo(
    () =>
      ANALYTICS_NAV.groups.flatMap(group =>
        group.items
          .filter(item => !!item.enabled && !!item.path && CHART_REPORT_KEYS.has(item.key))
          .map(item => {
            const meta = REPORT_CARD_META[item.key];
            return {
              key: item.key,
              path: item.path,
              titleKey: item.labelKey,
              defaultTitle: item.defaultLabel,
              descKey: meta.descKey,
              defaultDesc: meta.defaultDesc,
              metricSubKey: meta.metricSubKey,
              defaultMetricSub: meta.defaultMetricSub,
              sparkHeights: meta.sparkHeights,
              categoryKey: group.key,
            };
          })
      ),
    []
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, CardMetrics> = {};

      const settle = async <T,>(promise: Promise<T>): Promise<T | null> => {
        try {
          return await promise;
        } catch {
          return null;
        }
      };

      const [
        healthRes,
        timeRes,
        budgetRes,
        utilRes,
        velocityRes,
        pvaTasksRes,
        pvaMsRes,
        cfdRes,
        tisRes,
      ] = await Promise.all([
        settle(analyticsProjectHealthApiService.getSeries({})),
        settle(analyticsTimeReportApiService.getSeries({})),
        settle(analyticsBudgetTrackingApiService.getSeries({})),
        settle(analyticsUtilizationApiService.getSeries({})),
        settle(analyticsVelocityApiService.getSeries({ view_by: 'project' })),
        settle(analyticsPlannedVsActualTasksApiService.getSeries({})),
        settle(analyticsPlannedVsActualMilestonesApiService.getSeries({})),
        settle(analyticsCfdApiService.getSeries({})),
        settle(analyticsTimeInStatusApiService.getSeries({ view_mode: 'aggregate' })),
      ]);

      if (cancelled) return;

      if (healthRes?.done && healthRes.body) {
        const kpis = healthRes.body.kpis;
        const attention = (kpis.at_risk ?? 0) + (kpis.off_track ?? 0);
        const counted =
          (kpis.on_track ?? 0) +
          (kpis.at_risk ?? 0) +
          (kpis.off_track ?? 0) +
          (kpis.not_set ?? 0);
        const total = counted || healthRes.body.meta?.project_count || 0;
        next['project-health'] = {
          primary: t('hubProjectHealthMetric', {
            defaultValue: '{{attention}} of {{total}}',
            attention,
            total,
          }),
          spark: toSpark(
            [kpis.on_track, kpis.at_risk, kpis.off_track, kpis.not_set].map(n => n ?? 0),
            REPORT_CARD_META['project-health'].sparkHeights
          ),
        };
      }

      if (timeRes?.done && timeRes.body) {
        next['time-report'] = {
          primary: formatHours(timeRes.body.kpis.billable_hours ?? 0),
          spark: toSpark(
            (timeRes.body.projects ?? []).map(p => p.logged_hours || 0),
            REPORT_CARD_META['time-report'].sparkHeights
          ),
        };
      }

      if (budgetRes?.done && budgetRes.body) {
        next['budget-tracking'] = {
          primary: formatPct(budgetRes.body.kpis.utilization_pct ?? 0),
          spark: toSpark(
            (budgetRes.body.projects ?? []).map(p => p.burn_pct || 0),
            REPORT_CARD_META['budget-tracking'].sparkHeights
          ),
        };
      }

      if (utilRes?.done && utilRes.body) {
        next.utilization = {
          primary: formatPct(utilRes.body.kpis.avg_utilization_pct ?? 0),
          spark: toSpark(
            (utilRes.body.members ?? []).map(m => m.utilization_pct || 0),
            REPORT_CARD_META.utilization.sparkHeights
          ),
        };
      }

      if (velocityRes?.done && velocityRes.body) {
        const kpis = velocityRes.body.kpis;
        next.velocity = {
          primary: `${Math.round(kpis.avg_velocity ?? 0)}`,
          spark: toSpark(
            (velocityRes.body.series ?? []).map(s => s.completed ?? 0),
            REPORT_CARD_META.velocity.sparkHeights
          ),
        };
      }

      if (pvaTasksRes?.done && pvaTasksRes.body) {
        const kpis = pvaTasksRes.body.kpis;
        const planned = kpis.planned ?? 0;
        const completed = kpis.completed ?? 0;
        next['planned-vs-actual-tasks'] = {
          primary: planned > 0 ? `${completed}/${planned}` : `${completed}`,
          spark: toSpark(
            (pvaTasksRes.body.projects ?? []).map(p => p.completed ?? 0),
            REPORT_CARD_META['planned-vs-actual-tasks'].sparkHeights
          ),
        };
      }

      if (pvaMsRes?.done && pvaMsRes.body) {
        const kpis = pvaMsRes.body.kpis;
        next['planned-vs-actual-milestones'] = {
          primary: `${kpis.late ?? 0}`,
          spark: toSpark(
            (pvaMsRes.body.milestones ?? []).map(m => Math.abs(m.variance_days ?? 0)),
            REPORT_CARD_META['planned-vs-actual-milestones'].sparkHeights
          ),
        };
      }

      if (cfdRes?.done && cfdRes.body) {
        const { indicators, series, dates } = cfdRes.body;
        const pointCount = dates?.length ?? 0;
        const sparkValues =
          pointCount > 0
            ? Array.from({ length: Math.min(10, pointCount) }, (_, offset) => {
                const index = pointCount - Math.min(10, pointCount) + offset;
                return (series ?? []).reduce((sum, row) => sum + (row.values[index] ?? 0), 0);
              })
            : [];
        next['cumulative-flow'] = {
          primary: `${indicators.current_wip ?? 0}`,
          spark: toSpark(sparkValues, REPORT_CARD_META['cumulative-flow'].sparkHeights),
        };
      }

      if (tisRes?.done && tisRes.body) {
        const cycleDays = tisRes.body.summary.avg_cycle_days;
        next['time-in-status'] = {
          primary:
            cycleDays == null || !Number.isFinite(cycleDays)
              ? '—'
              : `${Math.round(cycleDays * 10) / 10}`,
          spark: toSpark(
            (tisRes.body.aggregate ?? []).map(row => row.avg_days ?? 0),
            REPORT_CARD_META['time-in-status'].sparkHeights
          ),
        };
      }

      setMetricsByKey(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const cardBg = token.colorBgContainer;
  const muted = token.colorTextSecondary;
  const pageMuted = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const tabsBg = isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5';

  const getMetrics = (card: HubCardDef): CardMetrics =>
    metricsByKey[card.key] ?? {
      primary: '—',
      spark: card.sparkHeights.length ? card.sparkHeights : DEFAULT_SPARK,
    };

  const tabs: { key: HubTab; label: string }[] = [
    { key: 'reports', label: t('hubTabReports', { defaultValue: 'Reports' }) },
    { key: 'scheduled', label: t('hubTabScheduled', { defaultValue: 'Scheduled' }) },
    ...(hasCustomReports
      ? [{ key: 'custom' as const, label: t('tabCustom', { defaultValue: 'Custom reports' }) }]
      : []),
  ];

  return (
    <div className={`all-reports-hub${isDark ? ' theme-dark' : ''}`}>
      <div className="all-reports-hub__header">
        <div>
          <Title level={2} className="all-reports-hub__title">
            {t('reportsTitle', { defaultValue: 'Reports' })}
          </Title>
          <Text type="secondary" className="all-reports-hub__subtitle">
            {t('hubSubtitle', {
              defaultValue:
                'The questions agencies ask every month-end, answered from one set of numbers.',
            })}
          </Text>
        </div>

        <div
          className="all-reports-hub__tabs"
          style={{ borderColor, background: tabsBg }}
          role="tablist"
          aria-label={t('hubTabsAria', { defaultValue: 'Report categories' })}
        >
          {tabs.map(item => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`all-reports-hub__tab${active ? ' is-active' : ''}`}
                style={{
                  color: active ? token.colorText : muted,
                  background: active ? cardBg : 'transparent',
                  boxShadow: active
                    ? isDark
                      ? '0 0 0 1px #303030'
                      : '0 1px 2px rgba(0,0,0,0.06)'
                    : 'none',
                }}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'scheduled' ? (
        <div className="all-reports-hub__empty" style={{ borderColor, background: cardBg }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <>
                <Text strong>
                  {t('hubNoScheduledTitle', { defaultValue: 'No scheduled reports yet' })}
                </Text>
                <br />
                <Text type="secondary">
                  {t('hubNoScheduledHint', {
                    defaultValue:
                      'Open any report and choose Schedule to email it on a recurring basis.',
                  })}
                </Text>
              </>
            }
          />
        </div>
      ) : tab === 'custom' ? (
        <div className="all-reports-hub__cards">
          {customReports.map(report => (
            <button
              key={report.id}
              type="button"
              className="all-reports-hub__card"
              style={{ borderColor, background: cardBg, color: token.colorText }}
              onClick={() => navigate(analyticsPath(customReportPath(report.id)))}
              aria-label={t('hubOpenReportAria', {
                defaultValue: 'Open {{name}}',
                name: report.name,
              })}
            >
              <div className="all-reports-hub__card-top">
                <span className="all-reports-hub__card-title">{report.name}</span>
                <span className="all-reports-hub__badge all-reports-hub__badge--included">
                  {t('typeCustom', { defaultValue: 'Custom' })}
                </span>
              </div>
              <Text type="secondary" className="all-reports-hub__card-desc">
                {report.description ||
                  t('descCustomReport', { defaultValue: 'Saved custom report' })}
              </Text>
              <div className="all-reports-hub__card-footer is-open">
                {t('hubOpenReport', { defaultValue: 'Open report ?' })}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="all-reports-hub__cards">
          {cards.map(card => {
            const metrics = getMetrics(card);
            return (
              <button
                key={card.key}
                type="button"
                className="all-reports-hub__card"
                style={{ borderColor, background: cardBg, color: token.colorText }}
                onClick={() => navigate(analyticsPath(card.path))}
                aria-label={t('hubOpenReportAria', {
                  defaultValue: 'Open {{name}}',
                  name: t(card.titleKey, { defaultValue: card.defaultTitle }),
                })}
              >
                <div className="all-reports-hub__card-top">
                  <span className="all-reports-hub__card-title">
                    {t(card.titleKey, { defaultValue: card.defaultTitle })}
                  </span>
                  <span className="all-reports-hub__badge all-reports-hub__badge--included">
                    {t('hubBadgeIncluded', { defaultValue: 'Included' })}
                  </span>
                </div>

                <Text type="secondary" className="all-reports-hub__card-desc">
                  {t(card.descKey, { defaultValue: card.defaultDesc })}
                </Text>

                <div className="all-reports-hub__card-body">
                  <div>
                    <div className="all-reports-hub__metric">{metrics.primary}</div>
                    <div className="all-reports-hub__metric-sub" style={{ color: muted }}>
                      {t(card.metricSubKey, { defaultValue: card.defaultMetricSub })}
                    </div>
                  </div>
                  <ReportCardPreview kind={card.key} series={metrics.spark} />
                </div>

                <div className="all-reports-hub__card-footer is-open">
                  {t('hubOpenReport', { defaultValue: 'Open report ?' })}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Text className="all-reports-hub__footnote" style={{ color: pageMuted }}>
        {t('hubFootnote', {
          defaultValue:
            'Figures reflect your workspace data for the current period. Open a report to change date range, projects, and filters.',
        })}
      </Text>
    </div>
  );
};

export default AllReportsPage;
