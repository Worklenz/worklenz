import { useLatestAnalyticsSeriesRequest } from '@/hooks/useLatestAnalyticsSeriesRequest';
import { useScopedAnalyticsSeriesData } from '@/hooks/useScopedAnalyticsSeriesData';
import { areAnalyticsProjectResponsesComplete, useAnalyticsProjectOptionsLoader } from '@/hooks/useAnalyticsProjectOptionsLoader';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flex, Space, Switch, Typography, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  downloadAnalyticsBrandedPdf,
  resolveAnalyticsPdfLogoUrl,
} from '@/lib/reporting/analytics-branded-pdf';
import { BOUNDED_ANALYTICS_DATE_PRESETS, resolveAnalyticsDateBounds } from '@/utils/date-presets';

import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { analyticsTimeInStatusApiService } from '@/api/reporting/analytics-time-in-status.api.service';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import {
  AnalyticsFilterBar,
  AnalyticsTemplateActions,
  ChartTableWrapper,
  ReportErrorState,
  ReportLoadingSkeleton,
  ReportPageShell,
  type AnalyticsExportFormat,
} from '@/components/reporting/analytics';
import {
  SingleSelectFilterPill,
  type FilterOption,
} from '@/components/common/filters/MultiSelectFilterPill';
import {
  TisAggregateChart,
  type TisAggregateChartHandle,
} from '@/components/reporting/analytics/time-in-status/TisAggregateChart';
import { TisAggregateTable } from '@/components/reporting/analytics/time-in-status/TisAggregateTable';
import {
  TisPerIssueChart,
  type TisPerIssueChartHandle,
} from '@/components/reporting/analytics/time-in-status/TisPerIssueChart';
import { TisPerIssueTable } from '@/components/reporting/analytics/time-in-status/TisPerIssueTable';
import { TisKpiTiles } from '@/components/reporting/analytics/time-in-status/TisKpiTiles';
import { useAnalyticsReportTemplates } from '@/hooks/useAnalyticsReportTemplates';
import {
  usePersistedAnalyticsFilters,
} from '@/hooks/usePersistedAnalyticsFilters';
import { applyCommonAnalyticsTemplateFilters } from '@/lib/reporting/analytics-template-filters';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import {
  getAnalyticsDashboardPermissions,
  resolveAnalyticsActorRole,
} from '@/lib/reporting/analytics-permissions';
import { buildAnalyticsScheduleFilters } from '@/lib/reporting/analytics-schedule-filters';
import type {
  TimeInStatusFilters,
  TimeInStatusSeriesResponse,
  TimeInStatusSort,
  TimeInStatusViewMode,
} from '@/types/reporting/analytics-time-in-status.types';
import { downloadBlob, downloadText } from '@/lib/reporting/download-file';
import { getTimeInStatusSortOptions } from '@/lib/reporting/time-in-status-sort-options';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

const { Text } = Typography;

const DEFAULT_DATE_MODE = 'overlapping' as const;

export interface TimeInStatusPageProps {
  customTemplateId?: string;
  customTemplateName?: string;
}

