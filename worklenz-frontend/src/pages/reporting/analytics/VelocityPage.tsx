import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Flex,
  message,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { jsPDF } from 'jspdf';

dayjs.extend(quarterOfYear);
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { analyticsVelocityApiService } from '@/api/reporting/analytics-velocity.api.service';
import { analyticsTemplatesApiService } from '@/api/reporting/analytics-templates.api.service';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { syncVelocityTemplatesToCustomReports } from '@/features/reporting/analytics-custom-reports';
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
import { VelocityChart, type VelocityChartHandle } from '@/components/reporting/analytics/velocity/VelocityChart';
import { VelocityKpiTiles } from '@/components/reporting/analytics/velocity/VelocityKpiTiles';
import { VelocityTable } from '@/components/reporting/analytics/velocity/VelocityTable';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import {
  getAnalyticsDashboardPermissions,
  resolveAnalyticsActorRole,
} from '@/lib/reporting/analytics-permissions';
import type {
  AnalyticsReportTemplate,
  VelocitySeriesFilters,
  VelocitySeriesResponse,
} from '@/types/reporting/analytics-velocity.types';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

const DEFAULT_VIEW_BY = 'project' as const;
const DEFAULT_METRIC = 'story_points' as const;
const DEFAULT_SPRINT_COUNT = 6;
const DEFAULT_AVG_WINDOW = 3;

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

export interface VelocityPageProps {
  /** Open as a Custom template under /custom/:id (do not redirect to /velocity). */
  customTemplateId?: string;
  customTemplateName?: string;
}

