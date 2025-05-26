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
      cost: task.estimated_cost || 0,
      fixedCost: task.fixed_cost || 0,
      totalBudget: task.total_budget || 0,
      totalActual: task.total_actual || 0,
      variance: task.variance || 0,
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