const TimeInStatusPage: React.FC<TimeInStatusPageProps> = ({
  customTemplateId,
  customTemplateName,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const dispatch = useAppDispatch();
  const baseTitle = t('timeInStatus', { defaultValue: 'Time in Status' });

  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const permissions = getAnalyticsDashboardPermissions({
    role: resolveAnalyticsActorRole(session),
    userId: session?.id,
  });
  const teamMembersState = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const teamsList = useAppSelector(state => state.teamReducer.teamsList);

  const {
    datePreset,
    customRange,
    setDateFilter,
    selectedProjectIds,
    setSelectedProjectIds,
    setAutomaticProjectIds,
    setAutomaticTeamIds,
    selectedMemberIds,
    setSelectedMemberIds,
    selectedTeamIds,
    setSelectedTeamIds,
    hasRestoredFilters,
  } = usePersistedAnalyticsFilters({
    reportKind: 'time-in-status',
    customTemplateId,
  });
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  const [reportView, setReportView] = useState<TimeInStatusViewMode>('aggregate');
  const [sort, setSort] = useState<TimeInStatusSort>('avg_desc');
  const [excludeWeekends, setExcludeWeekends] = useState(false);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aggregateChartRef = useRef<TisAggregateChartHandle>(null);
  const perIssueChartRef = useRef<TisPerIssueChartHandle>(null);
  const skipDefaultTemplate = hasRestoredFilters;

  const applyTemplateFilters = useCallback((template: AnalyticsReportTemplate) => {
    applyCommonAnalyticsTemplateFilters(template.filters_json, {
      setSelectedProjectIds,
      setSelectedMemberIds,
      setSelectedTeamIds,
      setDateFilter,
    });
  }, [setSelectedProjectIds, setSelectedMemberIds, setSelectedTeamIds, setDateFilter]);

  const {
    templates,
    saveOpen,
    setSaveOpen,
    savingTemplate,
    isCustomTemplateView,
    loadTemplates,
    handleSaveTemplate,
    applyTemplate,
  } = useAnalyticsReportTemplates({
    reportKind: 'time-in-status',
    customTemplateId,
    onApply: applyTemplateFilters,
    skipDefaultTemplate,
    wasRestored: hasRestoredFilters,
    getFilters: () =>
      buildAnalyticsScheduleFilters({
        selectedProjectIds,
        projectOptionsCount: projectOptions.length,
        selectedMemberIds,
        selectedTeamIds,
        datePreset,
        dateFrom: dateBounds.date_from,
        dateTo: dateBounds.date_to,
        extra: { custom_range: customRange },
      }),
  });

  const title = (isCustomTemplateView && customTemplateName?.trim()) || baseTitle;
  useDocumentTitle(title);

  const memberOptions: FilterOption[] = useMemo(() => {
    const list = (teamMembersState?.data ?? []) as ITeamMemberViewModel[];
    return list
      .filter(m => m.id)
      .map(m => ({
        value: String(m.id),
        label: m.name || m.email || String(m.id),
      }));
  }, [teamMembersState?.data]);

  const dateBounds = useMemo(
    () => resolveAnalyticsDateBounds(datePreset, customRange),
    [datePreset, customRange]
  );

  const filters: TimeInStatusFilters = useMemo(
    () => ({
      project_ids: selectedProjectIds,
      team_ids: selectedTeamIds,
      status_ids: [],
      assignee_ids: selectedMemberIds,
      issue_types: [],
      label_ids: [],
      epic_ids: [],
      sprint_ids: [],
      date_from: dateBounds.date_from,
      date_to: dateBounds.date_to,
      date_mode: DEFAULT_DATE_MODE,
      exclude_weekends: excludeWeekends,
      view_mode: reportView,
      sort,
      limit: reportView === 'per_issue' ? 100 : 50,
      offset: 0,
    }),
    [
      selectedProjectIds,
      selectedTeamIds,
      selectedMemberIds,
      dateBounds,
      excludeWeekends,
      reportView,
      sort,
    ]
  );

  const loadTeamsAndMembers = useCallback(async () => {
    setFiltersLoading(true);
    try {
      const [teamsRes] = await Promise.all([
        reportingApiService.getOverviewTeams(true),
        dispatch(
          getTeamMembers({
            index: 0,
            size: 100,
            field: null,
            order: null,
            search: null,
            all: true,
          })
        ),
      ]);

      const teams =
        teamsRes.done && Array.isArray(teamsRes.body)
          ? teamsRes.body.map((team: { id?: string; name?: string }) => ({
              value: String(team.id),
              label: team.name || String(team.id),
            }))
          : [];

      const sessionTeamId = session?.team_id ? String(session.team_id) : teams[0]?.value;
      setAutomaticTeamIds(prev => (prev.length > 0 ? prev : sessionTeamId ? [sessionTeamId] : []));
    } catch {
      message.error(
        t('errorDescription', {
          defaultValue: 'We could not load this report. Please try again.',
        })
      );
    } finally {
      setFiltersLoading(false);
    }
  }, [dispatch, session?.team_id, t]);

  const loadProjectsForTeams = useCallback(async (teamIds: string[], isCurrent: () => boolean) => {
    if (teamIds.length === 0) {
      setProjectOptions([]);
      return;
    }
    try {
      const projectResponses = await Promise.all(
        teamIds.map(teamId => reportingApiService.getOverviewProjectsByTeam(teamId))
      );
      if (!isCurrent() || !areAnalyticsProjectResponsesComplete(projectResponses)) return;
      const projects: FilterOption[] = [];
      const seen = new Set<string>();
      projectResponses.forEach(res => {
        if (res.done && Array.isArray(res.body)) {
          (res.body as Array<{ id: string; name: string }>).forEach(project => {
            if (!seen.has(project.id)) {
              seen.add(project.id);
              projects.push({ value: project.id, label: project.name });
            }
          });
        }
      });
      setProjectOptions(projects);
      setAutomaticProjectIds(prev => {
        const allowed = new Set(projects.map(p => p.value));
        // Keep prior picks that are still valid; never auto-select every project.
        return prev.filter(id => allowed.has(id));
      });
    } catch {
      // Preserve existing selections and options when a team request fails.
    }
  }, []);

  const localizeCategoryLabel = useCallback(
    (statusId: string, fallback: string) => {
      if (statusId === '__tis_todo__') {
        return t('cfdCategoryTodo', { defaultValue: 'To do' });
      }
      if (statusId === '__tis_doing__') {
        return t('cfdCategoryDoing', { defaultValue: 'In progress' });
      }
      if (statusId === '__tis_done__') {
        return t('cfdCategoryDone', { defaultValue: 'Done' });
      }
      return fallback;
    },
    [t]
  );

  const seriesScope = JSON.stringify([session?.team_id, session?.id, customTemplateId]);
  const seriesRequestKey = JSON.stringify([seriesScope, filters]);
  const { data, setData } = useScopedAnalyticsSeriesData<TimeInStatusSeriesResponse>(seriesScope, seriesRequestKey);
  const beginSeriesRequest = useLatestAnalyticsSeriesRequest(seriesRequestKey);

  const loadSeries = useCallback(async () => {
    const isCurrent = beginSeriesRequest();
    setLoading(true);
    setError(null);
    try {
      // Empty project_ids ? all accessible projects rolled into To do / Doing / Done.
      // Selected project_ids ? that project's full status list.
      const res = await analyticsTimeInStatusApiService.getSeries(filters);
      if (!isCurrent()) return;
      if (res.done && res.body) {
        const localizedStatuses = res.body.statuses.map(status => ({
          ...status,
          name: localizeCategoryLabel(status.id, status.name),
        }));
        const localizedAggregate = res.body.aggregate.map(row => ({
          ...row,
          status_name: localizeCategoryLabel(row.status_id, row.status_name),
        }));
        const localizedIssues = res.body.issues.map(issue => ({
          ...issue,
          segments: issue.segments.map(seg => ({
            ...seg,
            status_name: localizeCategoryLabel(seg.status_id, seg.status_name),
          })),
        }));
        setData({
          ...res.body,
          statuses: localizedStatuses,
          aggregate: localizedAggregate,
          issues: localizedIssues,
        });
      } else {
        setError(
          res.message ||
            t('errorDescription', {
              defaultValue: 'We could not load this report. Please try again.',
            })
        );
        setData(null);
      }
    } catch {
      if (!isCurrent()) return;
      setError(
        t('errorDescription', {
          defaultValue: 'We could not load this report. Please try again.',
        })
      );
      setData(null);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [filters, localizeCategoryLabel, t, beginSeriesRequest, setData]);

  useEffect(() => {
    void loadTeamsAndMembers();
  }, [loadTeamsAndMembers]);

  useAnalyticsProjectOptionsLoader(
    selectedTeamIds,
    JSON.stringify([session?.team_id, session?.id, customTemplateId]),
    loadProjectsForTeams
  );

  useEffect(() => {
    if (filtersLoading) return;
    void loadSeries();
  }, [loadSeries, filtersLoading]);

  useEffect(() => {
    setSort(reportView === 'per_issue' ? 'total_desc' : 'avg_desc');
  }, [reportView]);

  const handleExport = async (format: AnalyticsExportFormat) => {
    if (!data) return;
    setExporting(true);
    try {
      const stamp = dayjs().format('YYYY-MM-DD');
      const chartRef = reportView === 'aggregate' ? aggregateChartRef : perIssueChartRef;

      if (format === 'csv') {
        const blob = await analyticsTimeInStatusApiService.exportCsv(filters);
        downloadBlob(
          blob,
          `time-in-status-${reportView === 'per_issue' ? 'issues' : 'aggregate'}-${stamp}.csv`
        );
        return;
      }
      if (format === 'png') {
        const png = chartRef.current?.toPngDataUrl();
        if (!png) {
          message.warning(
            t('exportChartMissing', { defaultValue: 'Chart is not ready to export' })
          );
          return;
        }
        const res = await fetch(png);
        downloadBlob(await res.blob(), `time-in-status-${stamp}.png`);
        return;
      }
      if (format === 'svg') {
        const svg = chartRef.current?.toSvgMarkup();
        if (!svg) {
          message.warning(
            t('exportChartMissing', { defaultValue: 'Chart is not ready to export' })
          );
          return;
        }
        downloadText(svg, `time-in-status-${stamp}.svg`, 'image/svg+xml');
        return;
      }
      if (format === 'pdf') {
        const png = chartRef.current?.toPngDataUrl();
        await downloadAnalyticsBrandedPdf({
          title,
          filename: `time-in-status-${stamp}.pdf`,
          logoUrl: resolveAnalyticsPdfLogoUrl(teamsList, session?.team_id),
          chartPngDataUrl: png,
          tableRows: [
            ['Status', 'Avg days', 'Median', 'Count', '% cycle'],
            ...data.aggregate.map(row => [
              row.status_name,
              String(row.avg_days),
              String(row.median_days),
              String(row.count),
              String(row.pct_cycle_time),
            ]),
          ],
          kpis: [
            {
              label: t('tisKpiIssues', { defaultValue: 'Issues' }),
              value: String(data.summary.issue_count),
              tone: '#1890ff',
            },
            {
              label: t('tisKpiAvgCycle', { defaultValue: 'Avg cycle' }),
              value:
                data.summary.avg_cycle_days == null
                  ? '—'
                  : String(data.summary.avg_cycle_days),
              tone: '#faad14',
            },
            {
              label: t('tisKpiOutliers', { defaultValue: 'Outliers' }),
              value: String(data.summary.outlier_count),
              tone: data.summary.outlier_count > 0 ? '#ff4d4f' : '#52c41a',
            },
            {
              label: t('tisKpiVisits', { defaultValue: 'Status visits' }),
              value: String(data.summary.status_visit_count),
              tone: '#722ed1',
            },
          ],
        });
      }
    } catch {
      message.error(t('exportFailed', { defaultValue: 'Export failed' }));
    } finally {
      setExporting(false);
    }
  };

  const sortOptions = getTimeInStatusSortOptions(reportView, {
    avgDesc: t('tisSortAvgDesc', { defaultValue: 'Avg (high → low)' }),
    avgAsc: t('tisSortAvgAsc', { defaultValue: 'Avg (low → high)' }),
    medianDesc: t('tisSortMedianDesc', { defaultValue: 'Median (high → low)' }),
    countDesc: t('tisSortCountDesc', { defaultValue: 'Count (high → low)' }),
    statusName: t('tisSortNameAsc', { defaultValue: 'Status name' }),
    totalDesc: t('tisSortTotalDesc', { defaultValue: 'Total (high → low)' }),
    totalAsc: t('tisSortTotalAsc', { defaultValue: 'Total (low → high)' }),
    taskKey: t('tisSortKeyAsc', { defaultValue: 'Task key' }),
    taskName: t('tisSortTaskNameAsc', { defaultValue: 'Task name' }),
  });

  const tisFilters = (
    <Flex gap={8} wrap="wrap" align="center" style={{ width: '100%' }}>
      <AnalyticsFilterBar
        projectOptions={projectOptions}
        selectedProjectIds={selectedProjectIds}
        onProjectsChange={setSelectedProjectIds}
        memberOptions={memberOptions}
        selectedMemberIds={selectedMemberIds}
        onMembersChange={setSelectedMemberIds}
        datePreset={datePreset}
        customRange={customRange}
        onDateChange={setDateFilter}
        availableDatePresets={BOUNDED_ANALYTICS_DATE_PRESETS}
        loading={filtersLoading}
      />

      <SingleSelectFilterPill
        label={
          reportView === 'per_issue'
            ? t('tisViewPerIssue', { defaultValue: 'Per issue' })
            : t('tisViewAggregate', { defaultValue: 'Aggregate' })
        }
        value={reportView}
        onChange={value => setReportView(value as TimeInStatusViewMode)}
        options={[
          {
            value: 'aggregate',
            label: t('tisViewAggregate', { defaultValue: 'Aggregate' }),
          },
          {
            value: 'per_issue',
            label: t('tisViewPerIssue', { defaultValue: 'Per issue' }),
          },
        ]}
        ariaLabel={t('tisViewMode', { defaultValue: 'View mode' })}
      />

      <SingleSelectFilterPill
        label={
          sortOptions.find(option => option.value === sort)?.label ??
          sortOptions[0]?.label ??
          ''
        }
        value={sort}
        onChange={value => setSort(value as TimeInStatusSort)}
        options={sortOptions}
        ariaLabel={t('tisSort', { defaultValue: 'Sort' })}
      />

      <Space size={6} style={{ flexShrink: 0 }}>
        <Switch
          checked={excludeWeekends}
          onChange={setExcludeWeekends}
          aria-label={t('tisExcludeWeekends', { defaultValue: 'Exclude weekends' })}
        />
        <Text style={{ whiteSpace: 'nowrap' }}>
          {t('tisExcludeWeekends', { defaultValue: 'Exclude weekends' })}
        </Text>
      </Space>
    </Flex>
  );

  return (
    <ReportPageShell
      title={title}
      filters={tisFilters}
      onExport={handleExport}
      exportDisabled={!data}
      exportFormats={['csv', 'pdf', 'png', 'svg']}
      exportLoading={exporting}
      schedule={{
        reportKind: 'time-in-status',
        reportName: title,
        templateId: customTemplateId,
        getFilters: () =>
      buildAnalyticsScheduleFilters({
        selectedProjectIds,
        projectOptionsCount: projectOptions.length,
        selectedMemberIds,
        selectedTeamIds,
        datePreset,
        dateFrom: dateBounds.date_from,
        dateTo: dateBounds.date_to,
        extra: { custom_range: customRange },
      }),
      }}
      actions={
        !isCustomTemplateView ? (
          <AnalyticsTemplateActions
            templates={templates}
            canShare={permissions.canShare}
            saveDisabled={false}
            saveOpen={saveOpen}
            savingTemplate={savingTemplate}
            onSaveOpenChange={setSaveOpen}
            onRefresh={() => void loadTemplates()}
            onApply={applyTemplate}
            onSave={values => void handleSaveTemplate(values)}
          />
        ) : undefined
      }
    >
      {loading && !data ? (
        <ReportLoadingSkeleton />
      ) : error ? (
        <ReportErrorState message={error} onRetry={() => void loadSeries()} />
      ) : (
        <Flex vertical gap={16}>
          {data && <TisKpiTiles summary={data.summary} />}

          <ChartTableWrapper
            chartTitle={title}
            rowCount={
              data
                ? reportView === 'aggregate'
                  ? data.aggregate.length
                  : data.issues.length
                : undefined
            }
            chart={
              data ? (
                reportView === 'aggregate' ? (
                  <TisAggregateChart ref={aggregateChartRef} rows={data.aggregate} />
                ) : (
                  <TisPerIssueChart
                    ref={perIssueChartRef}
                    issues={data.issues}
                    statuses={data.statuses}
                  />
                )
              ) : null
            }
            table={
              data ? (
                reportView === 'aggregate' ? (
                  <TisAggregateTable rows={data.aggregate} />
                ) : (
                  <TisPerIssueTable issues={data.issues} />
                )
              ) : null
            }
          />
        </Flex>
      )}
    </ReportPageShell>
  );
};

export default TimeInStatusPage;
