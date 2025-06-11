import React, { useEffect, useState, useMemo } from 'react';
import { Flex, Typography, Empty } from 'antd';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { openFinanceDrawer } from '@/features/finance/finance-slice';
import { financeTableColumns, FinanceTableColumnKeys } from '@/lib/project/project-view-finance-table-columns';
import FinanceTable from './finance-table';
import FinanceDrawer from '@/features/finance/finance-drawer/finance-drawer';
import { IProjectFinanceGroup, IProjectFinanceTask } from '@/types/project/project-finance.types';
import { createPortal } from 'react-dom';

interface FinanceTableWrapperProps {
  activeTablesList: IProjectFinanceGroup[];
  loading: boolean;
}

// Utility function to format seconds to time string
const formatSecondsToTimeString = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds === 0) return "0s";
  
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
  const currency = useAppSelector(state => state.projectFinances.project?.currency || "").toUpperCase();
  const taskGroups = useAppSelector(state => state.projectFinances.taskGroups);

  // Use Redux store data for totals calculation to ensure reactivity
  const totals = useMemo(() => {
    // Recursive function to calculate totals from task hierarchy without double counting
    const calculateTaskTotalsRecursively = (tasks: IProjectFinanceTask[]): any => {
      return tasks.reduce((acc, task) => {
        // For parent tasks with subtasks, only count the aggregated values (no double counting)
        // For leaf tasks, count their individual values
        if (task.sub_tasks && task.sub_tasks.length > 0) {
          // Parent task - use its aggregated values which already include subtask totals
          return {
            hours: acc.hours + (task.estimated_seconds || 0),
            cost: acc.cost + (task.actual_cost_from_logs || 0),
            fixedCost: acc.fixedCost + (task.fixed_cost || 0),
            totalBudget: acc.totalBudget + (task.total_budget || 0),
            totalActual: acc.totalActual + (task.total_actual || 0),
            variance: acc.variance + (task.variance || 0),
            total_time_logged: acc.total_time_logged + (task.total_time_logged_seconds || 0),
            estimated_cost: acc.estimated_cost + (task.estimated_cost || 0)
          };
        } else {
          // Leaf task - use its individual values
          return {
            hours: acc.hours + (task.estimated_seconds || 0),
            cost: acc.cost + (task.actual_cost_from_logs || 0),
            fixedCost: acc.fixedCost + (task.fixed_cost || 0),
            totalBudget: acc.totalBudget + (task.total_budget || 0),
            totalActual: acc.totalActual + (task.total_actual || 0),
            variance: acc.variance + (task.variance || 0),
            total_time_logged: acc.total_time_logged + (task.total_time_logged_seconds || 0),
            estimated_cost: acc.estimated_cost + (task.estimated_cost || 0)
          };
        }
      }, {
        hours: 0,
        cost: 0,
        fixedCost: 0,
        totalBudget: 0,
        totalActual: 0,
        variance: 0,
        total_time_logged: 0,
        estimated_cost: 0
      });
    };

    return taskGroups.reduce((acc, table: IProjectFinanceGroup) => {
      const groupTotals = calculateTaskTotalsRecursively(table.tasks);
      return {
        hours: acc.hours + groupTotals.hours,
        cost: acc.cost + groupTotals.cost,
        fixedCost: acc.fixedCost + groupTotals.fixedCost,
        totalBudget: acc.totalBudget + groupTotals.totalBudget,
        totalActual: acc.totalActual + groupTotals.totalActual,
        variance: acc.variance + groupTotals.variance,
        total_time_logged: acc.total_time_logged + groupTotals.total_time_logged,
        estimated_cost: acc.estimated_cost + groupTotals.estimated_cost
      };
    }, {
      hours: 0,
      cost: 0,
      fixedCost: 0,
      totalBudget: 0,
      totalActual: 0,
      variance: 0,
      total_time_logged: 0,
      estimated_cost: 0
    });
  }, [taskGroups]);



  const renderFinancialTableHeaderContent = (columnKey: FinanceTableColumnKeys) => {
    switch (columnKey) {
      case FinanceTableColumnKeys.HOURS:
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {formatSecondsToTimeString(totals.hours)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.COST:
        return <Typography.Text style={{ fontSize: 18 }}>{`${totals.cost?.toFixed(2)}`}</Typography.Text>;
      case FinanceTableColumnKeys.FIXED_COST:
        return <Typography.Text style={{ fontSize: 18 }}>{totals.fixedCost?.toFixed(2)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_BUDGET:
        return <Typography.Text style={{ fontSize: 18 }}>{totals.totalBudget?.toFixed(2)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_ACTUAL:
        return <Typography.Text style={{ fontSize: 18 }}>{totals.totalActual?.toFixed(2)}</Typography.Text>;
      case FinanceTableColumnKeys.VARIANCE:
        return (
          <Typography.Text
            style={{
              color: totals.variance > 0 ? '#FF0000' : '#6DC376',
              fontSize: 18,
            }}
          >
            {totals.variance < 0 ? `+${Math.abs(totals.variance).toFixed(2)}` : 
             totals.variance > 0 ? `-${totals.variance.toFixed(2)}` : 
             `${totals.variance?.toFixed(2)}`}
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
              {financeTableColumns.map(col => (
                <td
                  key={col.key}
                  style={{
                    minWidth: col.width,
                    paddingInline: 16,
                    textAlign: col.type === 'hours' || col.type === 'currency' ? 'center' : 'start',
                  }}
                  className={`${customColumnHeaderStyles(col.key)} before:constent relative before:absolute before:left-0 before:top-1/2 before:h-[36px] before:w-0.5 before:-translate-y-1/2 ${themeMode === 'dark' ? 'before:bg-white/10' : 'before:bg-black/5'}`}
                >
                  <Typography.Text>
                    {t(`${col.name}`)} {col.type === 'currency' && `(${currency.toUpperCase()})`}
                  </Typography.Text>
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
                {financeTableColumns.map((col, index) => (
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
                      (col.type === 'hours' || col.type === 'currency') && renderFinancialTableHeaderContent(col.key)
                    )}
                  </td>
                ))}
              </tr>
            )}

            {hasAnyTasks ? (
              activeTablesList.map((table) => (
                <FinanceTable
                  key={table.group_id}
                  table={table}
                  onTaskClick={onTaskClick}
                  loading={loading}
                />
              ))
            ) : (
              <tr>
                <td colSpan={financeTableColumns.length} style={{ padding: '40px 0', textAlign: 'center' }}>
                  <Empty
                    description={
                      <Typography.Text type="secondary">
                        {t('noTasksFound')}
                      </Typography.Text>
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