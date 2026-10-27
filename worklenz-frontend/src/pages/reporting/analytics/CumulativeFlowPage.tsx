import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  DatePicker,
  Flex,
  Select,
  Space,
  Switch,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { jsPDF } from 'jspdf';

dayjs.extend(quarterOfYear);

import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { analyticsCfdApiService } from '@/api/reporting/analytics-cfd.api.service';
import { useAuthService } from '@/hooks/useAuth';
import {
  AnalyticsFilterBar,
  ChartTableWrapper,
  ReportEmptyState,
  ReportErrorState,
  ReportLoadingSkeleton,
  ReportPageShell,
  type AnalyticsDatePreset,
  type AnalyticsExportFormat,
  type ChartTableMode,
} from '@/components/reporting/analytics';
import type { FilterOption } from '@/components/common/filters/MultiSelectFilterPill';
import { CfdChart, type CfdChartHandle } from '@/components/reporting/analytics/cfd/CfdChart';
import { CfdKpiTiles } from '@/components/reporting/analytics/cfd/CfdKpiTiles';
import { CfdStatusLegend } from '@/components/reporting/analytics/cfd/CfdStatusLegend';
import { CfdTable } from '@/components/reporting/analytics/cfd/CfdTable';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import type {
  CfdGroupBy,
  CfdSeriesFilters,
  CfdSeriesResponse,
  CfdSmoothing,
  CfdStatusMeta,
} from '@/types/reporting/analytics-cfd.types';

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

