import React, { useEffect, useState, useMemo } from 'react';
import { Flex, InputNumber, Tooltip, Typography, Empty } from 'antd';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { openFinanceDrawer } from '@/features/finance/finance-slice';
import { financeTableColumns, FinanceTableColumnKeys } from '@/lib/project/project-view-finance-table-columns';
import FinanceTable from './finance-table';
import FinanceDrawer from '@/features/finance/finance-drawer/finance-drawer';
import { convertToHoursMinutes, formatHoursToReadable } from '@/utils/format-hours-to-readable';
import { IProjectFinanceGroup } from '@/types/project/project-finance.types';
import { updateTaskFixedCostAsync } from '@/features/projects/finance/project-finance.slice';

interface FinanceTableWrapperProps {
  activeTablesList: IProjectFinanceGroup[];
  loading: boolean;
}

const FinanceTableWrapper: React.FC<FinanceTableWrapperProps> = ({ activeTablesList, loading }) => {
  const [isScrolling, setIsScrolling] = useState(false);
  const [editingFixedCost, setEditingFixedCost] = useState<{ taskId: string; groupId: string } | null>(null);

  const { t } = useTranslation('project-view-finance');
  const dispatch = useAppDispatch();

  // Get selected task from Redux store
  const selectedTask = useAppSelector(state => state.financeReducer.selectedTask);

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

  // Handle click outside to close editing
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingFixedCost && !(event.target as Element)?.closest('.fixed-cost-input')) {
        setEditingFixedCost(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingFixedCost]);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { currency } = useAppSelector(state => state.financeReducer);
  const taskGroups = useAppSelector(state => state.projectFinances.taskGroups);

  // Use Redux store data for totals calculation to ensure reactivity
  const totals = useMemo(() => {
    return taskGroups.reduce(
      (
        acc: {
          hours: number;
          cost: number;
          fixedCost: number;
          totalBudget: number;
          totalActual: number;
          variance: number;
          total_time_logged: number;
          estimated_cost: number;
        },
        table: IProjectFinanceGroup
      ) => {
        table.tasks.forEach((task) => {
          acc.hours += (task.estimated_hours / 60) || 0;
          acc.cost += task.estimated_cost || 0;
          acc.fixedCost += task.fixed_cost || 0;
          acc.totalBudget += task.total_budget || 0;
          acc.totalActual += task.total_actual || 0;
          acc.variance += task.variance || 0;
          acc.total_time_logged += (task.total_time_logged / 60) || 0;
          acc.estimated_cost += task.estimated_cost || 0;
        });
        return acc;
      },
      {
        hours: 0,
        cost: 0,
        fixedCost: 0,
        totalBudget: 0,
        totalActual: 0,
        variance: 0,
        total_time_logged: 0,
        estimated_cost: 0,
      }
    );
  }, [taskGroups]);

  const handleFixedCostChange = (value: number | null, taskId: string, groupId: string) => {
    dispatch(updateTaskFixedCostAsync({ taskId, groupId, fixedCost: value || 0 }));
    setEditingFixedCost(null);
  };

  const renderFinancialTableHeaderContent = (columnKey: FinanceTableColumnKeys) => {
    switch (columnKey) {
      case FinanceTableColumnKeys.HOURS:
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            <Tooltip title={convertToHoursMinutes(totals.hours)}>
              {formatHoursToReadable(totals.hours).toFixed(2)}
            </Tooltip>
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
              color: totals.variance < 0 ? '#FF0000' : '#6DC376',
              fontSize: 18,
            }}
          >
            {`${totals.variance?.toFixed(2)}`}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.TOTAL_TIME_LOGGED:
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {totals.total_time_logged?.toFixed(2)}
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
                  isScrolling={isScrolling}
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

      <FinanceDrawer />
    </>
  );
};

export default FinanceTableWrapper;
