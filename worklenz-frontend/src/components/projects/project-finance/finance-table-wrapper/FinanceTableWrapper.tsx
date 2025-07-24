import React, { useEffect, useState, useMemo } from 'react';
import { Flex, Typography, Empty, Tooltip } from 'antd';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { openFinanceDrawer } from '@/features/finance/finance-slice';
import {
  FinanceTableColumnKeys,
  getFinanceTableColumns,
} from '@/lib/project/project-view-finance-table-columns';
import { formatManDays } from '@/utils/man-days-utils';
import { IProjectFinanceGroup, IProjectFinanceTask } from '@/types/project/project-finance.types';
import { createPortal } from 'react-dom';
import FinanceTable from '../finance-table/FinanceTable';
import FinanceDrawer from '../finance-drawer/FinanceDrawer';

interface FinanceTableWrapperProps {
  activeTablesList: IProjectFinanceGroup[];
  loading: boolean;
}

// Utility function to format seconds to time string
const formatSecondsToTimeString = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds === 0) return '0s';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
};

const FinanceTableWrapper: React.FC<FinanceTableWrapperProps> = ({ activeTablesList, loading }) => {
  const [isScrolling, setIsScrolling] = useState(false);

  const { t } = useTranslation('project-view-finance');
  const dispatch = useAppDispatch();

  const onTaskClick = (task: any) => {
    dispatch(openFinanceDrawer(task));
  };

  useEffect(() => {
    const tableContainer = document.querySelector('.tasklist-container');
    const handleScroll = () => {
      if (tableContainer) {
        setIsScrolling(tableContainer.scrollLeft > 0);
      }
    };

    tableContainer?.addEventListener('scroll', handleScroll);
    return () => {
      tableContainer?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const currency = useAppSelector(
    state => state.projectFinancesReducer.project?.currency || ''
  ).toUpperCase();
  const taskGroups = useAppSelector(state => state.projectFinancesReducer.taskGroups);
  const financeProject = useAppSelector(state => state.projectFinancesReducer.project);

  // Get calculation method and hours per day from project
  const calculationMethod = financeProject?.calculation_method || 'hourly';
  const hoursPerDay = financeProject?.hours_per_day || 8;

  // Get dynamic columns based on calculation method
  const activeColumns = useMemo(
    () => getFinanceTableColumns(calculationMethod),
    [calculationMethod]
  );

  // Function to get tooltip text for column headers
  const getColumnTooltip = (columnKey: FinanceTableColumnKeys): string => {
    switch (columnKey) {
      case FinanceTableColumnKeys.HOURS:
        return t('columnTooltips.hours');
      case FinanceTableColumnKeys.MAN_DAYS:
        return t('columnTooltips.manDays', { hoursPerDay });
      case FinanceTableColumnKeys.TOTAL_TIME_LOGGED:
        return t('columnTooltips.totalTimeLogged');
      case FinanceTableColumnKeys.ESTIMATED_COST:
        return calculationMethod === 'man_days'
          ? t('columnTooltips.estimatedCostManDays')
          : t('columnTooltips.estimatedCostHourly');
      case FinanceTableColumnKeys.COST:
        return t('columnTooltips.actualCost');
      case FinanceTableColumnKeys.FIXED_COST:
        return t('columnTooltips.fixedCost');
      case FinanceTableColumnKeys.TOTAL_BUDGET:
        return calculationMethod === 'man_days'
          ? t('columnTooltips.totalBudgetManDays')
          : t('columnTooltips.totalBudgetHourly');
      case FinanceTableColumnKeys.TOTAL_ACTUAL:
        return t('columnTooltips.totalActual');
      case FinanceTableColumnKeys.VARIANCE:
        return t('columnTooltips.variance');
      default:
        return '';
    }
  };

  // Use Redux store data for totals calculation to ensure reactivity
  const totals = useMemo(() => {
    // Recursive function to calculate totals from task hierarchy without double counting
    const calculateTaskTotalsRecursively = (tasks: IProjectFinanceTask[]): any => {
      return tasks.reduce(
        (acc, task) => {
          // For parent tasks with subtasks, aggregate values from subtasks only
          // For leaf tasks, use their individual values
          if (task.sub_tasks && task.sub_tasks.length > 0) {
            // Parent task - only use aggregated values from subtasks (no parent's own values)
            const subtaskTotals = calculateTaskTotalsRecursively(task.sub_tasks);
            return {
              hours: acc.hours + subtaskTotals.hours,
              manDays: acc.manDays + subtaskTotals.manDays,
              cost: acc.cost + subtaskTotals.cost,
              fixedCost: acc.fixedCost + subtaskTotals.fixedCost,
              totalBudget: acc.totalBudget + subtaskTotals.totalBudget,
              totalActual: acc.totalActual + subtaskTotals.totalActual,
              variance: acc.variance + subtaskTotals.variance,
              total_time_logged: acc.total_time_logged + subtaskTotals.total_time_logged,
              estimated_cost: acc.estimated_cost + subtaskTotals.estimated_cost,
            };
          } else {
            // Leaf task - use backend-provided calculated values
            const leafTotalActual = task.total_actual || 0;
            const leafTotalBudget = task.total_budget || 0;
            return {
              hours: acc.hours + (task.estimated_seconds || 0),
              // Calculate man days from total_minutes, fallback to estimated_seconds if total_minutes is 0
              manDays:
                acc.manDays +
                (task.total_minutes > 0
                  ? task.total_minutes / 60 / (hoursPerDay || 8)
                  : task.estimated_seconds / 3600 / (hoursPerDay || 8)),
              cost: acc.cost + (task.actual_cost_from_logs || 0),
              fixedCost: acc.fixedCost + (task.fixed_cost || 0),
              totalBudget: acc.totalBudget + leafTotalBudget,
              totalActual: acc.totalActual + leafTotalActual,
              variance: acc.variance + (leafTotalBudget - leafTotalActual),
              total_time_logged: acc.total_time_logged + (task.total_time_logged_seconds || 0),
              estimated_cost: acc.estimated_cost + (task.estimated_cost || 0),
            };
          }
        },
        {
          hours: 0,
          manDays: 0,
          cost: 0,
          fixedCost: 0,
          totalBudget: 0,
          totalActual: 0,
          variance: 0,
          total_time_logged: 0,
          estimated_cost: 0,
        }
      );
    };

    return activeTablesList.reduce(
      (acc, table: IProjectFinanceGroup) => {
        const groupTotals = calculateTaskTotalsRecursively(table.tasks);
        return {
          hours: acc.hours + groupTotals.hours,
          manDays: acc.manDays + groupTotals.manDays,
          cost: acc.cost + groupTotals.cost,
          fixedCost: acc.fixedCost + groupTotals.fixedCost,
          totalBudget: acc.totalBudget + groupTotals.totalBudget,
          totalActual: acc.totalActual + groupTotals.totalActual,
          variance: acc.variance + groupTotals.variance,
          total_time_logged: acc.total_time_logged + groupTotals.total_time_logged,
          estimated_cost: acc.estimated_cost + groupTotals.estimated_cost,
        };
      },
      {
        hours: 0,
        manDays: 0,
        cost: 0,
        fixedCost: 0,
        totalBudget: 0,
        totalActual: 0,
        variance: 0,
        total_time_logged: 0,
        estimated_cost: 0,
      }
    );
  }, [activeTablesList, hoursPerDay]);

  const renderFinancialTableHeaderContent = (columnKey: FinanceTableColumnKeys) => {
    switch (columnKey) {
      case FinanceTableColumnKeys.HOURS:
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {formatSecondsToTimeString(totals.hours)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.MAN_DAYS:
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {formatManDays(totals.manDays, 1, hoursPerDay)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.COST:
        return (
          <Typography.Text style={{ fontSize: 18 }}>{`${totals.cost?.toFixed(2)}`}</Typography.Text>
        );
      case FinanceTableColumnKeys.FIXED_COST:
        return (
          <Typography.Text style={{ fontSize: 18 }}>{totals.fixedCost?.toFixed(2)}</Typography.Text>
        );
      case FinanceTableColumnKeys.TOTAL_BUDGET:
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {totals.totalBudget?.toFixed(2)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.TOTAL_ACTUAL:
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {totals.totalActual?.toFixed(2)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.VARIANCE:
        return (
          <Typography.Text
            style={{
              color: totals.variance < 0 ? '#d32f2f' : '#2e7d32',
              fontSize: 18,
              fontWeight: 'bold',
            }}
          >
            {totals.variance?.toFixed(2)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.TOTAL_TIME_LOGGED:
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {formatSecondsToTimeString(totals.total_time_logged)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.ESTIMATED_COST:
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {`${totals.estimated_cost?.toFixed(2)}`}
          </Typography.Text>
        );
      default:
        return null;
    }
  };

  const customColumnHeaderStyles = (key: FinanceTableColumnKeys) =>
    `px-2 text-left ${key === FinanceTableColumnKeys.TASK && 'sticky left-0 z-10'} ${key === FinanceTableColumnKeys.MEMBERS && `sticky left-[240px] z-10 ${isScrolling ? 'after:content after:absolute after:top-0 after:-right-1 after:-z-10  after:h-[68px] after:w-1.5 after:bg-transparent after:bg-gradient-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent' : ''}`} ${themeMode === 'dark' ? 'bg-[#1d1d1d] border-[#303030]' : 'bg-[#fafafa]'}`;

  const customColumnStyles = (key: FinanceTableColumnKeys) =>
    `px-2 text-left ${key === FinanceTableColumnKeys.TASK && `sticky left-0 z-10 ${isScrolling ? 'after:content after:absolute after:top-0 after:-right-1 after:-z-10 after:h-[56px] after:w-1.5 after:bg-transparent after:bg-gradient-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent' : ''}`} ${key === FinanceTableColumnKeys.MEMBERS && `sticky left-[240px] z-10 ${isScrolling ? 'after:content after:absolute after:top-0 after:-right-1 after:-z-10 after:h-[56px] after:w-1.5 after:bg-transparent after:bg-gradient-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent' : ''}`} ${themeMode === 'dark' ? 'bg-[#141414]' : 'bg-[#fbfbfb]'}`;

  // Check if there are any tasks across all groups
  const hasAnyTasks = activeTablesList.some(table => table.tasks && table.tasks.length > 0);

  return (
    <>
      <Flex vertical className="tasklist-container min-h-0 max-w-full overflow-x-auto">
        <table>
          <tbody>
            <tr
              style={{
                height: 56,
                fontWeight: 600,
                backgroundColor: themeWiseColor('#fafafa', '#1d1d1d', themeMode),
                borderBlockEnd: `2px solid rgb(0 0 0 / 0.05)`,
              }}
            >
              {activeColumns.map(col => (
                <td
                  key={col.key}
                  style={{
                    minWidth: col.width,
                    paddingInline: 16,
                    textAlign:
                      col.type === 'hours' || col.type === 'currency' || col.type === 'man_days'
                        ? 'center'
                        : 'start',
                  }}
                  className={`${customColumnHeaderStyles(col.key)} before:constent relative before:absolute before:left-0 before:top-1/2 before:h-[36px] before:w-0.5 before:-translate-y-1/2 ${themeMode === 'dark' ? 'before:bg-white/10' : 'before:bg-black/5'}`}
                >
                  <Tooltip title={getColumnTooltip(col.key)} placement="top">
                    <Typography.Text style={{ cursor: 'help' }}>
                      {t(`${col.name}`)} {col.type === 'currency' && `(${currency.toUpperCase()})`}
                    </Typography.Text>
                  </Tooltip>
                </td>
              ))}
            </tr>

            {hasAnyTasks && (
              <tr
                style={{
                  height: 56,
                  fontWeight: 500,
                  backgroundColor: themeWiseColor('#fbfbfb', '#141414', themeMode),
                }}
              >
                {activeColumns.map((col, index) => (
                  <td
                    key={col.key}
                    style={{
                      minWidth: col.width,
                      paddingInline: 16,
                      textAlign: col.key === FinanceTableColumnKeys.TASK ? 'left' : 'right',
                      backgroundColor: themeWiseColor('#fbfbfb', '#141414', themeMode),
                    }}
                    className={customColumnStyles(col.key)}
                  >
                    {col.key === FinanceTableColumnKeys.TASK ? (
                      <Typography.Text style={{ fontSize: 18 }}>{t('totalText')}</Typography.Text>
                    ) : col.key === FinanceTableColumnKeys.MEMBERS ? null : (
                      (col.type === 'hours' ||
                        col.type === 'currency' ||
                        col.type === 'man_days') &&
                      renderFinancialTableHeaderContent(col.key)
                    )}
                  </td>
                ))}
              </tr>
            )}

            {hasAnyTasks ? (
              activeTablesList.map(table => (
                <FinanceTable
                  key={table.group_id}
                  table={table}
                  onTaskClick={onTaskClick}
                  loading={loading}
                  columns={activeColumns}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={activeColumns.length}
                  style={{ padding: '40px 0', textAlign: 'center' }}
                >
                  <Empty
                    description={
                      <Typography.Text type="secondary">{t('noTasksFound')}</Typography.Text>
                    }
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Flex>

      {createPortal(<FinanceDrawer />, document.body)}
    </>
  );
};

export default FinanceTableWrapper;
