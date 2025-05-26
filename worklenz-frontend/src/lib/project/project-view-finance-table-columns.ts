export enum FinanceTableColumnKeys {
  TASK = 'task',
  MEMBERS = 'members',
  HOURS = 'hours',
  TOTAL_TIME_LOGGED = 'total_time_logged',
  ESTIMATED_COST = 'estimated_cost',
  COST = 'cost',
  FIXED_COST = 'fixedCost',
  TOTAL_BUDGET = 'totalBudget',
  TOTAL_ACTUAL = 'totalActual',
  VARIANCE = 'variance',
}

type FinanceTableColumnsType = {
    key: FinanceTableColumnKeys;
    name: string;
    width: number;
    type: 'string' | 'hours' | 'currency';
    render?: (value: any) => React.ReactNode;
  };
  
  // finance table columns
  export const financeTableColumns: FinanceTableColumnsType[] = [
    {
      key: FinanceTableColumnKeys.TASK,
      name: 'taskColumn',
      width: 240,
      type: 'string',
    },
    {
      key: FinanceTableColumnKeys.MEMBERS,
      name: 'membersColumn',
      width: 160,
      type: 'string',
    },
    {
      key: FinanceTableColumnKeys.HOURS,
      name: 'hoursColumn',
      width: 100,
      type: 'hours',
    },
    {
      key: FinanceTableColumnKeys.TOTAL_TIME_LOGGED,
      name: 'totalTimeLoggedColumn',
      width: 120,
      type: 'hours',
    },
    {
      key: FinanceTableColumnKeys.ESTIMATED_COST,
      name: 'estimatedCostColumn',
      width: 120,
      type: 'currency',
    },
    {
      key: FinanceTableColumnKeys.COST,
      name: 'costColumn',
      width: 120,
      type: 'currency',
    },
    {
      key: FinanceTableColumnKeys.FIXED_COST,
      name: 'fixedCostColumn',
      width: 120,
      type: 'currency',
    },
    {
      key: FinanceTableColumnKeys.TOTAL_BUDGET,
      name: 'totalBudgetedCostColumn',
      width: 120,
      type: 'currency',
    },
    {
      key: FinanceTableColumnKeys.TOTAL_ACTUAL,
      name: 'totalActualCostColumn',
      width: 120,
      type: 'currency',
    },
    {
      key: FinanceTableColumnKeys.VARIANCE,
      name: 'varianceColumn',
      width: 120,
      type: 'currency',
    },
  ];
  