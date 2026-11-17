import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Flex,
  InfoCircleOutlined,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';

import {
  CustomPageHeader,
  ReportingTeamsFilter,
  ReportingProjectsFilter,
  ReportingDateRangeFilter,
  DATE_RANGE_PRESETS,
} from '@/components/reporting/common';
import '@/components/reporting/common/reporting-filter-bar.css';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import {
  IRPTEfficiencyLevel,
  IRPTEfficiencyRow,
  IRPTTeam,
} from '@/types/reporting/reporting.types';
import { ISelectableProject } from '@/types/reporting/reporting-filters.types';

const HOURS_PER_DAY = 8;

const EfficiencyReports = () => {
  const { t } = useTranslation('reporting-efficiency');
  useDocumentTitle('Reporting - Efficiency');

  const [level, setLevel] = useState<IRPTEfficiencyLevel>('project');
  const [teams, setTeams] = useState<IRPTTeam[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [projects, setProjects] = useState<ISelectableProject[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<string>('last_month');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(
    () => DATE_RANGE_PRESETS.find(p => p.key === 'last_month')!.range()
  );

  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [rows, setRows] = useState<IRPTEfficiencyRow[]>([]);
  const [fetchState, setFetchState] = useState<'idle' | 'empty' | 'loaded'>('idle');
  const [userFiltered, setUserFiltered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Display controls — do not trigger a re-fetch, applied client-side.
  const [displayUnit, setDisplayUnit] = useState<'hours' | 'mandays'>('hours');
  const [formula, setFormula] = useState<'budget' | 'efficiency'>('budget');

  const isCompany = level === 'company';

  useEffect(() => {
    (async () => {
      setLoadingTeams(true);
      try {
        const res = await reportingApiService.getOverviewTeams(true);
        if (res.done) {
          setTeams(res.body || []);
          setSelectedTeams((res.body || []).map(team => team.id));
        }
      } finally {
        setLoadingTeams(false);
        setInitialLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedTeams.length) {
        setProjects([]);
        return;
      }
      setLoadingProjects(true);
      try {
        const catRes = await reportingApiService.getCategories(selectedTeams);
        const categoryIds = (catRes.body || []).map(category => category.id).filter(Boolean) as string[];
        const res = await reportingApiService.getAllocationProjects(selectedTeams, categoryIds, true);
        if (res.done) setProjects(res.body || []);
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, [selectedTeams]);

  const buildBody = useCallback(() => ({
    level,
    teams: selectedTeams,
    projects: selectedProjects,
    duration: 'CUSTOM',
    date_range: [dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD')],
    archived: true,
  }), [level, selectedTeams, selectedProjects, dateRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportingApiService.getEfficiency(buildBody());
      if (res.done) {
        const data = res.body || [];
        setRows(data);
        setFetchState(data.length ? 'loaded' : 'empty');
      }
    } catch {
      message.error(t('fetchError', { defaultValue: 'Failed to load efficiency data' }));
    } finally {
      setLoading(false);
    }
  }, [buildBody, t]);

  useEffect(() => {
    if (!initialLoaded) return;
    if (selectedTeams.length > 0 || isCompany) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoaded, selectedTeams, selectedProjects, dateRange, level]);

  // Changing level/teams/projects/dateRange after initial load counts as a user action.
  useEffect(() => {
    if (initialLoaded) setUserFiltered(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, selectedTeams, selectedProjects, dateRange]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await reportingApiService.exportEfficiency(buildBody());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Efficiency_${level}_${dayjs().format('YYYY-MM-DD')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error(t('exportError', { defaultValue: 'Export failed' }));
    } finally {
      setExporting(false);
    }
  }, [buildBody, level, t]);

  // Format raw seconds according to the current display unit.
  const fmtSeconds = useCallback((s: number): string => {
    if (displayUnit === 'mandays') {
      return `${(s / (HOURS_PER_DAY * 3600)).toFixed(1)}d`;
    }
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }, [displayUnit]);

  // Render efficiency tag from raw seconds using the selected formula.
  const renderEff = useCallback((estimated: number, logged: number) => {
    if (formula === 'budget') {
      if (estimated === 0) return <Tag>{t('noData', { defaultValue: 'No estimate' })}</Tag>;
      const pct = +((logged / estimated) * 100).toFixed(1);
      const color = pct <= 100 ? 'green' : pct <= 120 ? 'orange' : 'red';
      return <Tag color={color}>{pct}%</Tag>;
    } else {
      if (logged === 0) return <Tag>{t('noData', { defaultValue: 'No logs' })}</Tag>;
      const pct = +((estimated / logged) * 100).toFixed(1);
      const color = pct >= 100 ? 'green' : pct >= 75 ? 'orange' : 'red';
      return <Tag color={color}>{pct}%</Tag>;
    }
  }, [formula, t]);

  const efficiencyTooltip = formula === 'budget'
    ? t('efficiencyBudgetTooltip', { defaultValue: 'Logged ÷ Estimated × 100. Under 100% means under budget; over 100% means over budget.' })
    : t('efficiencyRatioTooltip', { defaultValue: 'Estimated ÷ Logged × 100. Over 100% means the work beat its estimate.' });

  const columns: ColumnsType<IRPTEfficiencyRow> = useMemo(
    () => [
      {
        title: t('nameColumn', { defaultValue: 'Name' }),
        dataIndex: 'group_name',
        key: 'group_name',
        render: (name: string, record) => (
          <Flex align="center" gap={8}>
            {record.color_code && (
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: record.color_code,
                  display: 'inline-block',
                }}
              />
            )}
            <Typography.Text>{name}</Typography.Text>
          </Flex>
        ),
      },
      {
        title: (
          <Space size={4}>
            {t('estimatedColumn', { defaultValue: 'Estimated' })}
            <Tooltip title={t('estimatedTooltip', { defaultValue: 'Sum of time estimates on tasks that had at least one time log in the selected period.' })}>
              <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
            </Tooltip>
          </Space>
        ),
        key: 'estimated_seconds',
        width: 160,
        sorter: (a, b) => a.estimated_seconds - b.estimated_seconds,
        render: (_, record) => fmtSeconds(record.estimated_seconds),
      },
      {
        title: (
          <Space size={4}>
            {t('loggedColumn', { defaultValue: 'Logged' })}
            <Tooltip title={t('loggedTooltip', { defaultValue: 'Total time logged via time tracking in the selected period.' })}>
              <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
            </Tooltip>
          </Space>
        ),
        key: 'logged_seconds',
        width: 160,
        sorter: (a, b) => a.logged_seconds - b.logged_seconds,
        render: (_, record) => fmtSeconds(record.logged_seconds),
      },
      {
        title: (
          <Space size={4}>
            {t('efficiencyColumn', { defaultValue: 'Efficiency' })}
            <Tooltip title={efficiencyTooltip}>
              <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
            </Tooltip>
          </Space>
        ),
        key: 'efficiency',
        width: 140,
        sorter: (a, b) => {
          const ratio = (row: IRPTEfficiencyRow) =>
            formula === 'budget'
              ? (row.estimated_seconds > 0 ? row.logged_seconds / row.estimated_seconds : 0)
              : (row.logged_seconds > 0 ? row.estimated_seconds / row.logged_seconds : 0);
          return ratio(a) - ratio(b);
        },
        render: (_, record) => renderEff(record.estimated_seconds, record.logged_seconds),
      },
    ],
    [t, fmtSeconds, renderEff, efficiencyTooltip, formula]
  );

  const levelOptions = [
    { label: t('levelMember', { defaultValue: 'Member' }), value: 'member' },
    { label: t('levelTeam', { defaultValue: 'Team' }), value: 'team' },
    { label: t('levelProject', { defaultValue: 'Project' }), value: 'project' },
    { label: t('levelCompany', { defaultValue: 'Company' }), value: 'company' },
  ];

  const unitOptions = [
    {
      label: (
        <Tooltip title={t('unitHoursTooltip', { defaultValue: 'Show estimated and logged time as hours and minutes.' })}>
          {t('unitHours', { defaultValue: 'h/min' })}
        </Tooltip>
      ),
      value: 'hours',
    },
    {
      label: (
        <Tooltip title={t('unitManDaysTooltip', { defaultValue: 'Show estimated and logged time as working days (8 h = 1 day).' })}>
          {t('unitManDays', { defaultValue: 'Man Days' })}
        </Tooltip>
      ),
      value: 'mandays',
    },
  ];

  const formulaOptions = [
    {
      label: (
        <Tooltip title={t('formulaBudgetTooltip', { defaultValue: 'Logged ÷ Estimated × 100. Under 100% means under budget; over 100% means over budget.' })}>
          {t('formulaBudget', { defaultValue: 'Budget %' })}
        </Tooltip>
      ),
      value: 'budget',
    },
    {
      label: (
        <Tooltip title={t('formulaEfficiencyTooltip', { defaultValue: 'Estimated ÷ Logged × 100. Over 100% means the work beat its estimate.' })}>
          {t('formulaEfficiency', { defaultValue: 'Efficiency %' })}
        </Tooltip>
      ),
      value: 'efficiency',
    },
  ];

  return (
    <Flex vertical gap={16}>
      <CustomPageHeader
        title={t('title', { defaultValue: 'Efficiency' })}
        children={
          <Button loading={exporting} onClick={handleExport} disabled={!rows.length}>
            {t('export', { defaultValue: 'Export' })}
          </Button>
        }
      />

      <Card style={{ borderRadius: 4 }}>
        <Flex gap={8} wrap="wrap" align="center" className="reporting-filter-bar" style={{ marginBottom: 16 }}>
          <Segmented
            options={levelOptions}
            value={level}
            onChange={value => setLevel(value as IRPTEfficiencyLevel)}
          />

          <ReportingTeamsFilter
            teams={teams}
            selectedTeams={selectedTeams}
            loading={loadingTeams}
            disabled={isCompany}
            onChange={setSelectedTeams}
          />

          <ReportingProjectsFilter
            projects={projects.filter((project): project is ISelectableProject & { id: string; name: string } => Boolean(project.id && project.name))}
            selectedProjects={selectedProjects}
            loading={loadingProjects}
            disabled={isCompany}
            onChange={setSelectedProjects}
          />

          <ReportingDateRangeFilter
            value={datePreset}
            onChange={(key, range) => { setDatePreset(key); setDateRange(range); }}
          />

          <Segmented
            options={unitOptions}
            value={displayUnit}
            onChange={value => setDisplayUnit(value as 'hours' | 'mandays')}
          />

          <Segmented
            options={formulaOptions}
            value={formula}
            onChange={value => setFormula(value as 'budget' | 'efficiency')}
          />
        </Flex>

        <Spin spinning={loading}>
          {rows.length ? (
            <Table
              rowKey={record => record.group_id ?? record.group_name}
              columns={columns}
              dataSource={rows}
              pagination={{ pageSize: 20, hideOnSinglePage: true }}
              size="middle"
            />
          ) : (
            <Empty
              description={
                fetchState === 'idle'
                  ? t('emptyInitial', { defaultValue: 'Loading data…' })
                  : userFiltered
                  ? t('emptyFiltered', { defaultValue: 'No data found. Try adjusting the filters or selecting a different date range.' })
                  : t('emptyNoData', { defaultValue: 'No data found for the selected period.' })
              }
            />
          )}
        </Spin>
      </Card>
    </Flex>
  );
};

export default EfficiencyReports;
