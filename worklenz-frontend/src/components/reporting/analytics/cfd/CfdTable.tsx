import React, { useMemo } from 'react';
import { Table } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
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
        width: 100,
      },
    ];
    orderedVisible.forEach(statusId => {
      const status = statusById.get(statusId);
      cols.push({
        title: status?.name ?? statusId,
        dataIndex: statusId,
        key: statusId,
        align: 'right',
        width: 100,
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

  return (
    <Table
      size="small"
      pagination={{ pageSize: 15, showSizeChanger: true }}
      columns={columns}
      dataSource={rows}
      scroll={{ x: Math.max(400, orderedVisible.length * 100 + 140) }}
      locale={{
        emptyText: t('cfdChartEmpty', {
          defaultValue: 'No cumulative flow data for these filters.',
        }),
      }}
    />
  );
};
