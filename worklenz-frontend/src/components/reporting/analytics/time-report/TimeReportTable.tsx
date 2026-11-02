import React, { useMemo } from 'react';
import { Avatar, Flex, Table, Typography } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import type { TimeReportRow } from '@/types/reporting/analytics-time-report.types';

const { Text } = Typography;

interface TimeReportTableProps {
  rows: TimeReportRow[];
  loading?: boolean;
}

const fmtHours = (value: number): string => `${Number(value.toFixed(1))}h`;

export const TimeReportTable: React.FC<TimeReportTableProps> = ({ rows, loading }) => {
  const { t } = useTranslation('reporting-analytics');

  const columns: ColumnsType<TimeReportRow> = useMemo(
    () => [
      {
        title: t('trColMember', { defaultValue: 'Member' }),
        dataIndex: 'member_name',
        key: 'member_name',
        ellipsis: true,
        sorter: (a, b) => a.member_name.localeCompare(b.member_name),
        render: (name: string, record) => (
          <Flex align="center" gap={8}>
            <Avatar
              src={record.avatar_url || undefined}
              size={28}
              style={{ backgroundColor: record.color_code }}
            >
              {name?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Text strong>{name}</Text>
          </Flex>
        ),
      },
      {
        title: t('trColProject', { defaultValue: 'Project' }),
        dataIndex: 'project_name',
        key: 'project_name',
        ellipsis: true,
        sorter: (a, b) => a.project_name.localeCompare(b.project_name),
        render: (name: string, record) => (
          <Flex align="center" gap={8}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: record.project_color || '#1890ff',
                flexShrink: 0,
              }}
            />
            <Text>{name}</Text>
          </Flex>
        ),
      },
      {
        title: t('trColLogged', { defaultValue: 'Logged' }),
        dataIndex: 'logged_hours',
        key: 'logged_hours',
        width: 110,
        align: 'right',
        sorter: (a, b) => a.logged_hours - b.logged_hours,
        render: (value: number) => <Text strong>{fmtHours(value)}</Text>,
      },
      {
        title: t('trColEstimated', { defaultValue: 'Estimated' }),
        dataIndex: 'estimated_hours',
        key: 'estimated_hours',
        width: 120,
        align: 'right',
        sorter: (a, b) => a.estimated_hours - b.estimated_hours,
        render: (value: number) => fmtHours(value),
      },
      {
        title: t('trColBillable', { defaultValue: 'Billable' }),
        dataIndex: 'billable_hours',
        key: 'billable_hours',
        width: 110,
        align: 'right',
        sorter: (a, b) => a.billable_hours - b.billable_hours,
        render: (value: number) => fmtHours(value),
      },
      {
        title: t('trColNonBillable', { defaultValue: 'Non-billable' }),
        dataIndex: 'nonbillable_hours',
        key: 'nonbillable_hours',
        width: 130,
        align: 'right',
        sorter: (a, b) => a.nonbillable_hours - b.nonbillable_hours,
        render: (value: number) => fmtHours(value),
      },
    ],
    [t]
  );

  return (
    <Table<TimeReportRow>
      rowKey={row => `${row.team_member_id}-${row.project_id}`}
      columns={columns}
      dataSource={rows}
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      scroll={{ x: 860 }}
      size="middle"
    />
  );
};
