import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchTask,
  setSelectedTaskId,
  setShowTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import {
  financeOverviewApiService,
  IFinanceBillableEntry,
} from '@/api/finance-overview/finance-overview.api.service';
import { FinanceKpiCard } from './FinanceKpiCard';
import { fmtHours, fmtMoney, getRangeDates } from './finance-report-utils';
import { useFinanceReportFetch } from './useFinanceReportFetch';

const { Text, Title } = Typography;

type RangePreset = 'week' | 'month' | 'lastMonth';

export const FinanceBillableTimePage = () => {
  const { t } = useTranslation('finance-reports');
  const dispatch = useAppDispatch();
  useDocumentTitle(t('billableTime.pageTitle', { defaultValue: 'Billable Time' }));

  const [preset, setPreset] = useState<RangePreset>('week');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, loading, error, refetch } = useFinanceReportFetch(() => {
    const range = getRangeDates(preset);
    return financeOverviewApiService.getBillableTime({
      page,
      page_size: pageSize,
      start: range.start,
      end: range.end,
    });
  }, [page, pageSize, preset]);

  const entries: IFinanceBillableEntry[] = data?.entries ?? [];
  const total = data?.total ?? 0;
  const summary = data?.summary ?? {
    logged_hours: 0,
    billable_hours: 0,
    non_billable_hours: 0,
    billable_value: 0,
  };

  const handleTaskClick = useCallback(
    (taskId: string, projectId: string) => {
      dispatch(setProjectId(projectId || ''));
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTask({ taskId, projectId }));
    },
    [dispatch]
  );

  const columns: ColumnsType<IFinanceBillableEntry> = useMemo(
    () => [
      {
        title: t('billableTime.table.member', { defaultValue: 'Member' }),
        dataIndex: 'member_name',
        key: 'member_name',
        render: (name: string, record) => (
          <Flex align="center" gap={8}>
            <Avatar src={record.avatar_url || undefined} size={24} style={{ backgroundColor: record.color_code }}>
              {name?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Text>{name}</Text>
          </Flex>
        ),
      },
      {
        title: t('billableTime.table.project', { defaultValue: 'Project' }),
        dataIndex: 'project_name',
        key: 'project_name',
        render: (value: string, record) => (
          <Flex align="center" gap={6}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: record.project_color,
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            <Tooltip title={value}>
              <Text ellipsis style={{ maxWidth: 160 }}>
                {value}
              </Text>
            </Tooltip>
          </Flex>
        ),
      },
      {
        title: t('billableTime.table.task', { defaultValue: 'Task' }),
        dataIndex: 'task_name',
        key: 'task_name',
        render: (value: string, record) => (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => handleTaskClick(record.task_id, record.project_id)}
          >
            <Tooltip title={value}>
              <Text ellipsis style={{ maxWidth: 180 }}>
                {value}
              </Text>
            </Tooltip>
          </Button>
        ),
      },
      {
        title: t('billableTime.table.date', { defaultValue: 'Date' }),
        dataIndex: 'logged_at',
        key: 'logged_at',
        render: (value: string) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(value).format('MMM D, YYYY')}
          </Text>
        ),
      },
      {
        title: t('billableTime.table.time', { defaultValue: 'Time' }),
        dataIndex: 'hours',
        key: 'hours',
        render: (value: number) => <Tag color="blue">{fmtHours(value)}</Tag>,
      },
      {
        title: t('billableTime.table.billable', { defaultValue: 'Billable' }),
        dataIndex: 'billable',
        key: 'billable',
        render: (billable: boolean) => (
          <Tag color={billable ? 'success' : 'default'}>
            {billable
              ? t('billableTime.billable', { defaultValue: 'Billable' })
              : t('billableTime.internal', { defaultValue: 'Internal' })}
          </Tag>
        ),
      },
      {
        title: t('billableTime.table.rate', { defaultValue: 'Rate' }),
        dataIndex: 'rate',
        key: 'rate',
        render: (value: number, record) => (
          <Text style={{ fontSize: 12 }}>{fmtMoney(value, record.currency)}/hr</Text>
        ),
      },
      {
        title: t('billableTime.table.value', { defaultValue: 'Value' }),
        dataIndex: 'value',
        key: 'value',
        render: (value: number, record) => (
          <Text strong style={{ color: '#52c41a' }}>
            {fmtMoney(value, record.currency)}
          </Text>
        ),
      },
    ],
    [handleTaskClick, t]
  );

  const handleRangeChange = (value: RangePreset) => {
    setPreset(value);
    setPage(1);
  };

  return (
    <Flex vertical gap={16}>
      <Flex align="flex-start" justify="space-between" gap={12} wrap="wrap">
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {t('billableTime.pageTitle', { defaultValue: 'Billable Time' })}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, marginTop: 2, display: 'block' }}>
            {t('billableTime.pageSubTitle', {
              defaultValue: 'Logged hours, billable flag, and rate-card value across the team.',
            })}
          </Text>
        </div>
        <Select<RangePreset>
          value={preset}
          onChange={handleRangeChange}
          aria-label={t('billableTime.range.week', { defaultValue: 'This week' })}
          options={[
            { value: 'week', label: t('billableTime.range.week', { defaultValue: 'This week' }) },
            { value: 'month', label: t('billableTime.range.month', { defaultValue: 'This month' }) },
            {
              value: 'lastMonth',
              label: t('billableTime.range.lastMonth', { defaultValue: 'Last month' }),
            },
          ]}
          style={{ minWidth: 140 }}
        />
      </Flex>

      {error && (
        <Alert
          type="error"
          showIcon
          message={t('loadError', { defaultValue: 'Could not load this report. Try again.' })}
          action={
            <Button size="small" onClick={refetch}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      )}

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <FinanceKpiCard
            title={t('billableTime.kpi.logged', { defaultValue: 'Logged this period' })}
            value={fmtHours(summary.logged_hours)}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <FinanceKpiCard
            title={t('billableTime.kpi.billable', { defaultValue: 'Billable' })}
            value={fmtHours(summary.billable_hours)}
            valueColor="#52c41a"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <FinanceKpiCard
            title={t('billableTime.kpi.nonBillable', { defaultValue: 'Non-billable' })}
            value={fmtHours(summary.non_billable_hours)}
            valueColor="#faad14"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <FinanceKpiCard
            title={t('billableTime.kpi.value', { defaultValue: 'Billable value' })}
            value={fmtMoney(summary.billable_value)}
            valueColor="#1677ff"
            loading={loading}
          />
        </Col>
      </Row>

      <Card
        title={t('billableTime.tableTitle', { defaultValue: 'Time Entries' })}
        styles={{ body: { padding: 0 } }}
      >
        <Table<IFinanceBillableEntry>
          rowKey="id"
          columns={columns}
          dataSource={entries}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [5, 10, 20, 50],
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
          locale={{
            emptyText: (
              <Empty
                description={t('billableTime.empty', {
                  defaultValue: 'No time logged in this period.',
                })}
              />
            ),
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </Flex>
  );
};

export default FinanceBillableTimePage;
