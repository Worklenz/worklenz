import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flex, Space, Typography, message, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';

import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { analyticsPlannedVsActualTasksApiService } from '@/api/reporting/analytics-planned-vs-actual-tasks.api.service';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import {
  AnalyticsFilterBar,
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
  PvaTasksChart,
  type PvaTasksChartHandle,
} from '@/components/reporting/analytics/planned-vs-actual-tasks/PvaTasksChart';
import { PvaTasksKpiTiles } from '@/components/reporting/analytics/planned-vs-actual-tasks/PvaTasksKpiTiles';
import { PvaTasksTable } from '@/components/reporting/analytics/planned-vs-actual-tasks/PvaTasksTable';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import {
  DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT,
  latestUpdatedProjectIds,
  projectsForAnalyticsChart,
} from '@/lib/reporting/analytics-chart-projects';
import type {
  PlannedVsActualTasksFilters,
  PlannedVsActualTasksSeriesResponse,
} from '@/types/reporting/analytics-planned-vs-actual-tasks.types';
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

const PlannedVsActualTasksPage: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const title = t('plannedVsActualTasks', { defaultValue: 'Planned vs Actual: Tasks' });
  useDocumentTitle(title);

  const authService = useAuthService();
  const session = authService.getCurrentSession();
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
  const [data, setData] = useState<PlannedVsActualTasksSeriesResponse | null>(null);

  const chartRef = useRef<PvaTasksChartHandle>(null);
  /** Tracks team keys we already seeded with the latest-20 project default. */
  const seededProjectsForTeamsRef = useRef<string>('');
  const hasSelection = selectedProjectIds.length > 0 || selectedTeamIds.length > 0;

  const memberOptions: FilterOption[] = useMemo(() => {
    const list = (teamMembersState?.data ?? []) as ITeamMemberViewModel[];
    return list
      .filter(m => m.id)
      .map(m => ({
        value: String(m.id),
        label: m.name || m.email || String(m.id),
      }));
  }, [teamMembersState]);

  const filters: PlannedVsActualTasksFilters = useMemo(
    () => ({
      project_ids: selectedProjectIds,
      team_ids: selectedTeamIds,
      member_ids: selectedMemberIds,
    }),
    [selectedProjectIds, selectedTeamIds, selectedMemberIds]
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
      setSelectedProjectIds(prev => {
        const allowed = new Set(projects.map(p => p.value));
        return prev.filter(id => allowed.has(id));
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
      const res = await analyticsPlannedVsActualTasksApiService.getSeries(filters);
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

  // Default project filter: latest updated 20 (once per team selection).
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
        const blob = await analyticsPlannedVsActualTasksApiService.exportCsv(filters);
        downloadBlob(blob, `planned-vs-actual-tasks-${stamp}.csv`);
        return;
      }
      if (format === 'png') {
        const png = chartRef.current?.toPngDataUrl();
        if (!png) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        const res = await fetch(png);
        downloadBlob(await res.blob(), `planned-vs-actual-tasks-${stamp}.png`);
        return;
      }
      if (format === 'svg') {
        const svg = chartRef.current?.toSvgMarkup();
        if (!svg) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        downloadText(svg, `planned-vs-actual-tasks-${stamp}.svg`, 'image/svg+xml');
        return;
      }
      if (format === 'pdf') {
        const png = chartRef.current?.toPngDataUrl();
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text(title, 40, 40);
        doc.setFontSize(11);
        doc.text(
          `${t('pvaTasksStatPlanned', { defaultValue: 'Planned tasks' })}: ${data.kpis.planned}  |  ` +
            `${t('pvaTasksStatCompleted', { defaultValue: 'Completed' })}: ${data.kpis.completed}  |  ` +
            `${t('pvaTasksStatOverdue', { defaultValue: 'Overdue' })}: ${data.kpis.overdue}  |  ` +
            `${t('pvaTasksStatAvgVariance', { defaultValue: 'Avg variance' })}: ${data.kpis.avg_variance_days}d`,
          40,
          60
        );
        if (png) {
          doc.addImage(png, 'PNG', 40, 80, 720, 360);
        }
        doc.save(`planned-vs-actual-tasks-${stamp}.pdf`);
      }
    } catch {
      message.error(t('exportFailed', { defaultValue: 'Export failed' }));
    } finally {
      setExporting(false);
    }
  };

  // Chart: latest 20 when no project filter; all returned projects after Select all / explicit picks.
  const hasExplicitProjectFilter = selectedProjectIds.length > 0;
  const chartProjects = useMemo(() => {
    if (!data?.projects?.length) return [];
    return projectsForAnalyticsChart(data.projects, {
      explicitProjectFilter: hasExplicitProjectFilter,
      limit: DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT,
    });
  }, [data?.projects, hasExplicitProjectFilter]);

  const chartProjectIds = useMemo(
    () => chartProjects.map(p => p.project_id),
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
        title={t('pvaTasksNoSelectionTitle', { defaultValue: 'Select projects or teams' })}
        description={t('pvaTasksNoSelectionDescription', {
          defaultValue:
            'Choose one or more projects (or a team) to compare planned vs actual tasks.',
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
        <PvaTasksKpiTiles kpis={data.kpis} />
        <ChartTableWrapper
          chartTitle={title}
          rowCount={data.projects.length}
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
              <PvaTasksChart ref={chartRef} projects={chartProjects} />
            </>
          }
          table={<PvaTasksTable projects={data.projects} loading={loading} />}
        />
        {data.projects.length === 0 && (
          <Text type="secondary" style={{ color: token.colorTextSecondary }}>
            {t('pvaTasksChartEmpty', { defaultValue: 'No projects match these filters.' })}
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
      crumbs={[
        {
          label: t('allReports', { defaultValue: 'All reports' }),
          path: ANALYTICS_BASE_PATH,
        },
        { label: title },
      ]}
      lastUpdatedAt={data?.last_updated_at ?? null}
      filters={filterBar}
      onExport={handleExport}
      exportLoading={exporting}
      exportDisabled={!data || data.projects.length === 0}
    >
      {body}
    </ReportPageShell>
  );
};

export default PlannedVsActualTasksPage;
