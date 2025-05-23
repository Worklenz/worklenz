import React from 'react';
import FinanceTableWrapper from './finance-table/finance-table-wrapper';
import { IProjectFinanceGroup } from '@/types/project/project-finance.types';

interface FinanceTabProps {
  groupType: 'status' | 'priority' | 'phases';
  taskGroups: IProjectFinanceGroup[];
  loading: boolean;
}

const FinanceTab = ({
  groupType,
  taskGroups = [],
  loading
}: FinanceTabProps) => {
  // Transform taskGroups into the format expected by FinanceTableWrapper
  const activeTablesList = (taskGroups || []).map(group => ({
    group_id: group.group_id,
    group_name: group.group_name,
    color_code: group.color_code,
    color_code_dark: group.color_code_dark,
    tasks: (group.tasks || []).map(task => ({
      id: task.id,
      name: task.name,
      hours: task.estimated_hours || 0,
      cost: 0, // TODO: Calculate based on rate and hours
      fixedCost: 0, // TODO: Add fixed cost field
      totalBudget: 0, // TODO: Calculate total budget
      totalActual: task.total_actual || 0,
      variance: 0, // TODO: Calculate variance
      members: task.members || [],
      isbBillable: task.billable,
      total_time_logged: task.total_time_logged || 0,
      estimated_cost: task.estimated_cost || 0
    }))
  }));

  return (
    <div>
      <FinanceTableWrapper activeTablesList={activeTablesList} loading={loading} />
    </div>
  );
};

export default FinanceTab;
