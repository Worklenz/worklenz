export enum FinanceTableColumnKeys {
  TASK = 'task',
  MEMBERS = 'members',
  HOURS = 'hours',
  MAN_DAYS = 'man_days',
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
  type: 'string' | 'hours' | 'currency' | 'man_days' | 'effort_variance';
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
    width: 120,
    type: 'string',
  },
  {
    key: FinanceTableColumnKeys.HOURS,
    name: 'hoursColumn',
    width: 100,
    type: 'hours',
  },
  {
    key: FinanceTableColumnKeys.MAN_DAYS,
    name: 'manDaysColumn',
    width: 100,
    type: 'man_days',
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

// Function to get columns based on calculation method
export const getFinanceTableColumns = (
  calculationMethod: 'hourly' | 'man_days' = 'hourly'
): FinanceTableColumnsType[] => {
  return financeTableColumns.filter(column => {
    // Always show these columns
    if (
      [
        FinanceTableColumnKeys.TASK,
        FinanceTableColumnKeys.MEMBERS,
        FinanceTableColumnKeys.TOTAL_TIME_LOGGED,
        FinanceTableColumnKeys.ESTIMATED_COST,
        FinanceTableColumnKeys.COST,
        FinanceTableColumnKeys.FIXED_COST,
        FinanceTableColumnKeys.TOTAL_BUDGET,
        FinanceTableColumnKeys.TOTAL_ACTUAL,
        FinanceTableColumnKeys.VARIANCE,
      ].includes(column.key)
    ) {
      return true;
    }

    // Show hours column only for hourly calculation
    if (column.key === FinanceTableColumnKeys.HOURS) {
      return calculationMethod === 'hourly';
    }

    // Show man days columns only for man days calculation
    if ([FinanceTableColumnKeys.MAN_DAYS].includes(column.key)) {
      return calculationMethod === 'man_days';
    }

    return false;
  });
};
