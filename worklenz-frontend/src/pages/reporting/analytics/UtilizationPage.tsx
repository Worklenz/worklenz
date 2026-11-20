import { useLatestAnalyticsSeriesRequest } from '@/hooks/useLatestAnalyticsSeriesRequest';
import { useScopedAnalyticsSeriesData } from '@/hooks/useScopedAnalyticsSeriesData';
import { areAnalyticsProjectResponsesComplete, useAnalyticsProjectOptionsLoader } from '@/hooks/useAnalyticsProjectOptionsLoader';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flex, Space, Typography, message, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  downloadAnalyticsBrandedPdf,
  resolveAnalyticsPdfLogoUrl,
} from '@/lib/reporting/analytics-branded-pdf';
import { buildAnalyticsPdfFilterDetails } from '@/lib/reporting/analytics-pdf-filter-details';
import { BOUNDED_ANALYTICS_DATE_PRESETS, resolveAnalyticsDateBounds } from '@/utils/date-presets';

import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { analyticsUtilizationApiService } from '@/api/reporting/analytics-utilization.api.service';
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
  UtilizationChart,
  type UtilizationChartHandle,
} from '@/components/reporting/analytics/utilization/UtilizationChart';
import { UtilizationKpiTiles } from '@/components/reporting/analytics/utilization/UtilizationKpiTiles';
import { UtilizationTable } from '@/components/reporting/analytics/utilization/UtilizationTable';
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
import { downloadBlob, downloadText } from '@/lib/reporting/download-file';
import type {
  UtilizationFilters,
  UtilizationSeriesResponse,
} from '@/types/reporting/analytics-utilization.types';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

const { Text } = Typography;

export interface UtilizationPageProps {
  customTemplateId?: string;
  customTemplateName?: string;
}

const UtilizationPage: React.FC<UtilizationPageProps> = ({
  customTemplateId,
  customTemplateName,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const baseTitle = t('utilization', { defaultValue: 'Utilization' });

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
    reportKind: 'utilization',
    customTemplateId,
  });
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<FilterOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chartRef = useRef<UtilizationChartHandle>(null);
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
    reportKind: 'utilization',
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

  const filters: UtilizationFilters = useMemo(
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
        return prev.filter(id => allowed.has(id));
      });
    } catch {
      // Preserve existing selections and options when a team request fails.
    }
  }, []);

  const seriesScope = JSON.stringify([session?.team_id, session?.id, customTemplateId]);
  const seriesRequestKey = JSON.stringify([seriesScope, filters]);
  const { data, setData } = useScopedAnalyticsSeriesData<UtilizationSeriesResponse>(seriesScope, seriesRequestKey);
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
      const res = await analyticsUtilizationApiService.getSeries(filters);
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
    JSON.stringify([session?.team_id, session?.id, customTemplateId]),
    loadProjectsForTeams
  );

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  const handleExport = async (format: AnalyticsExportFormat) => {
    if (!data) return;
    setExporting(true);
    try {
      const stamp = dayjs().format('YYYY-MM-DD');
      if (format === 'csv') {
        const blob = await analyticsUtilizationApiService.exportCsv(filters);
        downloadBlob(blob, `utilization-${stamp}.csv`);
        return;
      }
      if (format === 'png') {
        const png = chartRef.current?.toPngDataUrl();
        if (!png) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        const res = await fetch(png);
        downloadBlob(await res.blob(), `utilization-${stamp}.png`);
        return;
      }
      if (format === 'svg') {
        const svg = chartRef.current?.toSvgMarkup();
        if (!svg) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        downloadText(svg, `utilization-${stamp}.svg`, 'image/svg+xml');
        return;
      }
      if (format === 'pdf') {
        const png = chartRef.current?.toPngDataUrl();
        await downloadAnalyticsBrandedPdf({
          title,
          filename: `utilization-${stamp}.pdf`,
          logoUrl: resolveAnalyticsPdfLogoUrl(teamsList, session?.team_id),
          filterDetails: buildAnalyticsPdfFilterDetails({
            datePreset,
            customRange,
            dateFrom: dateBounds.date_from,
            dateTo: dateBounds.date_to,
            selectedProjectIds,
            projectOptionsCount: projectOptions.length,
            selectedTeamIds,
            selectedMemberIds,
          }),
          chartPngDataUrl: png,
          chartTitle: baseTitle,
          tableRows: [
            ['Member', 'Capacity', 'Logged', 'Utilization %', 'Status'],
            ...data.members.map(row => [
              row.member_name,
              String(row.capacity_hours),
              String(row.logged_hours),
              String(row.utilization_pct),
              row.status,
            ]),
          ],
          kpis: [
            {
              label: t('utilStatAvg', { defaultValue: 'Avg. Utilization' }),
              value: `${data.kpis.avg_utilization_pct}%`,
              tone: '#1890ff',
            },
            {
              label: t('utilStatTeamSize', { defaultValue: 'Team Size' }),
              value: String(data.kpis.team_size),
              tone: '#722ed1',
            },
            {
              label: t('utilStatOverutilized', { defaultValue: 'Overutilized' }),
              value: String(data.kpis.overutilized_count),
              tone: '#ff4d4f',
            },
            {
              label: t('utilStatUnderutilized', { defaultValue: 'Underutilized' }),
              value: String(data.kpis.underutilized_count),
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

  const filterBar = (
    <Flex gap={8} wrap="wrap" align="center" style={{ width: '100%' }}>
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
        title={t('utilNoSelectionTitle', { defaultValue: 'Select projects or teams' })}
        description={t('utilNoSelectionDescription', {
          defaultValue:
            'Choose one or more projects (or a team) to view capacity vs logged time.',
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
        <UtilizationKpiTiles kpis={data.kpis} />
        <ChartTableWrapper
          chartTitle={title}
          chart={<UtilizationChart ref={chartRef} members={data.members} />}
          table={<UtilizationTable members={data.members} loading={loading} />}
        />
        {data.members.length === 0 && (
          <Text type="secondary" style={{ color: token.colorTextSecondary }}>
            {t('utilChartEmpty', { defaultValue: 'No team members match these filters.' })}
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
      exportDisabled={!data || data.members.length === 0}
      schedule={{
        reportKind: 'utilization',
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

export default UtilizationPage;
