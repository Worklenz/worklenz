import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Flex, Select, Space, Switch, Typography, message } from '@/shared/antd-imports';
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
import { analyticsTimeInStatusApiService } from '@/api/reporting/analytics-time-in-status.api.service';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import {
  AnalyticsFilterBar,
  ChartTableWrapper,
  ReportErrorState,
  ReportLoadingSkeleton,
  ReportPageShell,
  type AnalyticsDatePreset,
  type AnalyticsExportFormat,
} from '@/components/reporting/analytics';
import type { FilterOption } from '@/components/common/filters/MultiSelectFilterPill';
import {
  TisAggregateChart,
  type TisAggregateChartHandle,
} from '@/components/reporting/analytics/time-in-status/TisAggregateChart';
import { TisAggregateTable } from '@/components/reporting/analytics/time-in-status/TisAggregateTable';
import {
  TisPerIssueChart,
  type TisPerIssueChartHandle,
} from '@/components/reporting/analytics/time-in-status/TisPerIssueChart';
import { TisPerIssueTable } from '@/components/reporting/analytics/time-in-status/TisPerIssueTable';
import { TisKpiTiles } from '@/components/reporting/analytics/time-in-status/TisKpiTiles';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import type {
  TimeInStatusFilters,
  TimeInStatusSeriesResponse,
  TimeInStatusSort,
  TimeInStatusViewMode,
} from '@/types/reporting/analytics-time-in-status.types';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

const { Text } = Typography;

const DEFAULT_DATE_MODE = 'overlapping' as const;

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

