import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Flex, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { jsPDF } from 'jspdf';

dayjs.extend(quarterOfYear);

import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { analyticsCfdApiService } from '@/api/reporting/analytics-cfd.api.service';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { useAuthService } from '@/hooks/useAuth';
import {
  AnalyticsFilterBar,
  AnalyticsTemplateActions,
  ChartTableWrapper,
  ReportErrorState,
  ReportLoadingSkeleton,
  ReportPageShell,
  type AnalyticsDatePreset,
  type AnalyticsExportFormat,
} from '@/components/reporting/analytics';
import type { FilterOption } from '@/components/common/filters/MultiSelectFilterPill';
import { CfdChart, type CfdChartHandle } from '@/components/reporting/analytics/cfd/CfdChart';
import { CfdKpiTiles } from '@/components/reporting/analytics/cfd/CfdKpiTiles';
import { CfdStatusLegend } from '@/components/reporting/analytics/cfd/CfdStatusLegend';
import { CfdTable } from '@/components/reporting/analytics/cfd/CfdTable';
import { useAnalyticsReportTemplates } from '@/hooks/useAnalyticsReportTemplates';
import { applyCommonAnalyticsTemplateFilters } from '@/lib/reporting/analytics-template-filters';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import {
  getAnalyticsDashboardPermissions,
  resolveAnalyticsActorRole,
} from '@/lib/reporting/analytics-permissions';
import type {
  CfdSeriesFilters,
  CfdSeriesResponse,
  CfdStatusMeta,
} from '@/types/reporting/analytics-cfd.types';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

const DEFAULT_GROUP_BY = 'all' as const;
const DEFAULT_SMOOTHING = 'raw' as const;

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

export interface CumulativeFlowPageProps {
  customTemplateId?: string;
  customTemplateName?: string;
}

