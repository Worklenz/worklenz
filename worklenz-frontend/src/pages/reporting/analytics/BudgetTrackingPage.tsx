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
import { analyticsBudgetTrackingApiService } from '@/api/reporting/analytics-budget-tracking.api.service';
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
  BudgetTrackingChart,
  type BudgetTrackingChartHandle,
} from '@/components/reporting/analytics/budget-tracking/BudgetTrackingChart';
import { BudgetTrackingKpiTiles } from '@/components/reporting/analytics/budget-tracking/BudgetTrackingKpiTiles';
import { BudgetTrackingTable } from '@/components/reporting/analytics/budget-tracking/BudgetTrackingTable';
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
  BudgetTrackingFilters,
  BudgetTrackingSeriesResponse,
} from '@/types/reporting/analytics-budget-tracking.types';
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

const fmtMoney = (value: number, currency = 'USD'): string =>
  `${currency.toUpperCase()} ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)}`;

export interface BudgetTrackingPageProps {
  customTemplateId?: string;
  customTemplateName?: string;
}

const BudgetTrackingPage: React.FC<BudgetTrackingPageProps> = ({
  customTemplateId,
  customTemplateName,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const baseTitle = t('budgetTracking', { defaultValue: 'Budget Tracking' });

  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const permissions = getAnalyticsDashboardPermissions({
    role: resolveAnalyticsActorRole(session),
    userId: session?.id,
  });
  const teamMembersState = useAppSelector(state => state.teamMembersReducer.teamMembers);

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<FilterOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BudgetTrackingSeriesResponse | null>(null);

  const chartRef = useRef<BudgetTrackingChartHandle>(null);
  /** Tracks team keys we already seeded with the latest-20 project default. */
  const seededProjectsForTeamsRef = useRef<string>('');
  const hasSelection = selectedProjectIds.length > 0 || selectedTeamIds.length > 0;

  const applyTemplateFilters = useCallback((template: AnalyticsReportTemplate) => {
    applyCommonAnalyticsTemplateFilters(template.filters_json, {
      setSelectedProjectIds,
      setSelectedMemberIds,
      setSelectedTeamIds,
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
    reportKind: 'budget-tracking',
    customTemplateId,
    onApply: applyTemplateFilters,
    getFilters: () => ({
      project_ids: selectedProjectIds,
      member_ids: selectedMemberIds,
      team_ids: selectedTeamIds,
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

  const filters: BudgetTrackingFilters = useMemo(
    () => ({
      project_ids: selectedProjectIds,
      team_ids: selectedTeamIds,
      member_ids: selectedMemberIds,
    }),
    [selectedProjectIds, selectedTeamIds, selectedMemberIds]
  );

  const displayCurrency = useMemo(() => {
    const withBudget = data?.projects.find(p => p.has_budget);
    return withBudget?.currency || data?.projects[0]?.currency || 'USD';
  }, [data]);

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
      const res = await analyticsBudgetTrackingApiService.getSeries(filters);
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
        const blob = await analyticsBudgetTrackingApiService.exportCsv(filters);
        downloadBlob(blob, `budget-tracking-${stamp}.csv`);
        return;
      }
      if (format === 'png') {
        const png = chartRef.current?.toPngDataUrl();
        if (!png) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        const res = await fetch(png);
        downloadBlob(await res.blob(), `budget-tracking-${stamp}.png`);
        return;
      }
      if (format === 'svg') {
        const svg = chartRef.current?.toSvgMarkup();
        if (!svg) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        downloadText(svg, `budget-tracking-${stamp}.svg`, 'image/svg+xml');
        return;
      }
      if (format === 'pdf') {
        const png = chartRef.current?.toPngDataUrl();
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text(title, 40, 40);
        doc.setFontSize(11);
        doc.text(
          `${t('btStatTotalBudget', { defaultValue: 'Total budget' })}: ${fmtMoney(data.kpis.total_budget, displayCurrency)}  |  ` +
            `${t('btStatSpent', { defaultValue: 'Spent' })}: ${fmtMoney(data.kpis.spent, displayCurrency)}  |  ` +
            `${t('btStatRemaining', { defaultValue: 'Remaining' })}: ${fmtMoney(data.kpis.remaining, displayCurrency)}  |  ` +
            `${t('btStatOverBudget', { defaultValue: 'Over budget' })}: ${data.kpis.over_budget_count}`,
          40,
          60
        );
        if (png) {
          doc.addImage(png, 'PNG', 40, 80, 720, 360);
        }
        doc.save(`budget-tracking-${stamp}.pdf`);
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
        loading={filtersLoading}
      />
    </Flex>
  );

  let body: React.ReactNode;
  if (!hasSelection) {
    body = (
      <ReportEmptyState
        title={t('btNoSelectionTitle', { defaultValue: 'Select projects or teams' })}
        description={t('btNoSelectionDescription', {
          defaultValue:
            'Choose one or more projects (or a team) to view budget spent vs remaining.',
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
        <BudgetTrackingKpiTiles kpis={data.kpis} currency={displayCurrency} />
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
              <BudgetTrackingChart ref={chartRef} projects={chartProjects} />
            </>
          }
          table={<BudgetTrackingTable projects={data.projects} loading={loading} />}
        />
        {data.projects.length === 0 && (
          <Text type="secondary" style={{ color: token.colorTextSecondary }}>
            {t('btChartEmpty', { defaultValue: 'No budget data matches these filters.' })}
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
      exportDisabled={!data || data.projects.length === 0}
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

export default BudgetTrackingPage;
