import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Flex, Select, Table, Typography, Input, Dropdown, Space, Checkbox } from '@/shared/antd-imports';
import { DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useAppSelector } from '@/hooks/useAppSelector';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';

interface LogRow {
  key: string;
  date: string;
  member: string;
  project: string;
  task: string;
  description?: string;
  duration: string;
}

const TimeLogsPage: React.FC = () => {
  const { t } = useTranslation('time-report');

  // Global context
  const team = useAppSelector(state => (state as any).auth?.team);
  const reporting = useAppSelector(state => state.reportingReducer);

  // Local state
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [search, setSearch] = useState<string>('');
  const [billableFilter, setBillableFilter] = useState<{ billable: boolean; nonBillable: boolean}>({ billable: true, nonBillable: true });

  // Columns
  const columns = useMemo(
    () => [
      {
        title: t('Date'),
        dataIndex: 'date',
        key: 'date',
        width: 160,
        render: (value: string) => dayjs(value).format('MMM DD, YYYY'),
      },
      { title: t('Member'), dataIndex: 'member', key: 'member', width: 200 },
      { title: t('Project'), dataIndex: 'project', key: 'project', width: 220 },
      { title: t('Task'), dataIndex: 'task', key: 'task', width: 260 },
      { title: t('Description'), dataIndex: 'description', key: 'description' },
      {
        title: t('Duration'),
        dataIndex: 'duration',
        key: 'duration',
        width: 140,
        align: 'right' as const,
      },
    ],
    [t]
  );

  // Fetch members for filter (admin/owner friendly)
  useEffect(() => {
    (async () => {
      try {
        const res = await teamMembersApiService.getAll();
        if (res.done && Array.isArray(res.body)) {
          const mapped = res.body.map(m => ({ id: m.id as string, name: m.name as string }));
          setMembers(mapped);
        }
      } catch {
        // noop
      }
    })();
  }, []);

  // Fetch logs
  const fetchLogs = async () => {
    const dr = reporting.dateRange;
    if (!dr || dr.length !== 2) return;
    setLoading(true);
    try {
      const startDate = dayjs(dr[0]).format('YYYY-MM-DD');
      const endDate = dayjs(dr[1]).format('YYYY-MM-DD');

      // If a member is selected, fetch member-specific; otherwise fetch flat logs
      if (selectedMemberId) {
        // Use the same flat endpoint with member filter for consistency with the no-member case
        const body = {
          team_member_id: selectedMemberId,
          team_id: team?.id || null,
          duration: null,
          date_range: [startDate, endDate],
          billable: billableFilter,
          archived: false,
          search: search || undefined,
        } as any;
        const res = await reportingApiService.getTimelogsFlat(body);
        if (res.done && Array.isArray(res.body)) {
          const rows: LogRow[] = res.body.flatMap(group =>
            group.logs.map((l: any, idx: number) => ({
              key: `${group.log_day}-${idx}`,
              date: group.log_day,
              member: (l as any).user_name,
              project: l.project_name,
              task: l.task_name,
              description: undefined,
              duration: l.time_spent_string,
            }))
          );
          setLogs(rows);
        } else {
          setLogs([]);
        }
      } else {
        const body = {
          team_member_id: null,
          team_id: team?.id || null,
          duration: null,
          date_range: [startDate, endDate],
          billable: billableFilter,
          archived: false,
          search: search || undefined,
        } as any;
        const res = await reportingApiService.getTimelogsFlat(body);
        if (res.done && Array.isArray(res.body)) {
          const rows: LogRow[] = res.body.flatMap(group =>
            group.logs.map((l: any, idx: number) => ({
              key: `${group.log_day}-${idx}`,
              date: group.log_day,
              member: (l as any).user_name,
              project: l.project_name,
              task: l.task_name,
              description: undefined,
              duration: l.time_spent_string,
            }))
          );
          setLogs(rows);
        } else {
          setLogs([]);
        }
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMemberId, reporting.dateRange?.[0], reporting.dateRange?.[1], billableFilter.billable, billableFilter.nonBillable, search]);

  const onExport = () => {
    if (!selectedMemberId || !reporting.dateRange || reporting.dateRange.length !== 2) return;
    const startDate = dayjs(reporting.dateRange[0]).format('YYYY-MM-DD');
    const endDate = dayjs(reporting.dateRange[1]).format('YYYY-MM-DD');

    reportingExportApiService.exportMemberTimeLogs({
      team_member_id: selectedMemberId,
      team_id: team?.id || null,
      duration: null,
      date_range: [startDate, endDate],
      member_name: members.find(m => m.id === selectedMemberId)?.name,
      team_name: team?.name,
      billable: billableFilter,
      archived: false,
    } as any);
  };

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter(l =>
      l.project.toLowerCase().includes(term) ||
      l.task.toLowerCase().includes(term) ||
      (l.description || '').toLowerCase().includes(term) ||
      l.member.toLowerCase().includes(term)
    );
  }, [logs, search]);

  const exportMenu = {
    items: [
      { key: 'excel', label: t('Export Excel') },
    ],
    onClick: ({ key }: any) => {
      if (key === 'excel') onExport();
    },
  } as any;

  const secondaryFiltersMenu = {
    items: [
      {
        key: 'filters',
        label: (
          <Space size={12}>
            <Checkbox
              checked={billableFilter.billable}
              onChange={e => setBillableFilter(prev => ({ ...prev, billable: e.target.checked }))}
            >
              {t('Billable')}
            </Checkbox>
            <Checkbox
              checked={billableFilter.nonBillable}
              onChange={e => setBillableFilter(prev => ({ ...prev, nonBillable: e.target.checked }))}
            >
              {t('Non-billable')}
            </Checkbox>
          </Space>
        ),
      },
    ],
  } as any;

  return (
    <Flex vertical>
      <CustomPageHeader
        title={t('Time Logs')}
        children={
          <Space>
            <TimeWiseFilter />
            <Select
              placeholder={t('Select member')}
              style={{ width: 220 }}
              allowClear
              value={selectedMemberId}
              onChange={setSelectedMemberId}
              options={members.map(m => ({ label: m.name, value: m.id }))}
            />
            <Input.Search
              placeholder={t('Search logs')}
              allowClear
              style={{ width: 220 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Dropdown menu={secondaryFiltersMenu} trigger={["click"]}>
              <Button>{t('Filters')}</Button>
            </Dropdown>
            <Button onClick={fetchLogs}>{t('Refresh')}</Button>
            <Dropdown menu={exportMenu} disabled={!selectedMemberId}>
              <Button type="primary" icon={<DownOutlined />} iconPosition="end">
                {t('Export')}
              </Button>
            </Dropdown>
          </Space>
        }
      />

      <Card style={{ borderRadius: '4px' }} styles={{ body: { padding: 0 } }}>
        <Table
          size="small"
          loading={loading}
          dataSource={filteredLogs}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </Flex>
  );
};

export default TimeLogsPage;


