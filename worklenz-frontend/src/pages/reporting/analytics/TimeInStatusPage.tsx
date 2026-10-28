import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DatePicker,
  Flex,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from '@/shared/antd-imports';
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
import { analyticsTimeInStatusApiService } from '@/api/reporting/analytics-time-in-status.api.service';
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
import { MultiSelectFilterPill } from '@/components/common/filters/MultiSelectFilterPill';
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
  TimeInStatusDateMode,
  TimeInStatusFilters,
  TimeInStatusSeriesResponse,
  TimeInStatusSort,
  TimeInStatusViewMode,
} from '@/types/reporting/analytics-time-in-status.types';
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

const TimeInStatusPage: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const dispatch = useAppDispatch();
  const title = t('timeInStatus', { defaultValue: 'Time in Status' });
  useDocumentTitle(title);

  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const teamMembersState = useAppSelector(state => state.teamMembersReducer.teamMembers);

  const [datePreset, setDatePreset] = useState<AnalyticsDatePreset>('last_30_days');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [selectedIssueTypes, setSelectedIssueTypes] = useState<string[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [selectedEpicIds, setSelectedEpicIds] = useState<string[]>([]);
  const [selectedSprintIds, setSelectedSprintIds] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<FilterOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<FilterOption[]>([]);
  const [labelOptions, setLabelOptions] = useState<FilterOption[]>([]);
  const [epicOptions, setEpicOptions] = useState<FilterOption[]>([]);
  const [sprintOptions, setSprintOptions] = useState<FilterOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  const [dateMode, setDateMode] = useState<TimeInStatusDateMode>('overlapping');
  const [excludeWeekends, setExcludeWeekends] = useState(false);
  const [reportView, setReportView] = useState<TimeInStatusViewMode>('aggregate');
  const [sort, setSort] = useState<TimeInStatusSort>('avg_desc');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TimeInStatusSeriesResponse | null>(null);

  const aggregateChartRef = useRef<TisAggregateChartHandle>(null);
  const perIssueChartRef = useRef<TisPerIssueChartHandle>(null);
  const hasSelection = selectedProjectIds.length > 0;

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

  const filters: TimeInStatusFilters = useMemo(
    () => ({
      project_ids: selectedProjectIds,
      team_ids: selectedTeamIds,
      status_ids: selectedStatusIds,
      assignee_ids: selectedAssigneeIds,
      issue_types: selectedIssueTypes,
      label_ids: selectedLabelIds,
      epic_ids: selectedEpicIds,
      sprint_ids: selectedSprintIds,
      date_from: dateBounds.date_from,
      date_to: dateBounds.date_to,
      date_mode: dateMode,
      exclude_weekends: excludeWeekends,
      view_mode: reportView,
      sort,
      limit: reportView === 'per_issue' ? 100 : 50,
      offset: 0,
    }),
    [
      selectedProjectIds,
      selectedTeamIds,
      selectedStatusIds,
      selectedAssigneeIds,
      selectedIssueTypes,
      selectedLabelIds,
      selectedEpicIds,
      selectedSprintIds,
      dateBounds,
      dateMode,
      excludeWeekends,
      reportView,
      sort,
    ]
  );

  const loadTeams = useCallback(async () => {
    setFiltersLoading(true);
    try {
      void dispatch(getTeamMembers());
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

  const loadFilterOptions = useCallback(async (projectIds: string[], teamIds: string[]) => {
    if (projectIds.length === 0) {
      setStatusOptions([]);
      setLabelOptions([]);
      setEpicOptions([]);
      setSprintOptions([]);
      return;
    }
    try {
      const res = await analyticsTimeInStatusApiService.getFilterOptions({
        project_ids: projectIds,
        team_ids: teamIds,
      });
      if (res.done && res.body) {
        setStatusOptions(
          res.body.statuses.map(s => ({ value: s.id, label: s.name }))
        );
        setLabelOptions(res.body.labels.map(l => ({ value: l.id, label: l.name })));
        setEpicOptions(res.body.epics.map(e => ({ value: e.id, label: e.name })));
        setSprintOptions(
          res.body.sprints.map(s => ({ value: s.id, label: s.name }))
        );
      }
    } catch {
      // keep prior options
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
      const res = await analyticsTimeInStatusApiService.getSeries(filters);
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
  }, [filters, hasSelection, datePreset, customRange, t]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    void loadProjectsForTeams(selectedTeamIds);
  }, [selectedTeamIds, loadProjectsForTeams]);

  useEffect(() => {
    void loadFilterOptions(selectedProjectIds, selectedTeamIds);
  }, [selectedProjectIds, selectedTeamIds, loadFilterOptions]);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  useEffect(() => {
    setSort(reportView === 'per_issue' ? 'total_desc' : 'avg_desc');
  }, [reportView]);

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
          { value: 'avg_desc', label: t('tisSortAvgDesc', { defaultValue: 'Avg (high ? low)' }) },
          { value: 'avg_asc', label: t('tisSortAvgAsc', { defaultValue: 'Avg (low ? high)' }) },
          {
            value: 'median_desc',
            label: t('tisSortMedianDesc', { defaultValue: 'Median (high ? low)' }),
          },
          {
            value: 'count_desc',
            label: t('tisSortCountDesc', { defaultValue: 'Count (high ? low)' }),
          },
          { value: 'name_asc', label: t('tisSortNameAsc', { defaultValue: 'Status name' }) },
        ]
      : [
          {
            value: 'total_desc',
            label: t('tisSortTotalDesc', { defaultValue: 'Total (high ? low)' }),
          },
          {
            value: 'total_asc',
            label: t('tisSortTotalAsc', { defaultValue: 'Total (low ? high)' }),
          },
          { value: 'key_asc', label: t('tisSortKeyAsc', { defaultValue: 'Task key' }) },
          { value: 'name_asc', label: t('tisSortTaskNameAsc', { defaultValue: 'Task name' }) },
        ];

  const tisFilters = (
    <Flex gap={8} wrap="nowrap" align="center" style={{ overflowX: 'auto', width: '100%' }}>
      <AnalyticsFilterBar
        projectOptions={projectOptions}
        selectedProjectIds={selectedProjectIds}
        onProjectsChange={setSelectedProjectIds}
        teamOptions={teamOptions}
        selectedTeamIds={selectedTeamIds}
        onTeamsChange={setSelectedTeamIds}
        memberOptions={memberOptions}
        selectedMemberIds={selectedAssigneeIds}
        onMembersChange={setSelectedAssigneeIds}
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
        mode="multiple"
        allowClear
        maxTagCount="responsive"
        placeholder={t('tisFilterType', { defaultValue: 'Type' })}
        style={{ minWidth: 120 }}
        value={selectedIssueTypes}
        onChange={setSelectedIssueTypes}
        options={[
          { value: 'task', label: t('tisTypeTask', { defaultValue: 'Task' }) },
          { value: 'story', label: t('tisTypeStory', { defaultValue: 'Story' }) },
          { value: 'bug', label: t('tisTypeBug', { defaultValue: 'Bug' }) },
        ]}
        aria-label={t('tisFilterType', { defaultValue: 'Type' })}
      />

      {labelOptions.length > 0 && (
        <MultiSelectFilterPill
          label={t('tisFilterLabels', { defaultValue: 'Labels' })}
          options={labelOptions}
          value={selectedLabelIds}
          onChange={setSelectedLabelIds}
          searchPlaceholder={t('tisSearchLabels', { defaultValue: 'Search labels' })}
          emptyText={t('tisNoLabels', { defaultValue: 'No labels found' })}
        />
      )}

      {epicOptions.length > 0 && (
        <MultiSelectFilterPill
          label={t('tisFilterEpics', { defaultValue: 'Epics' })}
          options={epicOptions}
          value={selectedEpicIds}
          onChange={setSelectedEpicIds}
          searchPlaceholder={t('tisSearchEpics', { defaultValue: 'Search epics' })}
          emptyText={t('tisNoEpics', { defaultValue: 'No epics found' })}
        />
      )}

      {sprintOptions.length > 0 && (
        <MultiSelectFilterPill
          label={t('tisFilterSprints', { defaultValue: 'Sprints' })}
          options={sprintOptions}
          value={selectedSprintIds}
          onChange={setSelectedSprintIds}
          searchPlaceholder={t('tisSearchSprints', { defaultValue: 'Search sprints' })}
          emptyText={t('tisNoSprints', { defaultValue: 'No sprints found' })}
        />
      )}

      <Select
        value={dateMode}
        onChange={setDateMode}
        style={{ minWidth: 150 }}
        options={[
          {
            value: 'overlapping',
            label: t('tisDateModeOverlapping', { defaultValue: 'In range' }),
          },
          {
            value: 'entered',
            label: t('tisDateModeEntered', { defaultValue: 'Entered status' }),
          },
          {
            value: 'exited',
            label: t('tisDateModeExited', { defaultValue: 'Exited status' }),
          },
        ]}
        aria-label={t('tisDateMode', { defaultValue: 'Date mode' })}
      />

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
        <Switch checked={excludeWeekends} onChange={setExcludeWeekends} />
        <Text style={{ whiteSpace: 'nowrap' }}>
          {t('tisExcludeWeekends', { defaultValue: 'Exclude weekends' })}
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
      filters={tisFilters}
      onExport={handleExport}
      exportDisabled={!data || !hasSelection}
      exportFormats={['csv', 'pdf', 'png', 'svg']}
      exportLoading={exporting}
    >
      {!hasSelection ? (
        <Flex align="center" justify="center" style={{ minHeight: 320 }}>
          <ReportEmptyState
            title={t('tisNoSelectionTitle', { defaultValue: 'Select projects' })}
            description={t('tisNoSelectionDescription', {
              defaultValue:
                'Choose one or more projects (up to 20) to analyze time spent in each status.',
            })}
          />
        </Flex>
      ) : loading ? (
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
