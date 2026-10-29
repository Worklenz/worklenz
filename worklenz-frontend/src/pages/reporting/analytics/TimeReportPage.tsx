import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flex, Space, Typography, message, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { jsPDF } from 'jspdf';

dayjs.extend(quarterOfYear);

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
  type AnalyticsDatePreset,
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
import type {
  TimeReportFilters,
  TimeReportSeriesResponse,
} from '@/types/reporting/analytics-time-report.types';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

const { Text } = Typography;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const downloadText = (content: string, filename: string, mime: string) => {
  downloadBlob(new Blob([content], { type: mime }), filename);
};

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

  const [datePreset, setDatePreset] = useState<AnalyticsDatePreset>('last_30_days');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<FilterOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TimeReportSeriesResponse | null>(null);

  const chartRef = useRef<TimeReportChartHandle>(null);
  /** Tracks team keys we already seeded with the latest-20 project default. */
  const seededProjectsForTeamsRef = useRef<string>('');
  const hasSelection = selectedProjectIds.length > 0 || selectedTeamIds.length > 0;

  const applyTemplateFilters = useCallback((template: AnalyticsReportTemplate) => {
    applyCommonAnalyticsTemplateFilters(template.filters_json, {
      setSelectedProjectIds,
      setSelectedMemberIds,
      setSelectedTeamIds,
      setDatePreset,
    });
  }, []);

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
    getFilters: () => ({
      project_ids: selectedProjectIds,
      member_ids: selectedMemberIds,
      team_ids: selectedTeamIds,
      date_preset: datePreset,
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

  const dateBounds = useMemo(() => {
    const end = dayjs();
    let start = end.subtract(30, 'day');
    if (datePreset === 'last_7_days') start = end.subtract(7, 'day');
    if (datePreset === 'last_14_days') start = end.subtract(14, 'day');
    if (datePreset === 'last_30_days') start = end.subtract(30, 'day');
    if (datePreset === 'last_60_days') start = end.subtract(60, 'day');
    if (datePreset === 'last_90_days') start = end.subtract(90, 'day');
    if (datePreset === 'this_quarter') start = end.startOf('quarter');
    if (datePreset === 'custom') start = end.subtract(30, 'day');
    return {
      date_from: start.startOf('day').toISOString(),
      date_to: end.endOf('day').toISOString(),
    };
  }, [datePreset]);

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
      setSelectedTeamIds(prev => (prev.length > 0 ? prev : sessionTeamId ? [sessionTeamId] : []));
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

  const loadProjectsForTeams = useCallback(async (teamIds: string[]) => {
    if (teamIds.length === 0) {
      setProjectOptions([]);
      return;
    }
    try {
      const projectResponses = await Promise.all(
        teamIds.map(teamId => reportingApiService.getOverviewProjectsByTeam(teamId))
      );
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
      setSelectedProjectIds(prev => {
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
      setProjectOptions([]);
    }
  }, []);

  const loadSeries = useCallback(async () => {
    if (!hasSelection) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analyticsTimeReportApiService.getSeries(filters);
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
      setError(
        t('errorDescription', {
          defaultValue: 'We could not load this report. Please try again.',
        })
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, hasSelection, t]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    void loadProjectsForTeams(selectedTeamIds);
  }, [selectedTeamIds, loadProjectsForTeams]);

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
    if (!data?.projects?.length) return;
    if (seededProjectsForTeamsRef.current === teamKey) return;

    const topIds = latestUpdatedProjectIds(data.projects);
    if (topIds.length === 0) return;
    seededProjectsForTeamsRef.current = teamKey;
    setSelectedProjectIds(topIds);
  }, [data, selectedProjectIds.length, selectedTeamIds]);

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
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text(title, 40, 40);
        doc.setFontSize(11);
        doc.text(
          `${t('trStatLogged', { defaultValue: 'Logged' })}: ${data.kpis.logged_hours}h  |  ` +
            `${t('trStatEstimated', { defaultValue: 'Estimated' })}: ${data.kpis.estimated_hours}h  |  ` +
            `${t('trStatBillable', { defaultValue: 'Billable' })}: ${data.kpis.billable_hours}h (${data.kpis.billable_pct}%)  |  ` +
            `${t('trStatOverEstimate', { defaultValue: 'Over estimate' })}: ${data.kpis.over_estimate_hours}h`,
          40,
          60
        );
        if (png) {
          doc.addImage(png, 'PNG', 40, 80, 720, 360);
        }
        doc.save(`time-report-${stamp}.pdf`);
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
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
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
      crumbs={
        isCustomTemplateView
          ? [
              {
                label: t('allReports', { defaultValue: 'All reports' }),
                path: ANALYTICS_BASE_PATH,
              },
              {
                label: t('tabCustom', { defaultValue: 'Custom templates' }),
                path: ANALYTICS_BASE_PATH,
              },
              { label: title },
            ]
          : [
              {
                label: t('allReports', { defaultValue: 'All reports' }),
                path: ANALYTICS_BASE_PATH,
              },
              { label: title },
            ]
      }
      lastUpdatedAt={data?.last_updated_at ?? null}
      filters={filterBar}
      onExport={handleExport}
      exportLoading={exporting}
      exportDisabled={!data || data.rows.length === 0}
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
