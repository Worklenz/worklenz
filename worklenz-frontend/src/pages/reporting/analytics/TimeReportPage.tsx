import { useScopedAnalyticsSeriesData } from '@/hooks/useScopedAnalyticsSeriesData';
import { useLatestAnalyticsSeriesRequest } from '@/hooks/useLatestAnalyticsSeriesRequest';
import { useScopedAnalyticsProjectSeed } from '@/hooks/useScopedAnalyticsProjectSeed';
import { areAnalyticsProjectResponsesComplete, useAnalyticsProjectOptionsLoader } from '@/hooks/useAnalyticsProjectOptionsLoader';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flex, Space, Typography, message, theme } from '@/shared/antd-imports';
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
import { analyticsTimeReportApiService } from '@/api/reporting/analytics-time-report.api.service';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import {
  AnalyticsFilterBar,
  AnalyticsTemplateActions,
  ChartTableWrapper,
  ReportEmptyState,
  ReportErrorState,
  ReportLoadingSkeleton,
  ReportPageShell,
  type AnalyticsExportFormat,
} from '@/components/reporting/analytics';
import type { FilterOption } from '@/components/common/filters/MultiSelectFilterPill';
import {
  TimeReportChart,
  type TimeReportChartHandle,
} from '@/components/reporting/analytics/time-report/TimeReportChart';
import { TimeReportKpiTiles } from '@/components/reporting/analytics/time-report/TimeReportKpiTiles';
import { TimeReportTable } from '@/components/reporting/analytics/time-report/TimeReportTable';
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
import {
  DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT,
  latestUpdatedOptionIds,
  latestUpdatedProjectIds,
  projectsForAnalyticsChart,
} from '@/lib/reporting/analytics-chart-projects';
import { buildAnalyticsScheduleFilters } from '@/lib/reporting/analytics-schedule-filters';
import { downloadBlob, downloadText } from '@/lib/reporting/download-file';
import type {
  TimeReportFilters,
  TimeReportSeriesResponse,
} from '@/types/reporting/analytics-time-report.types';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

const { Text } = Typography;

export interface TimeReportPageProps {
  customTemplateId?: string;
  customTemplateName?: string;
}

