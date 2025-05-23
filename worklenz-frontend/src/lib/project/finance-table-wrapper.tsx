import React from 'react';
import { Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { financeTableColumns } from './project-view-finance-table-columns';

interface IFinanceTableData {
  id: string;
  name: string;
  estimated_hours: number;
  estimated_cost: number;
  fixed_cost: number;
  total_budgeted_cost: number;
  total_actual_cost: number;
  variance: number;
  total_time_logged: number;
  assignees: Array<{
    team_member_id: string;
    project_member_id: string;
    name: string;
    avatar_url: string;
  }>;
}

interface FinanceTableWrapperProps {
  data: IFinanceTableData[];
  loading?: boolean;
}

const FinanceTableWrapper: React.FC<FinanceTableWrapperProps> = ({ data, loading }) => {
  const { t } = useTranslation();

  const columns = financeTableColumns.map(col => ({
    ...col,
    title: t(`projectViewFinance.${col.name}`),
    dataIndex: col.key,
    key: col.key,
    width: col.width,
    render: col.render || ((value: any) => {
      if (col.type === 'hours') {
        return value ? value.toFixed(2) : '0.00';
      }
      if (col.type === 'currency') {
        return value ? `$${value.toFixed(2)}` : '$0.00';
      }
      return value;
    })
  }));

  return (
    <Table
      dataSource={data}
      columns={columns}
      loading={loading}
      pagination={false}
      rowKey="id"
      scroll={{ x: 'max-content' }}
    />
  );
};

export default FinanceTableWrapper; 