const TimeInStatusPage: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const dispatch = useAppDispatch();
  const title = t('timeInStatus', { defaultValue: 'Time in Status' });
  useDocumentTitle(title);

  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const teamMembersState = useAppSelector(state => state.teamMembersReducer.teamMembers);

  const [datePreset, setDatePreset] = useState<AnalyticsDatePreset>('last_30_days');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  const [reportView, setReportView] = useState<TimeInStatusViewMode>('aggregate');
  const [sort, setSort] = useState<TimeInStatusSort>('avg_desc');
  const [excludeWeekends, setExcludeWeekends] = useState(false);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TimeInStatusSeriesResponse | null>(null);

  const aggregateChartRef = useRef<TisAggregateChartHandle>(null);
  const perIssueChartRef = useRef<TisPerIssueChartHandle>(null);

  const memberOptions: FilterOption[] = useMemo(() => {
    const list = (teamMembersState?.data ?? []) as ITeamMemberViewModel[];
    return list
      .filter(m => m.id)
      .map(m => ({
        value: String(m.id),
        label: m.name || m.email || String(m.id),
      }));
  }, [teamMembersState?.data]);

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

  const filters: TimeInStatusFilters = useMemo(
    () => ({
      project_ids: selectedProjectIds,
      team_ids: selectedTeamIds,
      status_ids: [],
      assignee_ids: selectedMemberIds,
      issue_types: [],
      label_ids: [],
      epic_ids: [],
      sprint_ids: [],
      date_from: dateBounds.date_from,
      date_to: dateBounds.date_to,
      date_mode: DEFAULT_DATE_MODE,
      exclude_weekends: excludeWeekends,
      view_mode: reportView,
      sort,
      limit: reportView === 'per_issue' ? 100 : 50,
      offset: 0,
    }),
    [
      selectedProjectIds,
      selectedTeamIds,
      selectedMemberIds,
      dateBounds,
      excludeWeekends,
      reportView,
      sort,
    ]
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

  const localizeCategoryLabel = useCallback(
    (statusId: string, fallback: string) => {
      if (statusId === '__tis_todo__') {
        return t('cfdCategoryTodo', { defaultValue: 'To do' });
      }
      if (statusId === '__tis_doing__') {
        return t('cfdCategoryDoing', { defaultValue: 'In progress' });
      }
      if (statusId === '__tis_done__') {
        return t('cfdCategoryDone', { defaultValue: 'Done' });
      }
      return fallback;
    },
    [t]
  );

  const loadSeries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Empty project_ids → all accessible projects rolled into To do / Doing / Done.
      // Selected project_ids → that project's full status list.
      const res = await analyticsTimeInStatusApiService.getSeries(filters);
      if (res.done && res.body) {
        const localizedStatuses = res.body.statuses.map(status => ({
          ...status,
          name: localizeCategoryLabel(status.id, status.name),
        }));
        const localizedAggregate = res.body.aggregate.map(row => ({
          ...row,
          status_name: localizeCategoryLabel(row.status_id, row.status_name),
        }));
        const localizedIssues = res.body.issues.map(issue => ({
          ...issue,
          segments: issue.segments.map(seg => ({
            ...seg,
            status_name: localizeCategoryLabel(seg.status_id, seg.status_name),
          })),
        }));
        setData({
          ...res.body,
          statuses: localizedStatuses,
          aggregate: localizedAggregate,
          issues: localizedIssues,
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
  }, [filters, localizeCategoryLabel, t]);

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

  useEffect(() => {
    setSort(reportView === 'per_issue' ? 'total_desc' : 'avg_desc');
  }, [reportView]);

  const handleClearFilters = () => {
    setSelectedProjectIds([]);
    setSelectedMemberIds([]);
    setDatePreset('last_30_days');
    setExcludeWeekends(false);
    setReportView('aggregate');
  };

  const handleExport = async (format: AnalyticsExportFormat) => {
    if (!data) return;
    setExporting(true);
    try {
      const stamp = dayjs().format('YYYY-MM-DD');
      const chartRef = reportView === 'aggregate' ? aggregateChartRef : perIssueChartRef;

      if (format === 'csv') {
        const blob = await analyticsTimeInStatusApiService.exportCsv(filters);
        downloadBlob(
          blob,
          `time-in-status-${reportView === 'per_issue' ? 'issues' : 'aggregate'}-${stamp}.csv`
        );
        return;
      }
      if (format === 'png') {
        const png = chartRef.current?.toPngDataUrl();
        if (!png) {
          message.warning(
            t('exportChartMissing', { defaultValue: 'Chart is not ready to export' })
          );
          return;
        }
        const res = await fetch(png);
        downloadBlob(await res.blob(), `time-in-status-${stamp}.png`);
        return;
      }
      if (format === 'svg') {
        const svg = chartRef.current?.toSvgMarkup();
        if (!svg) {
          message.warning(
            t('exportChartMissing', { defaultValue: 'Chart is not ready to export' })
          );
          return;
        }
        downloadText(svg, `time-in-status-${stamp}.svg`, 'image/svg+xml');
        return;
      }
      if (format === 'pdf') {
        const png = chartRef.current?.toPngDataUrl();
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text(title, 40, 40);
        doc.setFontSize(11);
        doc.text(
          `${t('tisKpiIssues', { defaultValue: 'Issues' })}: ${data.summary.issue_count}  |  ` +
            `${t('tisKpiOutliers', { defaultValue: 'Outliers' })}: ${data.summary.outlier_count}`,
          40,
          60
        );
        if (png) {
          doc.addImage(png, 'PNG', 40, 80, 720, 360);
        }
        doc.save(`time-in-status-${stamp}.pdf`);
      }
    } catch {
      message.error(t('exportFailed', { defaultValue: 'Export failed' }));
    } finally {
      setExporting(false);
    }
  };

  const sortOptions =
    reportView === 'aggregate'
      ? [
          { value: 'avg_desc', label: t('tisSortAvgDesc', { defaultValue: 'Avg (high → low)' }) },
          { value: 'avg_asc', label: t('tisSortAvgAsc', { defaultValue: 'Avg (low → high)' }) },
          {
            value: 'median_desc',
            label: t('tisSortMedianDesc', { defaultValue: 'Median (high → low)' }),
          },
          {
            value: 'count_desc',
            label: t('tisSortCountDesc', { defaultValue: 'Count (high → low)' }),
          },
          { value: 'name_asc', label: t('tisSortNameAsc', { defaultValue: 'Status name' }) },
        ]
      : [
          {
            value: 'total_desc',
            label: t('tisSortTotalDesc', { defaultValue: 'Total (high → low)' }),
          },
          {
            value: 'total_asc',
            label: t('tisSortTotalAsc', { defaultValue: 'Total (low → high)' }),
          },
          { value: 'key_asc', label: t('tisSortKeyAsc', { defaultValue: 'Task key' }) },
          { value: 'name_asc', label: t('tisSortTaskNameAsc', { defaultValue: 'Task name' }) },
        ];

  const tisFilters = (
    <Flex vertical gap={8} style={{ width: '100%' }}>
      <Flex gap={8} wrap="wrap" align="center" style={{ width: '100%' }}>
        <Select
          value={datePreset}
          onChange={setDatePreset}
          style={{ minWidth: 160 }}
          options={[
            { value: 'last_7_days', label: t('dateLast7', { defaultValue: 'Last 7 days' }) },
            { value: 'last_30_days', label: t('dateLast30', { defaultValue: 'Last 30 days' }) },
            { value: 'last_90_days', label: t('dateLast90', { defaultValue: 'Last 90 days' }) },
            {
              value: 'this_quarter',
              label: t('dateThisQuarter', { defaultValue: 'This quarter' }),
            },
          ]}
          aria-label={t('datePreset', { defaultValue: 'Date range' })}
        />

        <AnalyticsFilterBar
          projectOptions={projectOptions}
          selectedProjectIds={selectedProjectIds}
          onProjectsChange={setSelectedProjectIds}
          memberOptions={memberOptions}
          selectedMemberIds={selectedMemberIds}
          onMembersChange={setSelectedMemberIds}
          loading={filtersLoading}
        />

        <Button onClick={handleClearFilters}>
          {t('clearFilters', { defaultValue: 'Clear' })}
        </Button>
      </Flex>

      <Flex gap={8} wrap="wrap" align="center" style={{ width: '100%' }}>
        <Select
          value={reportView}
          onChange={setReportView}
          style={{ minWidth: 140 }}
          options={[
            {
              value: 'aggregate',
              label: t('tisViewAggregate', { defaultValue: 'Aggregate' }),
            },
            {
              value: 'per_issue',
              label: t('tisViewPerIssue', { defaultValue: 'Per issue' }),
            },
          ]}
          aria-label={t('tisViewMode', { defaultValue: 'View mode' })}
        />

        <Select
          value={sort}
          onChange={setSort}
          style={{ minWidth: 160 }}
          options={sortOptions}
          aria-label={t('tisSort', { defaultValue: 'Sort' })}
        />

        <Space size={6} style={{ flexShrink: 0 }}>
          <Switch
            checked={excludeWeekends}
            onChange={setExcludeWeekends}
            aria-label={t('tisExcludeWeekends', { defaultValue: 'Exclude weekends' })}
          />
          <Text style={{ whiteSpace: 'nowrap' }}>
            {t('tisExcludeWeekends', { defaultValue: 'Exclude weekends' })}
          </Text>
        </Space>
      </Flex>
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
      filters={tisFilters}
      onExport={handleExport}
      exportDisabled={!data}
      exportFormats={['csv', 'pdf', 'png', 'svg']}
      exportLoading={exporting}
    >
      {loading && !data ? (
        <ReportLoadingSkeleton />
      ) : error ? (
        <ReportErrorState message={error} onRetry={() => void loadSeries()} />
      ) : (
        <Flex vertical gap={16}>
          {data && <TisKpiTiles summary={data.summary} />}

          <ChartTableWrapper
            chartTitle={title}
            rowCount={
              data
                ? reportView === 'aggregate'
                  ? data.aggregate.length
                  : data.issues.length
                : undefined
            }
            chart={
              data ? (
                reportView === 'aggregate' ? (
                  <TisAggregateChart ref={aggregateChartRef} rows={data.aggregate} />
                ) : (
                  <TisPerIssueChart
                    ref={perIssueChartRef}
                    issues={data.issues}
                    statuses={data.statuses}
                  />
                )
              ) : null
            }
            table={
              data ? (
                reportView === 'aggregate' ? (
                  <TisAggregateTable rows={data.aggregate} />
                ) : (
                  <TisPerIssueTable issues={data.issues} />
                )
              ) : null
            }
          />
        </Flex>
      )}
    </ReportPageShell>
  );
};

export default TimeInStatusPage;
