import React, { useMemo } from 'react';
import { Table, Tooltip, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { getClientTablePagination } from '@/lib/reporting/analytics-table-pagination';
import type { CfdSeriesResponse, CfdStatusMeta } from '@/types/reporting/analytics-cfd.types';

interface CfdTableProps {
  data: CfdSeriesResponse;
  visibleStatusIds: string[];
  statusOrder: string[];
}

interface RowRecord {
  key: string;
  date: string;
  [statusId: string]: string | number;
}

export const CfdTable: React.FC<CfdTableProps> = ({ data, visibleStatusIds, statusOrder }) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();

  const statusById = useMemo(() => {
    const map = new Map<string, CfdStatusMeta>();
    data.statuses.forEach(s => map.set(s.id, s));
    return map;
  }, [data.statuses]);

  const orderedVisible = useMemo(() => {
    const visible = new Set(visibleStatusIds);
    return statusOrder.filter(id => visible.has(id) && statusById.has(id));
  }, [statusOrder, visibleStatusIds, statusById]);

  const columns: ColumnsType<RowRecord> = useMemo(() => {
    const cols: ColumnsType<RowRecord> = [
      {
        title: t('cfdColWeek', { defaultValue: 'Week' }),
        dataIndex: 'date',
        key: 'date',
        fixed: 'left',
        width: 50,
      },
    ];
    orderedVisible.forEach(statusId => {
      const status = statusById.get(statusId);
      const statusName = status?.name ?? statusId;

      cols.push({
        title: (
          <Tooltip title={statusName} trigger={['hover', 'focus']}>
            <span
              tabIndex={0}
              style={{
                display: 'block',
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {statusName}
            </span>
          </Tooltip>
        ),
        dataIndex: statusId,
        key: statusId,
        align: 'right',
        width: 80,
      });
    });
    return cols;
  }, [orderedVisible, statusById, t]);

  const rows: RowRecord[] = useMemo(() => {
    const byStatus = new Map<string, number[]>();
    data.series.forEach(row => {
      if (!orderedVisible.includes(row.status_id)) return;
      const existing = byStatus.get(row.status_id) ?? data.dates.map(() => 0);
      row.values.forEach((v, i) => {
        existing[i] += Number(v ?? 0);
      });
      byStatus.set(row.status_id, existing);
    });

    return data.dates.map((date, index) => {
      const record: RowRecord = { key: date, date };
      orderedVisible.forEach(statusId => {
        record[statusId] = byStatus.get(statusId)?.[index] ?? 0;
      });
      return record;
    });
  }, [data.dates, data.series, orderedVisible]);

  const borderedColumns = columns.map((column) => ({
    ...column,
    onCell: () => ({
      style: {
        borderInlineEnd: `1px solid ${token.colorBorder}`,
        borderBottom: `1px solid ${token.colorBorder}`,
      },
    }),
    onHeaderCell: () => ({
      style: {
        borderInlineEnd: `1px solid ${token.colorBorder}`,
        borderBottom: `1px solid ${token.colorBorder}`,
      },
    }),
  }));

  return (
    <Table
      bordered
      size="small"
      tableLayout="fixed"
      pagination={getClientTablePagination(15)}
      columns={borderedColumns}
      dataSource={rows}
      scroll={{ x: Math.max(400, orderedVisible.length * 80 + 50) }}
      locale={{
        emptyText: t('cfdChartEmpty', {
          defaultValue: 'No cumulative flow data for these filters.',
        }),
      }}
    />
  );
};
