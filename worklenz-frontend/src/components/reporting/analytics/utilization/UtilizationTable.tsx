import React, { useMemo } from 'react';
import { Avatar, Flex, Progress, Table, Tag, Typography } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import type {
  UtilizationMemberRow,
  UtilizationStatus,
} from '@/types/reporting/analytics-utilization.types';

const { Text } = Typography;

interface UtilizationTableProps {
  members: UtilizationMemberRow[];
  loading?: boolean;
}

const statusColor = (status: UtilizationStatus): string => {
  if (status === 'over') return 'error';
  if (status === 'optimal') return 'success';
  return 'warning';
};

const utilizationStroke = (pct: number): string => {
  if (pct > 100) return '#ff4d4f';
  if (pct > 80) return '#52c41a';
  return '#faad14';
};

const fmtHours = (value: number): string => `${Number(value.toFixed(1))}h`;

export const UtilizationTable: React.FC<UtilizationTableProps> = ({ members, loading }) => {
  const { t } = useTranslation('reporting-analytics');

  const columns: ColumnsType<UtilizationMemberRow> = useMemo(
    () => [
      {
        title: t('utilColMember', { defaultValue: 'Team Member' }),
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
        title: t('utilColRole', { defaultValue: 'Role' }),
        dataIndex: 'role_name',
        key: 'role_name',
        width: 140,
        render: (value: string | null) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {value || t('utilEmptyValue', { defaultValue: '—' })}
          </Text>
        ),
      },
      {
        title: t('utilColCapacity', { defaultValue: 'Capacity' }),
        dataIndex: 'capacity_hours',
        key: 'capacity_hours',
        width: 110,
        align: 'right',
        sorter: (a, b) => a.capacity_hours - b.capacity_hours,
        render: (value: number) => fmtHours(value),
      },
      {
        title: t('utilColLogged', { defaultValue: 'Logged' }),
        dataIndex: 'logged_hours',
        key: 'logged_hours',
        width: 110,
        align: 'right',
        sorter: (a, b) => a.logged_hours - b.logged_hours,
        render: (value: number) => <Text strong>{fmtHours(value)}</Text>,
      },
      {
        title: t('utilColUtilization', { defaultValue: 'Utilization' }),
        dataIndex: 'utilization_pct',
        key: 'utilization_pct',
        width: 200,
        sorter: (a, b) => a.utilization_pct - b.utilization_pct,
        render: (pct: number) => (
          <Flex align="center" gap={8}>
            <Progress
              percent={Math.min(pct, 100)}
              showInfo={false}
              strokeColor={utilizationStroke(pct)}
              size="small"
              style={{ flex: 1, margin: 0 }}
            />
            <Text style={{ fontSize: 12, minWidth: 36, color: utilizationStroke(pct) }}>
              {pct}%
            </Text>
          </Flex>
        ),
      },
      {
        title: t('utilColStatus', { defaultValue: 'Status' }),
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: UtilizationStatus) => (
          <Tag color={statusColor(status)}>
            {t(`utilStatus.${status}`, {
              defaultValue:
                status === 'over' ? 'Overutilized' : status === 'optimal' ? 'Optimal' : 'Underutilized',
            })}
          </Tag>
        ),
      },
    ],
    [t]
  );

  return (
    <Table<UtilizationMemberRow>
      rowKey="team_member_id"
      columns={columns}
      dataSource={members}
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      scroll={{ x: 800 }}
      size="middle"
    />
  );
};
