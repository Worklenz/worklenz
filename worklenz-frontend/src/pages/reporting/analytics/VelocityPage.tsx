import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  DatePicker,
  Flex,
  Segmented,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from '@/shared/antd-imports';
import { SaveOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { jsPDF } from 'jspdf';

dayjs.extend(quarterOfYear);
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { analyticsVelocityApiService } from '@/api/reporting/analytics-velocity.api.service';
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
import { VelocityChart, type VelocityChartHandle } from '@/components/reporting/analytics/velocity/VelocityChart';
import { VelocityKpiTiles } from '@/components/reporting/analytics/velocity/VelocityKpiTiles';
import { VelocityTable } from '@/components/reporting/analytics/velocity/VelocityTable';
import { SaveVelocityTemplateModal } from '@/components/reporting/analytics/velocity/SaveVelocityTemplateModal';
import { VelocityTemplatesMenu } from '@/components/reporting/analytics/velocity/VelocityTemplatesMenu';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import {
  getAnalyticsDashboardPermissions,
  resolveAnalyticsActorRole,
} from '@/lib/reporting/analytics-permissions';
import type {
  AnalyticsReportTemplate,
  VelocityMetric,
  VelocitySeriesFilters,
  VelocitySeriesResponse,
  VelocityViewBy,
} from '@/types/reporting/analytics-velocity.types';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

const { Text } = Typography;
const { RangePicker } = DatePicker;

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

const VelocityPage: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const dispatch = useAppDispatch();
  const title = t('velocity', { defaultValue: 'Velocity' });
  useDocumentTitle(title);

  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const permissions = getAnalyticsDashboardPermissions({
    role: resolveAnalyticsActorRole(session),
    userId: session?.id,
  });
  const teamMembersState = useAppSelector(state => state.teamMembersReducer.teamMembers);

  const [viewBy, setViewBy] = useState<VelocityViewBy>('project');
  const [metric, setMetric] = useState<VelocityMetric>('story_points');
  const [sprintCount, setSprintCount] = useState(6);
  const [avgWindow, setAvgWindow] = useState(3);
  const [showTrend, setShowTrend] = useState(false);
  const [datePreset, setDatePreset] = useState<AnalyticsDatePreset>('last_90_days');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<FilterOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VelocitySeriesResponse | null>(null);
  const [templates, setTemplates] = useState<AnalyticsReportTemplate[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const chartRef = useRef<VelocityChartHandle>(null);
  const appliedDefaultTemplate = useRef(false);
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

  const dateBounds = useMemo(() => {
    if (datePreset === 'custom' && customRange) {
      return {
        date_from: customRange[0].startOf('day').toISOString(),
        date_to: customRange[1].endOf('day').toISOString(),
      };
    }
    const end = dayjs();
    let start = end.subtract(90, 'day');
    if (datePreset === 'last_7_days') start = end.subtract(7, 'day');
    if (datePreset === 'last_30_days') start = end.subtract(30, 'day');
    if (datePreset === 'this_quarter') start = end.startOf('quarter');
    if (datePreset === 'custom') return { date_from: null, date_to: null };
    return {
      date_from: start.startOf('day').toISOString(),
      date_to: end.endOf('day').toISOString(),
    };
  }, [datePreset, customRange]);

  const filters: VelocitySeriesFilters = useMemo(
    () => ({
      view_by: viewBy,
      project_ids: selectedProjectIds,
      member_ids: selectedMemberIds,
      team_ids: selectedTeamIds,
      sprint_count: sprintCount,
      date_from: dateBounds.date_from,
      date_to: dateBounds.date_to,
      metric,
      avg_window: avgWindow,
      trend: showTrend,
    }),
    [
      viewBy,
      selectedProjectIds,
      selectedMemberIds,
      selectedTeamIds,
      sprintCount,
      dateBounds,
      metric,
      avgWindow,
      showTrend,
    ]
  );

  const metricLabel =
    metric === 'issue_count'
      ? t('metricIssueCount', { defaultValue: 'issues' })
      : t('metricStoryPoints', { defaultValue: 'story points' });

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

  const loadProjectsForTeams = useCallback(
    async (teamIds: string[]) => {
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
          if (prev.length === 0) return projects.map(p => p.value);
          const allowed = new Set(projects.map(p => p.value));
          const next = prev.filter(id => allowed.has(id));
          return next.length > 0 ? next : projects.map(p => p.value);
        });
      } catch {
        setProjectOptions([]);
      }
    },
    []
  );

  const applyTemplateFilters = useCallback((template: AnalyticsReportTemplate) => {
    const f = template.filters_json ?? {};
    if (typeof f.view_by === 'string') setViewBy(f.view_by as VelocityViewBy);
    if (typeof f.metric === 'string') setMetric(f.metric as VelocityMetric);
    if (typeof f.sprint_count === 'number') setSprintCount(f.sprint_count);
    if (typeof f.avg_window === 'number') setAvgWindow(f.avg_window);
    if (typeof f.trend === 'boolean') setShowTrend(f.trend);
    if (Array.isArray(f.project_ids)) setSelectedProjectIds(f.project_ids.map(String));
    if (Array.isArray(f.member_ids)) setSelectedMemberIds(f.member_ids.map(String));
    if (Array.isArray(f.team_ids)) setSelectedTeamIds(f.team_ids.map(String));
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await analyticsVelocityApiService.listTemplates('velocity');
      if (res.done && Array.isArray(res.body)) {
        setTemplates(res.body);
        if (!appliedDefaultTemplate.current) {
          const defaultTpl = res.body.find(tpl => tpl.is_default);
          if (defaultTpl?.filters_json) {
            applyTemplateFilters(defaultTpl);
          }
          appliedDefaultTemplate.current = true;
        }
      }
    } catch {
      // templates are optional on first load
    }
  }, [applyTemplateFilters]);

  const loadSeries = useCallback(async () => {
    if (!hasSelection) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analyticsVelocityApiService.getSeries(filters);
      if (res.done && res.body) {
        setData(res.body);
      } else {
        setError(res.message || t('errorDescription', { defaultValue: 'We could not load this report. Please try again.' }));
        setData(null);
      }
    } catch {
      setError(t('errorDescription', { defaultValue: 'We could not load this report. Please try again.' }));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, hasSelection, t]);

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
            `: ${data.kpis.commitment_accuracy_pct ?? '—'}%`,
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
        message.success(t('templateSaved', { defaultValue: 'Template saved' }));
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
    <Flex gap={8} wrap="nowrap" align="center" style={{ overflowX: 'auto', width: '100%' }}>
      <Segmented
        value={viewBy}
        onChange={val => setViewBy(val as VelocityViewBy)}
        options={[
          { value: 'project', label: t('viewByProject', { defaultValue: 'Project' }) },
          { value: 'member', label: t('viewByMember', { defaultValue: 'Member' }) },
          { value: 'team', label: t('viewByTeam', { defaultValue: 'Team' }) },
        ]}
        aria-label={t('viewBy', { defaultValue: 'View by' })}
      />

      <AnalyticsFilterBar
        projectOptions={projectOptions}
        selectedProjectIds={selectedProjectIds}
        onProjectsChange={setSelectedProjectIds}
        memberOptions={memberOptions}
        selectedMemberIds={selectedMemberIds}
        onMembersChange={viewBy === 'member' ? setSelectedMemberIds : undefined}
        teamOptions={teamOptions}
        selectedTeamIds={selectedTeamIds}
        onTeamsChange={setSelectedTeamIds}
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        loading={filtersLoading}
        inline
      />

      {datePreset === 'custom' && (
        <RangePicker
          value={customRange}
          onChange={vals => {
            if (vals?.[0] && vals?.[1]) setCustomRange([vals[0], vals[1]]);
            else setCustomRange(null);
          }}
        />
      )}
      <Select
        value={metric}
        onChange={setMetric}
        style={{ minWidth: 140 }}
        options={[
          {
            value: 'story_points',
            label: t('metricStoryPointsLabel', { defaultValue: 'Story points' }),
          },
          {
            value: 'issue_count',
            label: t('metricIssueCountLabel', { defaultValue: 'Issue count' }),
          },
        ]}
        aria-label={t('metric', { defaultValue: 'Metric' })}
      />
      <Select
        value={sprintCount}
        onChange={setSprintCount}
        style={{ minWidth: 140 }}
        options={[3, 6, 10, 12, 20, 30].map(n => ({
          value: n,
          label: t('lastNSprints', { defaultValue: 'Last {{count}} sprints', count: n }),
        }))}
        aria-label={t('sprintRange', { defaultValue: 'Sprint range' })}
      />
      <Select
        value={avgWindow}
        onChange={setAvgWindow}
        style={{ minWidth: 150 }}
        options={[2, 3, 4, 5, 6].map(n => ({
          value: n,
          label: t('avgWindow', { defaultValue: '{{count}}-sprint average', count: n }),
        }))}
        aria-label={t('avgWindowLabel', { defaultValue: 'Average window' })}
      />
      <Space size={6} style={{ flexShrink: 0 }}>
        <Switch checked={showTrend} onChange={setShowTrend} />
        <Text style={{ whiteSpace: 'nowrap' }}>
          {t('showTrend', { defaultValue: 'Trend line' })}
        </Text>
      </Space>
    </Flex>
  );

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
      filters={velocityFilters}
      onExport={handleExport}
      exportDisabled={!data || !hasSelection}
      exportFormats={['excel', 'pdf', 'png', 'svg', 'csv']}
      exportLoading={exporting}
      actions={
        <Space wrap>
          <VelocityTemplatesMenu
            templates={templates}
            canShare={permissions.canShare}
            onRefresh={() => void loadTemplates()}
            onApply={applyTemplateFilters}
          />
          <Button icon={<SaveOutlined />} onClick={() => setSaveOpen(true)} disabled={!hasSelection}>
            {t('saveAsTemplate', { defaultValue: 'Save as Template' })}
          </Button>
        </Space>
      }
    >
      {!hasSelection ? (
        <Flex align="center" justify="center" style={{ minHeight: 320 }}>
          <ReportEmptyState
            title={t('velocityNoSelectionTitle', {
              defaultValue: 'Select projects or teams',
            })}
            description={t('velocityNoSelectionDescription', {
              defaultValue: 'Choose at least one project or team to view velocity.',
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
              message={t('velocityMinSprintsTitle', {
                defaultValue: 'Need more completed sprints',
              })}
              description={t('velocityMinSprintsDescription', {
                defaultValue:
                  'Velocity trends are most useful with at least 2 completed sprints. Complete more sprints or widen filters.',
              })}
            />
          )}

          {data && (
            <VelocityKpiTiles kpis={data.kpis} metricLabel={metricLabel} />
          )}

          <ChartTableWrapper
            chartTitle={title}
            rowCount={data?.series.length}
            chart={
              <VelocityChart
                ref={chartRef}
                series={data?.series ?? []}
                averageLine={data?.average_line ?? []}
                trendLine={data?.trend_line ?? null}
                viewBy={viewBy}
              />
            }
            table={<VelocityTable series={data?.series ?? []} />}
          />
        </Flex>
      )}

      <SaveVelocityTemplateModal
        open={saveOpen}
        canShare={permissions.canShare}
        confirmLoading={savingTemplate}
        onCancel={() => setSaveOpen(false)}
        onSave={values => void handleSaveTemplate(values)}
      />
    </ReportPageShell>
  );
};

export default VelocityPage;