const TimeReportPage: React.FC<TimeReportPageProps> = ({
  customTemplateId,
  customTemplateName,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const baseTitle = t('timeReport', { defaultValue: 'Time Report' });

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
    selectedTeamIds,
    setSelectedTeamIds,
    selectedMemberIds,
    setSelectedMemberIds,
    hasRestoredFilters,
  } = usePersistedAnalyticsFilters({
    reportKind: 'time-report',
    customTemplateId,
  });
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<FilterOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chartRef = useRef<TimeReportChartHandle>(null);
  /** Tracks team keys we already seeded with the latest-20 project default. */
  const projectOptionsScope = JSON.stringify([session?.team_id, session?.id, customTemplateId]);
  const seededProjectsForTeamsRef = useScopedAnalyticsProjectSeed(projectOptionsScope);
  const hasSelection = selectedProjectIds.length > 0 || selectedTeamIds.length > 0;
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
    reportKind: 'time-report',
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
  }, [teamMembersState]);

  const defaultTeamIds = useMemo(() => {
    const id = session?.team_id ? String(session.team_id) : teamOptions[0]?.value;
    return id ? [id] : [];
  }, [session?.team_id, teamOptions]);

  const dateBounds = useMemo(
    () => resolveAnalyticsDateBounds(datePreset, customRange),
    [datePreset, customRange]
  );

  const filters: TimeReportFilters = useMemo(
    () => ({
      project_ids: selectedProjectIds,
      team_ids: selectedTeamIds,
      member_ids: selectedMemberIds,
      date_from: dateBounds.date_from,
      date_to: dateBounds.date_to,
    }),
    [selectedProjectIds, selectedTeamIds, selectedMemberIds, dateBounds]
  );

  const loadTeams = useCallback(async () => {
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
      setTeamOptions(teams);
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
      const projectsWithUpdatedAt: Array<{ id: string; updated_at?: string | null }> = [];
      const seen = new Set<string>();
      projectResponses.forEach(res => {
        if (res.done && Array.isArray(res.body)) {
          (
            res.body as Array<{ id: string; name: string; updated_at?: string | null }>
          ).forEach(project => {
            if (!seen.has(project.id)) {
              seen.add(project.id);
              projects.push({ value: project.id, label: project.name });
              projectsWithUpdatedAt.push({
                id: project.id,
                updated_at: project.updated_at ?? null,
              });
            }
          });
        }
      });
      setProjectOptions(projects);

      const teamKey = [...teamIds].sort().join(',');
      setAutomaticProjectIds(prev => {
        const allowed = new Set(projects.map(p => p.value));
        const kept = prev.filter(id => allowed.has(id));
        if (kept.length > 0) {
          seededProjectsForTeamsRef.current = teamKey;
          return kept;
        }
        // Default: select the 20 most recently updated projects.
        if (seededProjectsForTeamsRef.current === teamKey) return kept;
        const topIds = latestUpdatedOptionIds(projectsWithUpdatedAt).filter(id =>
          allowed.has(id)
        );
        seededProjectsForTeamsRef.current = teamKey;
        return topIds;
      });
    } catch {
      // Preserve existing selections and options when a team request fails.
    }
  }, [seededProjectsForTeamsRef]);

  const seriesRequestKey = JSON.stringify([projectOptionsScope, filters]);
  const { data, matchingData, setData } = useScopedAnalyticsSeriesData<TimeReportSeriesResponse>(projectOptionsScope, seriesRequestKey);
  const beginSeriesRequest = useLatestAnalyticsSeriesRequest(seriesRequestKey);

  const loadSeries = useCallback(async () => {
    const isCurrent = beginSeriesRequest();
    if (!hasSelection) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analyticsTimeReportApiService.getSeries(filters);
      if (!isCurrent()) return;
      if (res.done && res.body) {
        setData(res.body);
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
  }, [filters, hasSelection, t, beginSeriesRequest, setData]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useAnalyticsProjectOptionsLoader(
    selectedTeamIds,
    projectOptionsScope,
    loadProjectsForTeams
  );

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  // Fallback seed from series data when overview projects had no updated_at yet.
  useEffect(() => {
    const teamKey = [...selectedTeamIds].sort().join(',');
    if (selectedProjectIds.length > 0) {
      seededProjectsForTeamsRef.current = teamKey;
      return;
    }
    if (!matchingData?.projects?.length) return;
    if (seededProjectsForTeamsRef.current === teamKey) return;

    const topIds = latestUpdatedProjectIds(matchingData.projects);
    if (topIds.length === 0) return;
    seededProjectsForTeamsRef.current = teamKey;
    setAutomaticProjectIds(topIds);
  }, [matchingData, selectedProjectIds.length, selectedTeamIds, seededProjectsForTeamsRef, setAutomaticProjectIds]);

  const handleExport = async (format: AnalyticsExportFormat) => {
    if (!data) return;
    setExporting(true);
    try {
      const stamp = dayjs().format('YYYY-MM-DD');
      if (format === 'csv') {
        const blob = await analyticsTimeReportApiService.exportCsv(filters);
        downloadBlob(blob, `time-report-${stamp}.csv`);
        return;
      }
      if (format === 'png') {
        const png = chartRef.current?.toPngDataUrl();
        if (!png) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        const res = await fetch(png);
        downloadBlob(await res.blob(), `time-report-${stamp}.png`);
        return;
      }
      if (format === 'svg') {
        const svg = chartRef.current?.toSvgMarkup();
        if (!svg) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        downloadText(svg, `time-report-${stamp}.svg`, 'image/svg+xml');
        return;
      }
      if (format === 'pdf') {
        const png = chartRef.current?.toPngDataUrl();
        await downloadAnalyticsBrandedPdf({
          title,
          filename: `time-report-${stamp}.pdf`,
          logoUrl: resolveAnalyticsPdfLogoUrl(teamsList, session?.team_id),
          chartPngDataUrl: png,
          tableRows: [
            ['Member', 'Project', 'Logged', 'Estimated', 'Billable'],
            ...data.rows.map(row => [
              row.member_name,
              row.project_name,
              String(row.logged_hours),
              String(row.estimated_hours),
              String(row.billable_hours),
            ]),
          ],
          kpis: [
            {
              label: t('trStatLogged', { defaultValue: 'Logged' }),
              value: `${data.kpis.logged_hours}h`,
              tone: '#1890ff',
            },
            {
              label: t('trStatEstimated', { defaultValue: 'Estimated' }),
              value: `${data.kpis.estimated_hours}h`,
              tone: '#8c8c8c',
            },
            {
              label: t('trStatBillable', { defaultValue: 'Billable' }),
              value: `${data.kpis.billable_hours}h`,
              sub: `${data.kpis.billable_pct}%`,
              tone: '#52c41a',
            },
            {
              label: t('trStatOverEstimate', { defaultValue: 'Over estimate' }),
              value: `${data.kpis.over_estimate_hours}h`,
              tone: '#faad14',
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

  const hasExplicitProjectFilter = selectedProjectIds.length > 0;
  const chartProjects = useMemo(() => {
    if (!data?.projects?.length) return [];
    return projectsForAnalyticsChart(data.projects, {
      explicitProjectFilter: hasExplicitProjectFilter,
      limit: DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT,
    });
  }, [data?.projects, hasExplicitProjectFilter]);

  const chartProjectIds = useMemo(
    () => chartProjects.map(project => project.project_id),
    [chartProjects]
  );

  const filterBar = (
    <Flex gap={8} wrap="wrap" align="center" style={{ width: '100%' }}>
      <AnalyticsFilterBar
        projectOptions={projectOptions}
        selectedProjectIds={selectedProjectIds}
        onProjectsChange={setSelectedProjectIds}
        indicatedProjectIds={chartProjectIds}
        memberOptions={memberOptions}
        selectedMemberIds={selectedMemberIds}
        onMembersChange={setSelectedMemberIds}
        teamOptions={teamOptions}
        selectedTeamIds={selectedTeamIds}
        onTeamsChange={setSelectedTeamIds}
        defaultTeamIds={defaultTeamIds}
        datePreset={datePreset}
        customRange={customRange}
        onDateChange={setDateFilter}
        availableDatePresets={BOUNDED_ANALYTICS_DATE_PRESETS}
        loading={filtersLoading}
      />
    </Flex>
  );

  let body: React.ReactNode;
  if (!hasSelection) {
    body = (
      <ReportEmptyState
        title={t('trNoSelectionTitle', { defaultValue: 'Select projects or teams' })}
        description={t('trNoSelectionDescription', {
          defaultValue:
            'Choose one or more projects (or a team) to view logged vs estimated hours.',
        })}
      />
    );
  } else if (loading && !data) {
    body = <ReportLoadingSkeleton />;
  } else if (error) {
    body = <ReportErrorState message={error} onRetry={() => void loadSeries()} />;
  } else if (data) {
    body = (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <TimeReportKpiTiles kpis={data.kpis} />
        <ChartTableWrapper
          chartTitle={title}
          chart={
            <>
              {!hasExplicitProjectFilter &&
                data.projects.length > DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT && (
                  <Text
                    type="secondary"
                    style={{ display: 'block', marginBottom: 8, fontSize: 12 }}
                  >
                    {t('phBarChartLatestNote', {
                      defaultValue:
                        'Showing the latest updated {{count}} projects in this graph. Select all projects to show every project.',
                      count: DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT,
                    })}
                  </Text>
                )}
              <TimeReportChart ref={chartRef} projects={chartProjects} />
            </>
          }
          table={<TimeReportTable rows={data.rows} loading={loading} />}
        />
        {data.rows.length === 0 && (
          <Text type="secondary" style={{ color: token.colorTextSecondary }}>
            {t('trChartEmpty', { defaultValue: 'No time data matches these filters.' })}
          </Text>
        )}
      </Space>
    );
  } else {
    body = <ReportLoadingSkeleton />;
  }

  return (
    <ReportPageShell
      title={title}
      filters={filterBar}
      onExport={handleExport}
      exportLoading={exporting}
      exportDisabled={!data || data.rows.length === 0}
      schedule={{
        reportKind: 'time-report',
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
            saveDisabled={!hasSelection}
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
      {body}
    </ReportPageShell>
  );
};

export default TimeReportPage;