const VelocityPage: React.FC<VelocityPageProps> = ({
  customTemplateId,
  customTemplateName,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const isCustomTemplateView = Boolean(customTemplateId);
  const title =
    (isCustomTemplateView && customTemplateName?.trim()) ||
    t('velocity', { defaultValue: 'Velocity' });
  useDocumentTitle(title);

  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const permissions = getAnalyticsDashboardPermissions({
    role: resolveAnalyticsActorRole(session),
    userId: session?.id,
  });
  const teamMembersState = useAppSelector(state => state.teamMembersReducer.teamMembers);

  const [datePreset, setDatePreset] = useState<AnalyticsDatePreset>('last_30_days');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VelocitySeriesResponse | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const chartRef = useRef<VelocityChartHandle>(null);
  const appliedDefaultTemplate = useRef(false);
  const appliedQueryTemplate = useRef<string | null>(null);
  const pendingQueryTemplateId = useRef<string | null>(
    customTemplateId ?? searchParams.get('template')
  );
  /** Velocity chart is project-wise — require an explicit project before loading. */
  const hasProjectSelection = selectedProjectIds.length > 0;

  // Switching between Custom reports remounts filters for the new template id.
  useEffect(() => {
    if (!customTemplateId) return;
    if (appliedQueryTemplate.current === customTemplateId) return;
    pendingQueryTemplateId.current = customTemplateId;
    appliedDefaultTemplate.current = false;
    void loadTemplates();
    // loadTemplates is stable enough via deps below; intentional on id change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customTemplateId]);

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
    if (datePreset === 'last_90_days') start = end.subtract(90, 'day');
    if (datePreset === 'this_quarter') start = end.startOf('quarter');
    return {
      date_from: start.startOf('day').toISOString(),
      date_to: end.endOf('day').toISOString(),
    };
  }, [datePreset]);

  const filters: VelocitySeriesFilters = useMemo(
    () => ({
      view_by: DEFAULT_VIEW_BY,
      project_ids: selectedProjectIds,
      member_ids: selectedMemberIds,
      team_ids: selectedTeamIds,
      sprint_count: DEFAULT_SPRINT_COUNT,
      date_from: dateBounds.date_from,
      date_to: dateBounds.date_to,
      metric: DEFAULT_METRIC,
      avg_window: DEFAULT_AVG_WINDOW,
      trend: false,
    }),
    [selectedProjectIds, selectedMemberIds, selectedTeamIds, dateBounds]
  );

  const metricLabel = t('metricStoryPoints', { defaultValue: 'story points' });

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
      // Keep prior picks that are still valid; never auto-select projects.
      setSelectedProjectIds(prev => {
        const allowed = new Set(projects.map(p => p.value));
        return prev.filter(id => allowed.has(id));
      });
    } catch {
      setProjectOptions([]);
    }
  }, []);

  const applyTemplateFilters = useCallback((template: AnalyticsReportTemplate) => {
    const f = template.filters_json ?? {};
    if (Array.isArray(f.project_ids)) setSelectedProjectIds(f.project_ids.map(String));
    if (Array.isArray(f.member_ids)) setSelectedMemberIds(f.member_ids.map(String));
    if (Array.isArray(f.team_ids)) setSelectedTeamIds(f.team_ids.map(String));
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await analyticsVelocityApiService.listTemplates('velocity');
      if (res.done && Array.isArray(res.body)) {
        // Keep All reports ? Custom reports + sidebar in sync with every
        // report kind's templates (not just velocity), so saves made on
        // other report pages aren't wiped out when this page syncs.
        try {
          const all = await analyticsTemplatesApiService.listTemplates('all');
          if (all.done && Array.isArray(all.body)) {
            syncVelocityTemplatesToCustomReports(all.body);
          } else {
            syncVelocityTemplatesToCustomReports(res.body);
          }
        } catch {
          syncVelocityTemplatesToCustomReports(res.body);
        }

        const queryTemplateId = pendingQueryTemplateId.current;
        if (queryTemplateId && appliedQueryTemplate.current !== queryTemplateId) {
          const fromQuery = res.body.find(tpl => tpl.id === queryTemplateId);
          if (fromQuery) {
            applyTemplateFilters(fromQuery);
            appliedQueryTemplate.current = queryTemplateId;
            pendingQueryTemplateId.current = null;
            appliedDefaultTemplate.current = true;
            // Drop ?template= only on the builtin Velocity route.
            if (!isCustomTemplateView && searchParams.get('template')) {
              setSearchParams(
                prev => {
                  const next = new URLSearchParams(prev);
                  next.delete('template');
                  return next;
                },
                { replace: true }
              );
            }
            return;
          }
        }

        // Builtin Velocity always starts with no project selected so the
        // "Select a project first" empty state is shown. Do not hydrate
        // project_ids (or other filters) from a saved default template.
        // Custom / ?template= routes still apply full filters above.
        if (!isCustomTemplateView && !appliedDefaultTemplate.current) {
          appliedDefaultTemplate.current = true;
        }
      }
    } catch {
      // templates are optional on first load
    }
  }, [applyTemplateFilters, isCustomTemplateView, searchParams, setSearchParams]);

  const loadSeries = useCallback(async () => {
    if (!hasProjectSelection) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analyticsVelocityApiService.getSeries(filters);
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
  }, [filters, hasProjectSelection, t]);

  useEffect(() => {
    void loadTeamsAndMembers();
    void loadTemplates();
  }, [loadTeamsAndMembers, loadTemplates]);

  useEffect(() => {
    void loadProjectsForTeams(selectedTeamIds);
  }, [selectedTeamIds, loadProjectsForTeams]);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  const handleExport = async (format: AnalyticsExportFormat) => {
    if (!data) return;
    setExporting(true);
    try {
      const stamp = dayjs().format('YYYY-MM-DD');
      if (format === 'excel') {
        const png = chartRef.current?.toPngDataUrl() ?? null;
        const blob = await analyticsVelocityApiService.exportExcel(filters, png);
        downloadBlob(blob, `velocity-${stamp}.xlsx`);
        return;
      }
      if (format === 'png') {
        const png = chartRef.current?.toPngDataUrl();
        if (!png) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        const res = await fetch(png);
        downloadBlob(await res.blob(), `velocity-${stamp}.png`);
        return;
      }
      if (format === 'svg') {
        const svg = chartRef.current?.toSvgMarkup();
        if (!svg) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        downloadText(svg, `velocity-${stamp}.svg`, 'image/svg+xml');
        return;
      }
      if (format === 'pdf') {
        const png = chartRef.current?.toPngDataUrl();
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text(title, 40, 40);
        doc.setFontSize(11);
        doc.text(
          t('kpiAvgVelocity', { defaultValue: 'Avg velocity' }) +
            `: ${data.kpis.avg_velocity}  |  ` +
            t('kpiCommitment', { defaultValue: 'Commitment accuracy' }) +
            `: ${data.kpis.commitment_accuracy_pct ?? '\u2014'}%`,
          40,
          60
        );
        if (png) {
          doc.addImage(png, 'PNG', 40, 80, 720, 360);
        }
        doc.save(`velocity-${stamp}.pdf`);
        return;
      }
      if (format === 'csv') {
        const header = 'Sprint,Committed,Completed,Commitment %\n';
        const rows = data.series
          .map(
            p =>
              `"${p.sprint_name.replace(/"/g, '""')}",${p.committed},${p.completed},${
                p.commitment_accuracy ?? ''
              }`
          )
          .join('\n');
        downloadText(header + rows, `velocity-${stamp}.csv`, 'text/csv');
      }
    } catch {
      message.error(t('exportFailed', { defaultValue: 'Export failed' }));
    } finally {
      setExporting(false);
    }
  };

  const handleSaveTemplate = async (values: {
    name: string;
    is_workspace_shared: boolean;
    is_default: boolean;
  }) => {
    setSavingTemplate(true);
    try {
      const res = await analyticsVelocityApiService.createTemplate({
        name: values.name,
        is_workspace_shared: values.is_workspace_shared,
        is_default: values.is_default,
        filters: { ...filters },
      });
      if (res.done) {
        message.success(
          t('templateSavedToCustom', {
            defaultValue: 'Template saved. Find it under Custom reports.',
          })
        );
        setSaveOpen(false);
        void loadTemplates();
      } else {
        message.error(res.message || t('templateActionFailed', { defaultValue: 'Action failed' }));
      }
    } catch {
      message.error(t('templateActionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setSavingTemplate(false);
    }
  };

  const velocityFilters = (
    <AnalyticsFilterBar
      projectOptions={projectOptions}
      selectedProjectIds={selectedProjectIds}
      onProjectsChange={setSelectedProjectIds}
      memberOptions={memberOptions}
      selectedMemberIds={selectedMemberIds}
      onMembersChange={setSelectedMemberIds}
      datePreset={datePreset}
      onDatePresetChange={setDatePreset}
      availableDatePresets={['last_7_days', 'last_30_days', 'last_90_days', 'this_quarter']}
      loading={filtersLoading}
    />
  );

  return (
    <ReportPageShell
      title={title}
      filters={velocityFilters}
      onExport={hasProjectSelection ? handleExport : undefined}
      exportDisabled={!data || !hasProjectSelection}
      exportFormats={['excel', 'pdf', 'png', 'svg', 'csv']}
      exportLoading={exporting}
      actions={
        isCustomTemplateView ? undefined : (
          <AnalyticsTemplateActions
            canShare={permissions.canShare}
            saveDisabled={!hasProjectSelection}
            saveOpen={saveOpen}
            savingTemplate={savingTemplate}
            onSaveOpenChange={setSaveOpen}
            onSave={values => void handleSaveTemplate(values)}
          />
        )
      }
    >
      {!hasProjectSelection ? (
        <Flex vertical gap={16} style={{ width: '100%' }}>
          <ReportEmptyState
            title={t('velocityNoSelectionTitle', {
              defaultValue: 'Select a project first',
            })}
            description={t('velocityNoSelectionDescription', {
              defaultValue:
                'Choose one or more projects with the Filter button above to view the velocity diagram.',
            })}
          />
          <VelocityTable
            series={[]}
            emptyText={t('velocityNoSelectionTitle', {
              defaultValue: 'Select a project first',
            })}
          />
        </Flex>
      ) : loading && !data ? (
        <ReportLoadingSkeleton />
      ) : error ? (
        <ReportErrorState message={error} onRetry={() => void loadSeries()} />
      ) : (
        <Flex vertical gap={16}>
          {data && !data.meta.min_sprints_met && (
            <Alert
              type="info"
              showIcon
              message={
                data.meta.bucket === 'phase'
                  ? t('velocityMinPhasesTitle', {
                      defaultValue: 'Need more phases',
                    })
                  : t('velocityMinSprintsTitle', {
                      defaultValue: 'Need more completed sprints',
                    })
              }
              description={
                data.meta.bucket === 'phase'
                  ? t('velocityMinPhasesDescription', {
                      defaultValue:
                        'Velocity trends are most useful with at least 2 phases that have tasks. Add phases or widen filters.',
                    })
                  : t('velocityMinSprintsDescription', {
                      defaultValue:
                        'Velocity trends are most useful with at least 2 completed sprints. Complete more sprints or widen filters.',
                    })
              }
            />
          )}

          {data && (
            <VelocityKpiTiles
              kpis={data.kpis}
              metricLabel={metricLabel}
              bucket={data.meta.bucket}
            />
          )}

          <ChartTableWrapper
            chartTitle={title}
            rowCount={data?.series.length}
            chart={
              <VelocityChart
                ref={chartRef}
                series={data?.series ?? []}
                averageLine={data?.average_line ?? []}
                trendLine={null}
                viewBy={DEFAULT_VIEW_BY}
                bucket={data?.meta.bucket}
              />
            }
            table={
              <VelocityTable series={data?.series ?? []} bucket={data?.meta.bucket} />
            }
          />
        </Flex>
      )}

    </ReportPageShell>
  );
};

export default VelocityPage;
