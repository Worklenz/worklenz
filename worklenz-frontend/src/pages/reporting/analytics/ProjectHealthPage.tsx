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
import { analyticsProjectHealthApiService } from '@/api/reporting/analytics-project-health.api.service';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
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
  ProjectHealthChart,
  type ProjectHealthChartHandle,
} from '@/components/reporting/analytics/project-health/ProjectHealthChart';
import { ProjectHealthDonutChart } from '@/components/reporting/analytics/project-health/ProjectHealthDonutChart';
import { ProjectHealthKpiTiles } from '@/components/reporting/analytics/project-health/ProjectHealthKpiTiles';
import { ProjectHealthTable } from '@/components/reporting/analytics/project-health/ProjectHealthTable';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import {
  DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT,
  latestUpdatedOptionIds,
  latestUpdatedProjectIds,
  resolveAnalyticsDisplayProjects,
} from '@/lib/reporting/analytics-chart-projects';
import type {
  ProjectHealthFilters,
  ProjectHealthSeriesResponse,
} from '@/types/reporting/analytics-project-health.types';
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

const ProjectHealthPage: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const title = t('projectHealth', { defaultValue: 'Project Health' });
  useDocumentTitle(title);

  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const teamMembersState = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const { projectHealths } = useAppSelector(state => state.projectHealthReducer);

  const [datePreset, setDatePreset] = useState<AnalyticsDatePreset>('last_30_days');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedHealthIds, setSelectedHealthIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<FilterOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectHealthSeriesResponse | null>(null);

  const chartRef = useRef<ProjectHealthChartHandle>(null);
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

  const healthOptions: FilterOption[] = useMemo(
    () =>
      projectHealths.map(h => ({
        value: h.id,
        label: h.name,
      })),
    [projectHealths]
  );

  // Load the full team set for KPIs / health donut / table.
  // Projects selection only scopes the Progress & budget bar chart (latest 20 by default).
  const filters: ProjectHealthFilters = useMemo(
    () => ({
      project_ids: [],
      team_ids: selectedTeamIds,
      health_ids: selectedHealthIds,
      member_ids: selectedMemberIds,
    }),
    [selectedTeamIds, selectedHealthIds, selectedMemberIds]
  );

  const loadTeams = useCallback(async () => {
    setFiltersLoading(true);
    try {
      if (!projectHealths.length) {
        void dispatch(fetchProjectHealth());
      }

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
  }, [dispatch, projectHealths.length, session?.team_id, t]);

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
      const res = await analyticsProjectHealthApiService.getSeries(filters);
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
        const blob = await analyticsProjectHealthApiService.exportCsv(filters);
        downloadBlob(blob, `project-health-${stamp}.csv`);
        return;
      }
      if (format === 'png') {
        const png = chartRef.current?.toPngDataUrl();
        if (!png) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        const res = await fetch(png);
        downloadBlob(await res.blob(), `project-health-${stamp}.png`);
        return;
      }
      if (format === 'svg') {
        const svg = chartRef.current?.toSvgMarkup();
        if (!svg) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        downloadText(svg, `project-health-${stamp}.svg`, 'image/svg+xml');
        return;
      }
      if (format === 'pdf') {
        const png = chartRef.current?.toPngDataUrl();
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text(title, 40, 40);
        doc.setFontSize(11);
        doc.text(
          `${t('statOnTrack', { defaultValue: 'On track' })}: ${data.kpis.on_track}  |  ` +
            `${t('statAtRisk', { defaultValue: 'At risk' })}: ${data.kpis.at_risk}  |  ` +
            `${t('statOffTrack', { defaultValue: 'Off track' })}: ${data.kpis.off_track}  |  ` +
            `${t('statOverdueTasks', { defaultValue: 'Overdue tasks' })}: ${data.kpis.overdue_tasks}`,
          40,
          60
        );
        if (png) {
          doc.addImage(png, 'PNG', 40, 80, 720, 360);
        }
        doc.save(`project-health-${stamp}.pdf`);
      }
    } catch {
      message.error(t('exportFailed', { defaultValue: 'Export failed' }));
    } finally {
      setExporting(false);
    }
  };

  // Progress & budget bar only: latest 20 by default; all after Select all / custom picks.
  const isSelectAllProjects =
    projectOptions.length > 0 && selectedProjectIds.length >= projectOptions.length;

  const barChartProjects = useMemo(() => {
    if (!data?.projects?.length) return [];
    return resolveAnalyticsDisplayProjects(data.projects, {
      selectedProjectIds,
      projectOptionsCount: projectOptions.length,
      limit: DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT,
    });
  }, [data?.projects, selectedProjectIds, projectOptions.length]);

  const chartProjectIds = useMemo(
    () => barChartProjects.map(p => p.project_id),
    [barChartProjects]
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
        statusOptions={healthOptions}
        selectedStatusIds={selectedHealthIds}
        onStatusesChange={setSelectedHealthIds}
        statusFilterLabel={t('filterHealth', { defaultValue: 'Health' })}
        loading={filtersLoading}
      />
    </Flex>
  );

  let body: React.ReactNode;
  if (!hasSelection) {
    body = (
      <ReportEmptyState
        title={t('phNoSelectionTitle', { defaultValue: 'Select projects or teams' })}
        description={t('phNoSelectionDescription', {
          defaultValue: 'Choose one or more projects (or a team) to view project health.',
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
        <ProjectHealthKpiTiles kpis={data.kpis} />
        <ChartTableWrapper
          chartTitle={title}
          rowCount={data.projects.length}
          chart={
            <Flex gap={16} wrap="wrap" align="stretch" style={{ width: '100%' }}>
              <div style={{ flex: '2 1 420px', minWidth: 280 }}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
                  {t('phProgressBudgetTitle', { defaultValue: 'Progress & budget' })}
                </Text>
                {!isSelectAllProjects &&
                  data.projects.length > DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT && (
                    <Text
                      type="secondary"
                      style={{ display: 'block', marginBottom: 8, fontSize: 12 }}
                    >
                      {t('phBarChartLatestNote', {
                        defaultValue:
                          'Showing the latest updated {{count}} projects in this graph. Select all projects to show every project.',
                        count: Math.min(
                          DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT,
                          barChartProjects.length
                        ),
                      })}
                    </Text>
                  )}
                <ProjectHealthChart ref={chartRef} projects={barChartProjects} />
              </div>
              <div style={{ flex: '1 1 280px', minWidth: 260, maxWidth: 420 }}>
                <ProjectHealthDonutChart projects={data.projects} kpis={data.kpis} />
              </div>
            </Flex>
          }
          table={<ProjectHealthTable projects={data.projects} loading={loading} />}
        />
        {data.projects.length === 0 && (
          <Text type="secondary" style={{ color: token.colorTextSecondary }}>
            {t('phChartEmpty', { defaultValue: 'No projects match these filters.' })}
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

export default ProjectHealthPage;
