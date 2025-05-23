type FinanceTableColumnsType = {
    key: string;
    name: string;
    width: number;
    type: 'string' | 'hours' | 'currency';
    render?: (value: any) => React.ReactNode;
  };
  
  // finance table columns
  export const financeTableColumns: FinanceTableColumnsType[] = [
    {
      key: 'task',
      name: 'taskColumn',
      width: 240,
      type: 'string',
    },
    {
      key: 'members',
      name: 'membersColumn',
      width: 160,
      type: 'string',
    },
    {
      key: 'hours',
      name: 'hoursColumn',
      width: 80,
      type: 'hours',
    },
    {
      key: 'total_time_logged',
      name: 'totalTimeLoggedColumn',
      width: 120,
      type: 'hours',
    },
    {
      key: 'estimated_cost',
      name: 'estimatedCostColumn',
      width: 120,
      type: 'currency',
    },
    {
      key: 'cost',
      name: 'costColumn',
      width: 120,
      type: 'currency',
    },
    {
      key: 'fixedCost',
      name: 'fixedCostColumn',
      width: 120,
      type: 'currency',
    },
    {
      key: 'totalBudget',
      name: 'totalBudgetedCostColumn',
      width: 120,
      type: 'currency',
    },
    {
      key: 'totalActual',
      name: 'totalActualCostColumn',
      width: 120,
      type: 'currency',
    },
    {
      key: 'variance',
      name: 'varianceColumn',
      width: 120,
      type: 'currency',
    },
  ];
  