const CumulativeFlowPage: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const title = t('cumulativeFlow', { defaultValue: 'Cumulative Flow' });
  useDocumentTitle(title);

  const authService = useAuthService();
  const session = authService.getCurrentSession();

  const [datePreset, setDatePreset] = useState<AnalyticsDatePreset>('last_30_days');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<FilterOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  const [groupBy, setGroupBy] = useState<CfdGroupBy>('all');
  const [smoothing, setSmoothing] = useState<CfdSmoothing>('raw');
  const [sprintOverlay, setSprintOverlay] = useState(false);
  const [wipThresholds, setWipThresholds] = useState<Record<string, number>>({});
  const [statusOrder, setStatusOrder] = useState<string[]>([]);
  const [visibleStatusIds, setVisibleStatusIds] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<ChartTableMode>('chart');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CfdSeriesResponse | null>(null);

  const chartRef = useRef<CfdChartHandle>(null);
  /** CFD requires explicit projects — selecting a whole team’s projects freezes the chart. */
  const hasSelection = selectedProjectIds.length > 0;

  const dateBounds = useMemo(() => {
    if (datePreset === 'custom' && customRange) {
      return {
        date_from: customRange[0].startOf('day').toISOString(),
        date_to: customRange[1].endOf('day').toISOString(),
      };
    }
    const end = dayjs();
    let start = end.subtract(30, 'day');
    if (datePreset === 'last_7_days') start = end.subtract(7, 'day');
    if (datePreset === 'last_14_days') start = end.subtract(14, 'day');
    if (datePreset === 'last_30_days') start = end.subtract(30, 'day');
    if (datePreset === 'last_60_days') start = end.subtract(60, 'day');
    if (datePreset === 'last_90_days') start = end.subtract(90, 'day');
    if (datePreset === 'this_quarter') start = end.startOf('quarter');
    if (datePreset === 'custom') return { date_from: null, date_to: null };
    return {
      date_from: start.startOf('day').toISOString(),
      date_to: end.endOf('day').toISOString(),
    };
  }, [datePreset, customRange]);

  const filters: CfdSeriesFilters = useMemo(
    () => ({
      project_ids: selectedProjectIds,
      team_ids: selectedTeamIds,
      status_ids: selectedStatusIds,
      date_from: dateBounds.date_from,
      date_to: dateBounds.date_to,
      group_by: groupBy,
      smoothing,
      wip_thresholds: wipThresholds,
      sprint_overlay: sprintOverlay,
    }),
    [
      selectedProjectIds,
      selectedTeamIds,
      selectedStatusIds,
      dateBounds,
      groupBy,
      smoothing,
      wipThresholds,
      sprintOverlay,
    ]
  );

  const loadTeams = useCallback(async () => {
    setFiltersLoading(true);
    try {
      const teamsRes = await reportingApiService.getOverviewTeams(true);
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
  }, [session?.team_id, t]);

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
    if (!hasSelection) {
      setData(null);
      return;
    }
    if (datePreset === 'custom' && !customRange) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analyticsCfdApiService.getSeries(filters);
      if (res.done && res.body) {
        setData(res.body);
        const statuses = res.body.statuses;
        const ids = statuses.map(s => s.id);
        setStatusOrder(prev => {
          const retained = prev.filter(id => ids.includes(id));
          const missing = ids.filter(id => !retained.includes(id));
          return [...retained, ...missing];
        });
        // Cap initial visible bands so Chart.js stays responsive.
        const DEFAULT_VISIBLE = 12;
        setVisibleStatusIds(prev => {
          const stillValid = prev.filter(id => ids.includes(id));
          if (stillValid.length > 0) return stillValid;
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
  }, [filters, hasSelection, datePreset, customRange, t]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    void loadProjectsForTeams(selectedTeamIds);
  }, [selectedTeamIds, loadProjectsForTeams]);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  const statusOptions: FilterOption[] = useMemo(
    () =>
      (data?.statuses ?? []).map(s => ({
        value: s.id,
        label: s.name,
      })),
    [data?.statuses]
  );

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
    <Flex gap={8} wrap="nowrap" align="center" style={{ overflowX: 'auto', width: '100%' }}>
      <AnalyticsFilterBar
        projectOptions={projectOptions}
        selectedProjectIds={selectedProjectIds}
        onProjectsChange={setSelectedProjectIds}
        teamOptions={teamOptions}
        selectedTeamIds={selectedTeamIds}
        onTeamsChange={setSelectedTeamIds}
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        statusOptions={statusOptions}
        selectedStatusIds={selectedStatusIds}
        onStatusesChange={setSelectedStatusIds}
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
        value={groupBy}
        onChange={setGroupBy}
        style={{ minWidth: 140 }}
        options={[
          { value: 'all', label: t('cfdGroupAll', { defaultValue: 'All issues' }) },
          { value: 'epic', label: t('cfdGroupEpic', { defaultValue: 'By epic' }) },
          { value: 'label', label: t('cfdGroupLabel', { defaultValue: 'By label' }) },
          { value: 'assignee', label: t('cfdGroupAssignee', { defaultValue: 'By assignee' }) },
        ]}
        aria-label={t('cfdGroupBy', { defaultValue: 'Group by' })}
      />

      <Select
        value={smoothing}
        onChange={setSmoothing}
        style={{ minWidth: 160 }}
        options={[
          { value: 'raw', label: t('cfdSmoothingRaw', { defaultValue: 'Raw daily' }) },
          {
            value: 'rolling_7',
            label: t('cfdSmoothingRolling7', { defaultValue: '7-day rolling average' }),
          },
        ]}
        aria-label={t('cfdSmoothing', { defaultValue: 'Smoothing' })}
      />

      <Space size={6} style={{ flexShrink: 0 }}>
        <Switch checked={sprintOverlay} onChange={setSprintOverlay} />
        <Text style={{ whiteSpace: 'nowrap' }}>
          {t('cfdSprintOverlay', { defaultValue: 'Sprint overlay' })}
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
      filters={cfdFilters}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onExport={handleExport}
      exportDisabled={!data || !hasSelection}
      exportFormats={['csv', 'pdf', 'png', 'svg']}
      exportLoading={exporting}
    >
      {!hasSelection ? (
        <Flex align="center" justify="center" style={{ minHeight: 320 }}>
          <ReportEmptyState
            title={t('cfdNoSelectionTitle', {
              defaultValue: 'Select projects',
            })}
            description={t('cfdNoSelectionDescription', {
              defaultValue:
                'Choose one or more projects (up to 20) to view cumulative flow. Selecting every project at once can freeze the chart.',
            })}
          />
        </Flex>
      ) : loading ? (
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

          <div
            style={{
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              padding: 16,
              background: token.colorBgContainer,
            }}
          >
            <Flex gap={16} wrap="wrap" align="flex-start">
              <div style={{ flex: '1 1 480px', minWidth: 0 }}>
                <ChartTableWrapper
                  mode={viewMode}
                  chart={
                    data ? (
                      <CfdChart
                        ref={chartRef}
                        data={data}
                        visibleStatusIds={visibleStatusIds}
                        statusOrder={statusOrder}
                        breachedStatusIds={breachedStatusIds}
                        showSprintOverlay={sprintOverlay}
                      />
                    ) : null
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
              </div>
              {data && viewMode === 'chart' && (
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
          </div>
        </Flex>
      )}
    </ReportPageShell>
  );
};

export default CumulativeFlowPage;
