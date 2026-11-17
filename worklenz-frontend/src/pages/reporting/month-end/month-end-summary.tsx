import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Flex,
  InfoCircleOutlined,
  Row,
  Space,
  Spin,
  Statistic,
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
} from '@/components/reporting/common';
import '@/components/reporting/common/reporting-filter-bar.css';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import {
  IRPTMonthEndBreakdownRow,
  IRPTMonthEndSummary,
  IRPTTeam,
} from '@/types/reporting/reporting.types';
import { ISelectableProject } from '@/types/reporting/reporting-filters.types';

const MonthEndSummary = () => {
  const { t } = useTranslation('reporting-month-end');
  useDocumentTitle('Reporting - Month-End Summary');

  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [teams, setTeams] = useState<IRPTTeam[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [projects, setProjects] = useState<ISelectableProject[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [summary, setSummary] = useState<IRPTMonthEndSummary | null>(null);
  const [fetchState, setFetchState] = useState<'idle' | 'empty' | 'loaded'>('idle');
  const [userFiltered, setUserFiltered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  // getAllocationProjects requires categories (or noCategory) to be specified, so we pull
  // every category for the teams and combine with noCategory to get the full project set.
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

  const buildBody = useCallback(
    () => ({
      month: month.format('YYYY-MM'),
      teams: selectedTeams,
      projects: selectedProjects,
      archived: true,
    }),
    [month, selectedTeams, selectedProjects]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportingApiService.getMonthEndSummary(buildBody());
      if (res.done) {
        setSummary(res.body);
        setFetchState(res.body ? 'loaded' : 'empty');
      }
    } catch {
      message.error(t('fetchError', { defaultValue: 'Failed to load month-end summary' }));
    } finally {
      setLoading(false);
    }
  }, [buildBody, t]);

  useEffect(() => {
    if (!initialLoaded) return;
    if (selectedTeams.length > 0) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoaded, month, selectedTeams, selectedProjects]);

  useEffect(() => {
    if (initialLoaded) setUserFiltered(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, selectedTeams, selectedProjects]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await reportingApiService.exportMonthEndSummary(buildBody());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Month_End_Summary_${month.format('YYYY-MM')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error(t('exportError', { defaultValue: 'Export failed' }));
    } finally {
      setExporting(false);
    }
  }, [buildBody, month, t]);

  const renderEfficiency = (value: number | null) => {
    if (value === null) return <Tag>{t('noData', { defaultValue: 'No estimate' })}</Tag>;
    const color = value <= 100 ? 'green' : value <= 120 ? 'orange' : 'red';
    return <Tag color={color}>{value}%</Tag>;
  };

  const hoursPerDay = summary?.hours_per_day || 8;

  const fmtManDays = (seconds: number) =>
    (seconds / (hoursPerDay * 3600)).toFixed(1);

  const breakdownColumns = (nameTitle: string): ColumnsType<IRPTMonthEndBreakdownRow> => [
    {
      title: nameTitle,
      dataIndex: 'name',
      key: 'name',
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
      title: t('tasksCompletedColumn', { defaultValue: 'Tasks Completed' }),
      dataIndex: 'tasks_completed',
      key: 'tasks_completed',
      width: 130,
      sorter: (a, b) => a.tasks_completed - b.tasks_completed,
    },
    {
      title: (
        <Space size={4}>
          {t('budgetManDaysColumn', { defaultValue: 'Budget (days)' })}
          <Tooltip title={t('budgetManDaysColumnTooltip', { defaultValue: 'Estimated time converted to working days.' })}>
            <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      key: 'budget_man_days',
      width: 130,
      sorter: (a, b) => a.estimated_seconds - b.estimated_seconds,
      render: (_, record) => fmtManDays(record.estimated_seconds),
    },
    {
      title: (
        <Space size={4}>
          {t('actualManDaysColumn', { defaultValue: 'Actual (days)' })}
          <Tooltip title={t('actualManDaysColumnTooltip', { defaultValue: 'Logged time converted to working days.' })}>
            <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      key: 'actual_man_days',
      width: 130,
      sorter: (a, b) => a.logged_seconds - b.logged_seconds,
      render: (_, record) => fmtManDays(record.logged_seconds),
    },
    {
      title: (
        <Space size={4}>
          {t('varianceManDaysColumn', { defaultValue: 'Variance (days)' })}
          <Tooltip title={t('varianceManDaysColumnTooltip', { defaultValue: 'Budget minus Actual. Positive means under budget; negative means over budget.' })}>
            <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      key: 'variance_man_days',
      width: 130,
      sorter: (a, b) =>
        (a.estimated_seconds - a.logged_seconds) - (b.estimated_seconds - b.logged_seconds),
      render: (_, record) => {
        const variance = +fmtManDays(record.estimated_seconds - record.logged_seconds);
        return (
          <Typography.Text style={{ color: variance >= 0 ? '#3f8600' : '#cf1322' }}>
            {variance >= 0 ? '+' : ''}{variance}
          </Typography.Text>
        );
      },
    },
    {
      title: (
        <Space size={4}>
          {t('efficiencyColumn', { defaultValue: 'Efficiency' })}
          <Tooltip title={t('efficiencyColumnTooltip', { defaultValue: 'Logged ÷ Estimated × 100. Under 100% means under budget; over 100% means over budget.' })}>
            <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'efficiency_percent',
      key: 'efficiency_percent',
      width: 120,
      sorter: (a, b) => (a.efficiency_percent ?? -1) - (b.efficiency_percent ?? -1),
      render: renderEfficiency,
    },
  ];

  const memberColumns = useMemo(
    () => breakdownColumns(t('memberColumn', { defaultValue: 'Member' })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, summary?.hours_per_day]
  );
  const projectColumns = useMemo(
    () => breakdownColumns(t('projectColumn', { defaultValue: 'Project' })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, summary?.hours_per_day]
  );

  return (
    <Flex vertical gap={16}>
      <CustomPageHeader
        title={t('title', { defaultValue: 'Month-End Summary' })}
        children={
          <Button loading={exporting} onClick={handleExport} disabled={!summary}>
            {t('export', { defaultValue: 'Export' })}
          </Button>
        }
      />

      <Card style={{ borderRadius: 4 }}>
        <Flex gap={8} wrap="wrap" align="center" className="reporting-filter-bar" style={{ marginBottom: 16 }}>
          <DatePicker
            picker="month"
            value={month}
            allowClear={false}
            onChange={value => value && setMonth(value)}
          />
          <ReportingTeamsFilter
            teams={teams}
            selectedTeams={selectedTeams}
            loading={loadingTeams}
            onChange={setSelectedTeams}
          />
          <ReportingProjectsFilter
            projects={projects.filter((project): project is ISelectableProject & { id: string; name: string } => Boolean(project.id && project.name))}
            selectedProjects={selectedProjects}
            loading={loadingProjects}
            onChange={setSelectedProjects}
          />
        </Flex>

        <Spin spinning={loading}>
          {summary ? (
            <Flex vertical gap={24}>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8} md={6}>
                  <Statistic
                    title={
                      <Space size={4}>
                        {t('loggedHours', { defaultValue: 'Logged Hours' })}
                        <Tooltip title={t('loggedHoursTooltip', { defaultValue: 'Total hours logged via time tracking during this month.' })}>
                          <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                        </Tooltip>
                      </Space>
                    }
                    value={summary.logged_hours}
                    suffix="h"
                  />
                </Col>
                <Col xs={12} sm={8} md={6}>
                  <Statistic
                    title={
                      <Space size={4}>
                        {t('tasksCompleted', { defaultValue: 'Tasks Completed' })}
                        <Tooltip title={t('tasksCompletedTooltip', { defaultValue: 'Number of tasks marked as done during this month.' })}>
                          <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                        </Tooltip>
                      </Space>
                    }
                    value={summary.tasks_completed}
                  />
                </Col>
                <Col xs={12} sm={8} md={6}>
                  <Statistic
                    title={
                      <Space size={4}>
                        {t('budgetManDays', { defaultValue: 'Budget (man days)' })}
                        <Tooltip title={t('budgetManDaysTooltip', { defaultValue: 'Total estimated time on completed tasks, converted to working days (estimated hours ÷ hours per working day).' })}>
                          <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                        </Tooltip>
                      </Space>
                    }
                    value={summary.budget_man_days}
                  />
                </Col>
                <Col xs={12} sm={8} md={6}>
                  <Statistic
                    title={
                      <Space size={4}>
                        {t('actualManDays', { defaultValue: 'Actual (man days)' })}
                        <Tooltip title={t('actualManDaysTooltip', { defaultValue: 'Total logged time converted to working days (logged hours ÷ hours per working day).' })}>
                          <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                        </Tooltip>
                      </Space>
                    }
                    value={summary.actual_man_days}
                  />
                </Col>
                <Col xs={12} sm={8} md={6}>
                  <Statistic
                    title={
                      <Space size={4}>
                        {t('varianceManDays', { defaultValue: 'Variance (man days)' })}
                        <Tooltip title={t('varianceManDaysTooltip', { defaultValue: 'Budget minus Actual. Positive means under budget; negative means over budget.' })}>
                          <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                        </Tooltip>
                      </Space>
                    }
                    value={summary.variance_man_days}
                    valueStyle={{ color: summary.variance_man_days >= 0 ? '#3f8600' : '#cf1322' }}
                  />
                </Col>
                <Col xs={12} sm={8} md={6}>
                  <Statistic
                    title={
                      <Space size={4}>
                        {t('efficiency', { defaultValue: 'Efficiency' })}
                        <Tooltip title={t('efficiencyTooltip', { defaultValue: 'Logged ÷ Estimated × 100. Under 100% means under budget; over 100% means over budget.' })}>
                          <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                        </Tooltip>
                      </Space>
                    }
                    value={summary.efficiency_percent ?? '-'}
                    suffix={summary.efficiency_percent === null ? '' : '%'}
                  />
                </Col>
              </Row>

              <div>
                <Typography.Title level={5}>
                  {t('memberBreakdown', { defaultValue: 'Member Breakdown' })}
                </Typography.Title>
                <Table
                  rowKey={record => record.id ?? record.name}
                  columns={memberColumns}
                  dataSource={summary.members}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  size="small"
                  locale={{ emptyText: t('noMembers', { defaultValue: 'No completed tasks' }) }}
                />
              </div>

              <div>
                <Typography.Title level={5}>
                  {t('projectBreakdown', { defaultValue: 'Project Breakdown' })}
                </Typography.Title>
                <Table
                  rowKey={record => record.id ?? record.name}
                  columns={projectColumns}
                  dataSource={summary.projects}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  size="small"
                  locale={{ emptyText: t('noProjects', { defaultValue: 'No completed tasks' }) }}
                />
              </div>
            </Flex>
          ) : (
            <Empty
              description={
                fetchState === 'idle'
                  ? t('emptyInitial', { defaultValue: 'Loading data…' })
                  : userFiltered
                  ? t('emptyFiltered', { defaultValue: 'No data found for this period. Try selecting a different month or adjusting the filters.' })
                  : t('emptyNoData', { defaultValue: 'No data found for the selected period.' })
              }
            />
          )}
        </Spin>
      </Card>
    </Flex>
  );
};

export default MonthEndSummary;
