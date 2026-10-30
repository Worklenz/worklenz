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
import { analyticsPlannedVsActualMilestonesApiService } from '@/api/reporting/analytics-planned-vs-actual-milestones.api.service';
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
  PvaMilestonesChart,
  type PvaMilestonesChartHandle,
} from '@/components/reporting/analytics/planned-vs-actual-milestones/PvaMilestonesChart';
import { PvaMilestonesKpiTiles } from '@/components/reporting/analytics/planned-vs-actual-milestones/PvaMilestonesKpiTiles';
import { PvaMilestonesTable } from '@/components/reporting/analytics/planned-vs-actual-milestones/PvaMilestonesTable';
import { useAnalyticsReportTemplates } from '@/hooks/useAnalyticsReportTemplates';
import { applyCommonAnalyticsTemplateFilters } from '@/lib/reporting/analytics-template-filters';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import {
  getAnalyticsDashboardPermissions,
  resolveAnalyticsActorRole,
} from '@/lib/reporting/analytics-permissions';
import type {
  PlannedVsActualMilestonesFilters,
  PlannedVsActualMilestonesSeriesResponse,
} from '@/types/reporting/analytics-planned-vs-actual-milestones.types';
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

export interface PlannedVsActualMilestonesPageProps {
  customTemplateId?: string;
  customTemplateName?: string;
}

const PlannedVsActualMilestonesPage: React.FC<PlannedVsActualMilestonesPageProps> = ({
  customTemplateId,
  customTemplateName,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const baseTitle = t('plannedVsActualMilestones', {
    defaultValue: 'Planned vs Actual: Milestones',
  });

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
  const [data, setData] = useState<PlannedVsActualMilestonesSeriesResponse | null>(null);

  const chartRef = useRef<PvaMilestonesChartHandle>(null);
  /** Milestone chart is project-wise — require an explicit project before loading. */
  const hasProjectSelection = selectedProjectIds.length > 0;

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
    reportKind: 'planned-vs-actual-milestones',
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

  const filters: PlannedVsActualMilestonesFilters = useMemo(
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
    if (!hasProjectSelection) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analyticsPlannedVsActualMilestonesApiService.getSeries(filters);
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
    void loadTeams();
  }, [loadTeams]);

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
      if (format === 'csv') {
        const blob = await analyticsPlannedVsActualMilestonesApiService.exportCsv(filters);
        downloadBlob(blob, `planned-vs-actual-milestones-${stamp}.csv`);
        return;
      }
      if (format === 'png') {
        const png = chartRef.current?.toPngDataUrl();
        if (!png) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        const res = await fetch(png);
        downloadBlob(await res.blob(), `planned-vs-actual-milestones-${stamp}.png`);
        return;
      }
      if (format === 'svg') {
        const svg = chartRef.current?.toSvgMarkup();
        if (!svg) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        downloadText(svg, `planned-vs-actual-milestones-${stamp}.svg`, 'image/svg+xml');
        return;
      }
      if (format === 'pdf') {
        const png = chartRef.current?.toPngDataUrl();
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text(title, 40, 40);
        doc.setFontSize(11);
        doc.text(
          `${t('pvaMsStatMilestones', { defaultValue: 'Milestones' })}: ${data.kpis.milestones}  |  ` +
            `${t('pvaMsStatLate', { defaultValue: 'Late' })}: ${data.kpis.late}  |  ` +
            `${t('pvaMsStatOnTime', { defaultValue: 'On time' })}: ${data.kpis.on_time}  |  ` +
            `${t('pvaMsStatAvgSlip', { defaultValue: 'Avg slip' })}: ${data.kpis.avg_slip_days}d`,
          40,
          60
        );
        if (png) {
          doc.addImage(png, 'PNG', 40, 80, 720, 360);
        }
        doc.save(`planned-vs-actual-milestones-${stamp}.pdf`);
      }
    } catch {
      message.error(t('exportFailed', { defaultValue: 'Export failed' }));
    } finally {
      setExporting(false);
    }
  };

  const milestonesFilters = (
    <AnalyticsFilterBar
      projectOptions={projectOptions}
      selectedProjectIds={selectedProjectIds}
      onProjectsChange={setSelectedProjectIds}
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
  );

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
                label: t('tabCustom', { defaultValue: 'Custom reports' }),
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
      filters={hasProjectSelection ? milestonesFilters : undefined}
      onExport={hasProjectSelection ? handleExport : undefined}
      exportLoading={exporting}
      exportDisabled={!data || !hasProjectSelection || data.milestones.length === 0}
      actions={
        !isCustomTemplateView ? (
          <AnalyticsTemplateActions
            templates={templates}
            canShare={permissions.canShare}
            saveDisabled={!hasProjectSelection}
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
      {!hasProjectSelection ? (
        <Flex vertical gap={16} style={{ width: '100%' }}>
          <Flex
            vertical
            align="center"
            justify="center"
            gap={16}
            style={{ minHeight: 240, width: '100%' }}
          >
            <ReportEmptyState
              title={t('pvaMsNoSelectionTitle', {
                defaultValue: 'Select a project first',
              })}
              description={t('pvaMsNoSelectionDescription', {
                defaultValue:
                  'Choose one or more projects with the Filter button below to compare planned vs actual milestone dates.',
              })}
            />
            {milestonesFilters}
          </Flex>
          <PvaMilestonesTable
            milestones={[]}
            emptyText={t('pvaMsNoSelectionTitle', {
              defaultValue: 'Select a project first',
            })}
          />
        </Flex>
      ) : loading && !data ? (
        <ReportLoadingSkeleton />
      ) : error ? (
        <ReportErrorState message={error} onRetry={() => void loadSeries()} />
      ) : data ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <PvaMilestonesKpiTiles kpis={data.kpis} />
          <ChartTableWrapper
            chartTitle={title}
            chart={<PvaMilestonesChart ref={chartRef} milestones={data.milestones} />}
            table={<PvaMilestonesTable milestones={data.milestones} loading={loading} />}
          />
          {data.milestones.length === 0 && (
            <Text type="secondary" style={{ color: token.colorTextSecondary }}>
              {t('pvaMsChartEmpty', { defaultValue: 'No milestones match these filters.' })}
            </Text>
          )}
        </Space>
      ) : (
        <ReportLoadingSkeleton />
      )}
    </ReportPageShell>
  );
};

export default PlannedVsActualMilestonesPage;
