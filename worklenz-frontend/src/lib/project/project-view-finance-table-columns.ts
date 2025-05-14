type FinanceTableColumnsType = {
    key: string;
    name: string;
    width: number;
    type: 'string' | 'hours' | 'currency';
  };
  
  // finance table columns
  export const financeTableColumns: FinanceTableColumnsType[] = [
    {
      key: 'task',
      name: 'task',
      width: 240,
      type: 'string',
    },
    {
      key: 'members',
      name: 'members',
      width: 160,
      type: 'string',
    },
    {
      key: 'hours',
      name: 'hours',
      width: 80,
      type: 'hours',
    },
    {
      key: 'cost',
      name: 'cost',
      width: 120,
      type: 'currency',
    },
    {
      key: 'fixedCost',
      name: 'fixedCost',
      width: 120,
      type: 'currency',
    },
    {
      key: 'totalBudget',
      name: 'totalBudgetedCost',
      width: 120,
      type: 'currency',
    },
    {
      key: 'totalActual',
      name: 'totalActualCost',
      width: 120,
      type: 'currency',
    },
    {
      key: 'variance',
      name: 'variance',
      width: 120,
      type: 'currency',
    },
  ];
  