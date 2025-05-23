import React, { useEffect, useState } from 'react';
import { Checkbox, Flex, Tooltip, Typography } from 'antd';
import { themeWiseColor } from '../../../../../../utils/themeWiseColor';
import { useAppSelector } from '../../../../../../hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '../../../../../../hooks/useAppDispatch';
import { toggleFinanceDrawer } from '@/features/finance/finance-slice';
import { financeTableColumns } from '@/lib/project/project-view-finance-table-columns';
import FinanceTable from './finance-table';
import FinanceDrawer from '@/features/finance/finance-drawer/finance-drawer';
import { convertToHoursMinutes, formatHoursToReadable } from '@/utils/format-hours-to-readable';

interface FinanceTableWrapperProps {
  activeTablesList: {
    id: string;
    name: string;
    color_code: string;
    color_code_dark: string;
    tasks: {
      taskId: string;
      task: string;
      hours: number;
      cost: number;
      fixedCost: number;
      totalBudget: number;
      totalActual: number;
      variance: number;
      members: any[];
      isbBillable: boolean;
      total_time_logged: number;
      estimated_cost: number;
    }[];
  }[];
  loading: boolean;
}

const FinanceTableWrapper: React.FC<FinanceTableWrapperProps> = ({
  activeTablesList,
  loading
}) => {
  const [isScrolling, setIsScrolling] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const { t } = useTranslation('project-view-finance');
  const dispatch = useAppDispatch();

  const onTaskClick = (task: any) => {
    setSelectedTask(task);
    dispatch(toggleFinanceDrawer());
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

  const themeMode = useAppSelector((state) => state.themeReducer.mode);
  const { currency } = useAppSelector((state) => state.financeReducer);

  const totals = activeTablesList.reduce(
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
      table: { tasks: any[] }
    ) => {
      table.tasks.forEach((task: any) => {
        acc.hours += task.hours || 0;
        acc.cost += task.cost || 0;
        acc.fixedCost += task.fixedCost || 0;
        acc.totalBudget += task.totalBudget || 0;
        acc.totalActual += task.totalActual || 0;
        acc.variance += task.variance || 0;
        acc.total_time_logged += task.total_time_logged || 0;
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

  console.log("totals", totals);

  const renderFinancialTableHeaderContent = (columnKey: any) => {
    switch (columnKey) {
      case 'hours':
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            <Tooltip title={convertToHoursMinutes(totals.hours)}>
              {formatHoursToReadable(totals.hours)}
            </Tooltip>
          </Typography.Text>
        );
      case 'cost':
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {totals.cost}
          </Typography.Text>
        );
      case 'fixedCost':
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {totals.fixedCost}
          </Typography.Text>
        );
      case 'totalBudget':
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {totals.totalBudget}
          </Typography.Text>
        );
      case 'totalActual':
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {totals.totalActual}
          </Typography.Text>
        );
      case 'variance':
        return (
          <Typography.Text
            style={{
              color: totals.variance < 0 ? '#FF0000' : '#6DC376',
              fontSize: 18,
            }}
          >
            {totals.variance}
          </Typography.Text>
        );
      case 'total_time_logged':
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {totals.total_time_logged?.toFixed(2)}
          </Typography.Text>
        );
      case 'estimated_cost':
        return (
          <Typography.Text style={{ fontSize: 18 }}>
            {`${currency.toUpperCase()} ${totals.estimated_cost?.toFixed(2)}`}
          </Typography.Text>
        );
      default:
        return null;
    }
  };

  const customColumnHeaderStyles = (key: string) =>
    `px-2 text-left ${key === 'selector' && 'sticky left-0 z-10'} ${key === 'task' && 'sticky left-[48px] z-10'} ${key === 'members' && `sticky left-[288px] z-10 ${isScrolling ? 'after:content after:absolute after:top-0 after:-right-1 after:-z-10  after:h-[68px] after:w-1.5 after:bg-transparent after:bg-gradient-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent' : ''}`} ${themeMode === 'dark' ? 'bg-[#1d1d1d] border-[#303030]' : 'bg-[#fafafa]'}`;

  const customColumnStyles = (key: string) =>
    `px-2 text-left  ${key === 'totalRow' && `sticky left-0 z-10 ${isScrolling ? 'after:content after:absolute after:top-0 after:-right-1 after:-z-10  after:h-[68px] after:w-1.5 after:bg-transparent after:bg-gradient-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent' : ''}`}`;

  return (
    <>
      <Flex
        vertical
        className="tasklist-container min-h-0 max-w-full overflow-x-auto"
      >
        <table>
          <tbody>
            <tr
              style={{
                height: 56,
                fontWeight: 600,
                backgroundColor: themeWiseColor(
                  '#fafafa',
                  '#1d1d1d',
                  themeMode
                ),
                borderBlockEnd: `2px solid rgb(0 0 0 / 0.05)`,
              }}
            >
              <td
                style={{ width: 32, paddingInline: 16 }}
                className={customColumnHeaderStyles('selector')}
              >
                <Checkbox />
              </td>
              {financeTableColumns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    minWidth: col.width,
                    paddingInline: 16,
                    textAlign:
                      col.type === 'hours' || col.type === 'currency'
                        ? 'center'
                        : 'start',
                  }}
                  className={`${customColumnHeaderStyles(col.key)} before:constent relative before:absolute before:left-0 before:top-1/2 before:h-[36px] before:w-0.5 before:-translate-y-1/2 ${themeMode === 'dark' ? 'before:bg-white/10' : 'before:bg-black/5'}`}
                >
                  <Typography.Text>
                    {t(`${col.name}`)}{' '}
                    {col.type === 'currency' && `(${currency.toUpperCase()})`}
                  </Typography.Text>
                </td>
              ))}
            </tr>

            <tr
              style={{
                height: 56,
                fontWeight: 500,
                backgroundColor: themeWiseColor(
                  '#fbfbfb',
                  '#141414',
                  themeMode
                ),
              }}
            >
              <td
                colSpan={3}
                style={{
                  paddingInline: 16,
                  backgroundColor: themeWiseColor(
                    '#fbfbfb',
                    '#141414',
                    themeMode
                  ),
                }}
                className={customColumnStyles('totalRow')}
              >
                <Typography.Text style={{ fontSize: 18 }}>
                  {t('totalText')}
                </Typography.Text>
              </td>
              {financeTableColumns.map(
                (col) =>
                  (col.type === 'hours' || col.type === 'currency') && (
                    <td
                      key={col.key}
                      style={{
                        minWidth: col.width,
                        paddingInline: 16,
                        textAlign: 'end',
                      }}
                    >
                      {renderFinancialTableHeaderContent(col.key)}
                    </td>
                  )
              )}
            </tr>

            {activeTablesList.map((table, index) => (
              <FinanceTable
                key={index}
                table={table}
                isScrolling={isScrolling}
                onTaskClick={onTaskClick}
              />
            ))}
          </tbody>
        </table>
      </Flex>

      {selectedTask && <FinanceDrawer task={selectedTask} />}
    </>
  );
};

export default FinanceTableWrapper;