const CumulativeFlowPage: React.FC<CumulativeFlowPageProps> = ({
  customTemplateId,
  customTemplateName,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const dispatch = useAppDispatch();
  const baseTitle = t('cumulativeFlow', { defaultValue: 'Cumulative Flow' });

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

  const [wipThresholds, setWipThresholds] = useState<Record<string, number>>({});
  const [statusOrder, setStatusOrder] = useState<string[]>([]);
  const [visibleStatusIds, setVisibleStatusIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CfdSeriesResponse | null>(null);

  const chartRef = useRef<CfdChartHandle>(null);
  /** Tracks last rollup mode so switching category ? detail resets visible bands. */
  const lastRollupMode = useRef<boolean | null>(null);

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
    reportKind: 'cumulative-flow',
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
    if (datePreset === 'last_90_days') start = end.subtract(90, 'day');
    if (datePreset === 'this_quarter') start = end.startOf('quarter');
    return {
      date_from: start.startOf('day').toISOString(),
      date_to: end.endOf('day').toISOString(),
    };
  }, [datePreset]);

  const filters: CfdSeriesFilters = useMemo(
    () => ({
      project_ids: selectedProjectIds,
      team_ids: selectedTeamIds,
      status_ids: [],
      date_from: dateBounds.date_from,
      date_to: dateBounds.date_to,
      group_by: DEFAULT_GROUP_BY,
      smoothing: DEFAULT_SMOOTHING,
      wip_thresholds: wipThresholds,
      sprint_overlay: false,
    }),
    [selectedProjectIds, selectedTeamIds, dateBounds, wipThresholds]
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
        // Keep prior picks that are still valid; never auto-select every project.
        return prev.filter(id => allowed.has(id));
      });
    } catch {
      setProjectOptions([]);
    }
  }, []);

  const loadSeries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await analyticsCfdApiService.getSeries(filters);
      if (res.done && res.body) {
        const localizedStatuses = res.body.statuses.map(status => {
          if (status.id === '__cfd_todo__') {
            return {
              ...status,
              name: t('cfdCategoryTodo', { defaultValue: 'To do' }),
            };
          }
          if (status.id === '__cfd_doing__') {
            return {
              ...status,
              name: t('cfdCategoryDoing', { defaultValue: 'In progress' }),
            };
          }
          if (status.id === '__cfd_done__') {
            return {
              ...status,
              name: t('cfdCategoryDone', { defaultValue: 'Done' }),
            };
          }
          return status;
        });
        const body = { ...res.body, statuses: localizedStatuses };
        setData(body);
        const statuses = body.statuses;
        const ids = statuses.map(s => s.id);
        const isRollup = !!res.body.meta.rollup_by_category;
        const modeChanged =
          lastRollupMode.current !== null && lastRollupMode.current !== isRollup;
        lastRollupMode.current = isRollup;

        setStatusOrder(prev => {
          if (modeChanged || isRollup) return ids;
          const retained = prev.filter(id => ids.includes(id));
          const missing = ids.filter(id => !retained.includes(id));
          return [...retained, ...missing];
        });

        // Category mode: always show To do / In progress / Done.
        // Project mode: cap bands so Chart.js stays responsive.
        const DEFAULT_VISIBLE = 12;
        setVisibleStatusIds(prev => {
          if (isRollup) return ids;
          if (!modeChanged) {
            const stillValid = prev.filter(id => ids.includes(id));
            if (stillValid.length > 0) return stillValid;
          }
          const preferred = [
            ...statuses.filter(s => s.is_doing),
            ...statuses.filter(s => s.is_todo),
            ...statuses.filter(s => !s.is_doing && !s.is_todo && !s.is_done),
            ...statuses.filter(s => s.is_done),
          ];
          const unique: string[] = [];
          for (const s of preferred) {
            if (!unique.includes(s.id)) unique.push(s.id);
            if (unique.length >= DEFAULT_VISIBLE) break;
          }
          return unique.length > 0 ? unique : ids.slice(0, DEFAULT_VISIBLE);
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
      setError(
        t('errorDescription', {
          defaultValue: 'We could not load this report. Please try again.',
        })
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    void loadTeamsAndMembers();
  }, [loadTeamsAndMembers]);

  useEffect(() => {
    void loadProjectsForTeams(selectedTeamIds);
  }, [selectedTeamIds, loadProjectsForTeams]);

  useEffect(() => {
    if (filtersLoading) return;
    void loadSeries();
  }, [loadSeries, filtersLoading]);

  const breachedStatusIds = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.wip_breaches.map(b => b.status_id))];
  }, [data]);

  const latestBreaches = useMemo(() => {
    if (!data?.wip_breaches.length) return [];
    const lastDate = data.dates[data.dates.length - 1];
    return data.wip_breaches.filter(b => b.date === lastDate);
  }, [data]);

  const handleExport = async (format: AnalyticsExportFormat) => {
    if (!data) return;
    setExporting(true);
    try {
      const stamp = dayjs().format('YYYY-MM-DD');
      if (format === 'csv') {
        const blob = await analyticsCfdApiService.exportCsv(filters);
        downloadBlob(blob, `cfd-matrix-${stamp}.csv`);
        return;
      }
      if (format === 'png') {
        const png = chartRef.current?.toPngDataUrl();
        if (!png) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        const res = await fetch(png);
        downloadBlob(await res.blob(), `cfd-${stamp}.png`);
        return;
      }
      if (format === 'svg') {
        const svg = chartRef.current?.toSvgMarkup();
        if (!svg) {
          message.warning(t('exportChartMissing', { defaultValue: 'Chart is not ready to export' }));
          return;
        }
        downloadText(svg, `cfd-${stamp}.svg`, 'image/svg+xml');
        return;
      }
      if (format === 'pdf') {
        const png = chartRef.current?.toPngDataUrl();
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text(title, 40, 40);
        doc.setFontSize(11);
        doc.text(
          `${t('cfdKpiWip', { defaultValue: 'Current WIP' })}: ${data.indicators.current_wip}  |  ` +
            `${t('cfdKpiThroughput', { defaultValue: 'Throughput' })}: ${data.indicators.avg_throughput_per_day}`,
          40,
          60
        );
        if (png) {
          doc.addImage(png, 'PNG', 40, 80, 720, 360);
        }
        doc.save(`cfd-${stamp}.pdf`);
      }
    } catch {
      message.error(t('exportFailed', { defaultValue: 'Export failed' }));
    } finally {
      setExporting(false);
    }
  };

  const cfdFilters = (
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
      filters={cfdFilters}
      onExport={handleExport}
      exportDisabled={!data}
      exportFormats={['csv', 'pdf', 'png', 'svg']}
      exportLoading={exporting}
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
          {latestBreaches.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={t('cfdWipBreachTitle', {
                defaultValue: 'WIP limit exceeded',
              })}
              description={t('cfdWipBreachDescription', {
                defaultValue:
                  '{{count}} status(es) are above their WIP threshold on the latest day.',
                count: latestBreaches.length,
              })}
            />
          )}

          {data && <CfdKpiTiles indicators={data.indicators} />}

          <ChartTableWrapper
            chartTitle={title}
            rowCount={data?.series.length}
            chart={
              <Flex gap={16} wrap="wrap" align="flex-start">
                <div style={{ flex: '1 1 480px', minWidth: 0 }}>
                  {data ? (
                    <CfdChart
                      ref={chartRef}
                      data={data}
                      visibleStatusIds={visibleStatusIds}
                      statusOrder={statusOrder}
                      breachedStatusIds={breachedStatusIds}
                      showSprintOverlay={false}
                    />
                  ) : null}
                </div>
                {data && (
                  <CfdStatusLegend
                    items={statusOrder
                      .map(id => data.statuses.find(s => s.id === id))
                      .filter((s): s is CfdStatusMeta => !!s)
                      .map(status => ({
                        status,
                        visible: visibleStatusIds.includes(status.id),
                        threshold: wipThresholds[status.id],
                      }))}
                    onToggle={(statusId, visible) => {
                      setVisibleStatusIds(prev =>
                        visible
                          ? prev.includes(statusId)
                            ? prev
                            : [...prev, statusId]
                          : prev.filter(id => id !== statusId)
                      );
                    }}
                    onReorder={(from, to) => {
                      setStatusOrder(prev => {
                        const next = [...prev];
                        const [moved] = next.splice(from, 1);
                        next.splice(to, 0, moved);
                        return next;
                      });
                    }}
                    onThresholdChange={(statusId, value) => {
                      setWipThresholds(prev => {
                        const next = { ...prev };
                        if (value === null || value === undefined) {
                          delete next[statusId];
                        } else {
                          next[statusId] = value;
                        }
                        return next;
                      });
                    }}
                  />
                )}
              </Flex>
            }
            table={
              data ? (
                <CfdTable
                  data={data}
                  visibleStatusIds={visibleStatusIds}
                  statusOrder={statusOrder}
                />
              ) : null
            }
          />
        </Flex>
      )}
    </ReportPageShell>
  );
};

export default CumulativeFlowPage;
