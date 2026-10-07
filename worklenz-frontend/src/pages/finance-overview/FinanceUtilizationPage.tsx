import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Progress,
  Row,
  Select,
  Table,
  Tag,
  Typography,
} from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import {
  financeOverviewApiService,
  IFinanceUtilizationMember,
} from '@/api/finance-overview/finance-overview.api.service';
import { FinanceKpiCard } from './FinanceKpiCard';
import { alertColor, burnColor, fmtHours, getRangeDates } from './finance-report-utils';
import { useFinanceReportFetch } from './useFinanceReportFetch';

const { Text, Title } = Typography;

type RangePreset = 'week' | 'month' | 'lastMonth';

export const FinanceUtilizationPage = () => {
  const { t } = useTranslation('finance-reports');
  useDocumentTitle(t('utilization.pageTitle', { defaultValue: 'Utilization' }));

  const [preset, setPreset] = useState<RangePreset>('month');

  const { data, loading, error, refetch } = useFinanceReportFetch(() => {
    const range = getRangeDates(preset);
    return financeOverviewApiService.getUtilization({ start: range.start, end: range.end });
  }, [preset]);

  const members: IFinanceUtilizationMember[] = data?.members ?? [];
  const summary = data?.summary ?? {
    team_utilization_pct: 0,
    billable_hours: 0,
    non_billable_hours: 0,
    overallocated_count: 0,
  };

  const columns: ColumnsType<IFinanceUtilizationMember> = useMemo(
    () => [
      {
        title: t('utilization.table.member', { defaultValue: 'Member' }),
        dataIndex: 'member_name',
        key: 'member_name',
        render: (name: string, record) => (
          <Flex align="center" gap={8}>
            <Avatar src={record.avatar_url || undefined} size={28} style={{ backgroundColor: record.color_code }}>
              {name?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Text strong>{name}</Text>
          </Flex>
        ),
      },
      {
        title: t('utilization.table.role', { defaultValue: 'Role' }),
        dataIndex: 'role_name',
        key: 'role_name',
        render: (value: string | null) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {value || t('emptyValue', { defaultValue: '—' })}
          </Text>
        ),
      },
      {
        title: t('utilization.table.billableHours', { defaultValue: 'Billable Hours' }),
        dataIndex: 'billable_hours',
        key: 'billable_hours',
        render: (value: number) => (
          <Text strong style={{ color: '#52c41a' }}>
            {fmtHours(value)}
          </Text>
        ),
      },
      {
        title: t('utilization.table.totalHours', { defaultValue: 'Total Hours' }),
        dataIndex: 'total_hours',
        key: 'total_hours',
        render: (value: number) => fmtHours(value),
      },
      {
        title: t('utilization.table.utilization', { defaultValue: 'Utilization' }),
        dataIndex: 'utilization_pct',
        key: 'utilization_pct',
        width: 200,
        render: (pct: number) => (
          <Flex align="center" gap={8}>
            <Progress
              percent={Math.min(pct, 100)}
              showInfo={false}
              strokeColor={burnColor(pct)}
              size="small"
              style={{ flex: 1, margin: 0 }}
            />
            <Text style={{ fontSize: 12, minWidth: 36 }}>{pct}%</Text>
          </Flex>
        ),
      },
      {
        title: t('utilization.table.status', { defaultValue: 'Status' }),
        dataIndex: 'status',
        key: 'status',
        render: (status: IFinanceUtilizationMember['status']) => (
          <Tag color={alertColor(status)}>
            {t(`utilization.status.${status}`, { defaultValue: status })}
          </Tag>
        ),
      },
    ],
    [t]
  );

  return (
    <Flex vertical gap={16}>
      <Flex align="flex-start" justify="space-between" gap={12} wrap="wrap">
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {t('utilization.pageTitle', { defaultValue: 'Utilization' })}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, marginTop: 2, display: 'block' }}>
            {t('utilization.pageSubTitle', {
              defaultValue: 'Team billable hours against capacity for the selected period.',
            })}
          </Text>
        </div>
        <Select<RangePreset>
          value={preset}
          onChange={setPreset}
          aria-label={t('billableTime.range.month', { defaultValue: 'This month' })}
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
            title={t('utilization.kpi.team', { defaultValue: 'Team utilization' })}
            value={`${summary.team_utilization_pct}%`}
            valueColor="#1677ff"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <FinanceKpiCard
            title={t('utilization.kpi.billable', { defaultValue: 'Billable hours' })}
            value={fmtHours(summary.billable_hours)}
            valueColor="#52c41a"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <FinanceKpiCard
            title={t('utilization.kpi.nonBillable', { defaultValue: 'Non-billable' })}
            value={fmtHours(summary.non_billable_hours)}
            valueColor="#faad14"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <FinanceKpiCard
            title={t('utilization.kpi.overallocated', { defaultValue: 'Overallocated' })}
            value={t('utilization.overallocatedCount', {
              defaultValue: '{{count}} members',
              count: summary.overallocated_count,
            })}
            valueColor="#ff4d4f"
            loading={loading}
          />
        </Col>
      </Row>

      <Card
        title={t('utilization.tableTitle', { defaultValue: 'Utilization by Member' })}
        styles={{ body: { padding: 0 } }}
      >
        <Table<IFinanceUtilizationMember>
          rowKey="team_member_id"
          columns={columns}
          dataSource={members}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
          locale={{
            emptyText: (
              <Empty
                description={t('utilization.empty', { defaultValue: 'No team members to show.' })}
              />
            ),
          }}
          scroll={{ x: 800 }}
        />
      </Card>
    </Flex>
  );
};

export default FinanceUtilizationPage;
