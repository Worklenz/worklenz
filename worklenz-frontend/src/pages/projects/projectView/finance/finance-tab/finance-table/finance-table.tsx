import { Checkbox, Flex, Input, InputNumber, Skeleton, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  DollarCircleOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { colors } from '@/styles/colors';
import { financeTableColumns, FinanceTableColumnKeys } from '@/lib/project/project-view-finance-table-columns';
import Avatars from '@/components/avatars/avatars';
import { IProjectFinanceGroup, IProjectFinanceTask } from '@/types/project/project-finance.types';
import { updateTaskFixedCostAsync, updateTaskFixedCost } from '@/features/projects/finance/project-finance.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import './finance-table.css';

type FinanceTableProps = {
  table: IProjectFinanceGroup;
  loading: boolean;
  isScrolling: boolean;
  onTaskClick: (task: any) => void;
};

const FinanceTable = ({
  table,
  loading,
  isScrolling,
  onTaskClick,
}: FinanceTableProps) => {
  const [isCollapse, setIsCollapse] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<IProjectFinanceTask | null>(null);
  const [tasks, setTasks] = useState<IProjectFinanceTask[]>(table.tasks);
  const dispatch = useAppDispatch();
  
  // Get the latest task groups from Redux store
  const taskGroups = useAppSelector((state) => state.projectFinances.taskGroups);
  
  // Update local state when table.tasks or Redux store changes
  useEffect(() => {
    const updatedGroup = taskGroups.find(g => g.group_id === table.group_id);
    if (updatedGroup) {
      setTasks(updatedGroup.tasks);
    } else {
      setTasks(table.tasks);
    }
  }, [table.tasks, taskGroups, table.group_id]);

  // Handle click outside to close editing
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectedTask && !(event.target as Element)?.closest('.fixed-cost-input')) {
        setSelectedTask(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedTask]);

  // get theme data from theme reducer
  const themeMode = useAppSelector((state) => state.themeReducer.mode);

  const formatNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0.00';
    return value.toFixed(2);
  };

  // Custom column styles for sticky positioning
  const customColumnStyles = (key: FinanceTableColumnKeys) =>
    `px-2 text-left ${key === FinanceTableColumnKeys.TASK && 'sticky left-0 z-10'} ${key === FinanceTableColumnKeys.MEMBERS && `sticky left-[240px] z-10 ${isScrolling ? 'after:content after:absolute after:top-0 after:-right-1 after:-z-10 after:h-[40px] after:w-1.5 after:bg-transparent after:bg-gradient-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent' : ''}`} ${themeMode === 'dark' ? 'bg-[#1d1d1d] border-[#303030]' : 'bg-white'}`;

  const customHeaderColumnStyles = (key: FinanceTableColumnKeys) =>
    `px-2 text-left ${key === FinanceTableColumnKeys.TASK && 'sticky left-0 z-10'} ${key === FinanceTableColumnKeys.MEMBERS && `sticky left-[240px] z-10 ${isScrolling ? 'after:content after:absolute after:top-0 after:-right-1 after:-z-10 after:h-[40px] after:w-1.5 after:bg-transparent after:bg-gradient-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent' : ''}`}`;

  const renderFinancialTableHeaderContent = (columnKey: FinanceTableColumnKeys) => {
    switch (columnKey) {
      case FinanceTableColumnKeys.HOURS:
        return <Typography.Text>{formatNumber(totals.hours)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_TIME_LOGGED:
        return <Typography.Text>{formatNumber(totals.total_time_logged)}</Typography.Text>;
      case FinanceTableColumnKeys.ESTIMATED_COST:
        return <Typography.Text>{formatNumber(totals.estimated_cost)}</Typography.Text>;
      case FinanceTableColumnKeys.FIXED_COST:
        return <Typography.Text>{formatNumber(totals.fixed_cost)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_BUDGET:
        return <Typography.Text>{formatNumber(totals.total_budget)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_ACTUAL:
        return <Typography.Text>{formatNumber(totals.total_actual)}</Typography.Text>;
      case FinanceTableColumnKeys.VARIANCE:
        return <Typography.Text>{formatNumber(totals.variance)}</Typography.Text>;
      default:
        return null;
    }
  };

  const handleFixedCostChange = (value: number | null, taskId: string) => {
    const fixedCost = value || 0;
    
    // Optimistic update for immediate UI feedback
    dispatch(updateTaskFixedCost({ taskId, groupId: table.group_id, fixedCost }));
    
    // Then make the API call to persist the change
    dispatch(updateTaskFixedCostAsync({ taskId, groupId: table.group_id, fixedCost }));
  };

  const renderFinancialTableColumnContent = (columnKey: FinanceTableColumnKeys, task: IProjectFinanceTask) => {
    switch (columnKey) {
      case FinanceTableColumnKeys.TASK:
        return (
          <Tooltip title={task.name}>
            <Flex gap={8} align="center">
              <Typography.Text
                ellipsis={{ expanded: false }}
                style={{ maxWidth: 160 }}
              >
                {task.name}
              </Typography.Text>
              {task.billable && <DollarCircleOutlined />}
            </Flex>
          </Tooltip>
        );
      case FinanceTableColumnKeys.MEMBERS:
        return task.members && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onTaskClick(task);
            }}
            style={{ 
              cursor: 'pointer', 
              width: '100%'
            }}
          >
            <Avatars 
              members={task.members.map(member => ({
                ...member,
                avatar_url: member.avatar_url || undefined
              }))} 
              allowClickThrough={true}
            />
          </div>
        );
      case FinanceTableColumnKeys.HOURS:
        return <Typography.Text>{formatNumber(task.estimated_hours / 60)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_TIME_LOGGED:
        return <Typography.Text>{formatNumber(task.total_time_logged / 60)}</Typography.Text>;
      case FinanceTableColumnKeys.ESTIMATED_COST:
        return <Typography.Text>{formatNumber(task.estimated_cost)}</Typography.Text>;
      case FinanceTableColumnKeys.FIXED_COST:
        return selectedTask?.id === task.id ? (
          <InputNumber
            value={task.fixed_cost}
            onBlur={(e) => {
              handleFixedCostChange(Number(e.target.value), task.id);
              setSelectedTask(null);
            }}
            onPressEnter={(e) => {
              handleFixedCostChange(Number((e.target as HTMLInputElement).value), task.id);
              setSelectedTask(null);
            }}
            autoFocus
            style={{ width: '100%', textAlign: 'right' }}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ''))}
            min={0}
            precision={2}
            className="fixed-cost-input"
          />
        ) : (
          <Typography.Text 
            style={{ cursor: 'pointer', width: '100%', display: 'block' }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTask(task);
            }}
          >
            {formatNumber(task.fixed_cost)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.VARIANCE:
        return <Typography.Text>{formatNumber(task.variance)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_BUDGET:
        return <Typography.Text>{formatNumber(task.total_budget)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_ACTUAL:
        return <Typography.Text>{formatNumber(task.total_actual)}</Typography.Text>;
      case FinanceTableColumnKeys.COST:
        return <Typography.Text>{formatNumber(task.estimated_cost || 0)}</Typography.Text>;
      default:
        return null;
    }
  };

  // Calculate totals for the current table
  const totals = useMemo(() => {
    return tasks.reduce(
      (acc, task) => ({
        hours: acc.hours + (task.estimated_hours / 60),
        total_time_logged: acc.total_time_logged + (task.total_time_logged / 60),
        estimated_cost: acc.estimated_cost + (task.estimated_cost || 0),
        fixed_cost: acc.fixed_cost + (task.fixed_cost || 0),
        total_budget: acc.total_budget + (task.total_budget || 0),
        total_actual: acc.total_actual + (task.total_actual || 0),
        variance: acc.variance + (task.variance || 0)
      }),
      {
        hours: 0,
        total_time_logged: 0,
        estimated_cost: 0,
        fixed_cost: 0,
        total_budget: 0,
        total_actual: 0,
        variance: 0
      }
    );
  }, [tasks]);

  return (
    <Skeleton active loading={loading}>
      <>
        {/* header row */}
        <tr
          style={{
            height: 40,
            backgroundColor: themeWiseColor(
              table.color_code,
              table.color_code_dark,
              themeMode
            ),
            fontWeight: 600,
          }}
          className={`group ${themeMode === 'dark' ? 'dark' : ''}`}
        >
          {financeTableColumns.map(
            (col, index) => (
              <td
                key={`header-${col.key}`}
                style={{
                  width: col.width,
                  paddingInline: 16,
                  textAlign: col.key === FinanceTableColumnKeys.TASK || col.key === FinanceTableColumnKeys.MEMBERS ? 'left' : 'right',
                  backgroundColor: themeWiseColor(
                    table.color_code,
                    table.color_code_dark,
                    themeMode
                  ),
                  cursor: col.key === FinanceTableColumnKeys.TASK ? 'pointer' : 'default',
                  textTransform: col.key === FinanceTableColumnKeys.TASK ? 'capitalize' : 'none',
                }}
                className={customHeaderColumnStyles(col.key)}
                onClick={col.key === FinanceTableColumnKeys.TASK ? () => setIsCollapse((prev) => !prev) : undefined}
              >
                {col.key === FinanceTableColumnKeys.TASK ? (
                  <Flex gap={8} align="center" style={{ color: colors.darkGray }}>
                    {isCollapse ? <RightOutlined /> : <DownOutlined />}
                    {table.group_name} ({tasks.length})
                  </Flex>
                ) : col.key === FinanceTableColumnKeys.MEMBERS ? null : renderFinancialTableHeaderContent(col.key)}
              </td>
            )
          )}
        </tr>

        {/* task rows */}
        {!isCollapse && tasks.map((task, idx) => (
          <tr
            key={task.id}
            style={{
              height: 40,
              background: idx % 2 === 0 ? themeWiseColor('#fafafa', '#232323', themeMode) : themeWiseColor('#ffffff', '#181818', themeMode),
              transition: 'background 0.2s',
            }}
            className={themeMode === 'dark' ? 'dark' : ''}
            onMouseEnter={e => e.currentTarget.style.background = themeWiseColor('#f0f0f0', '#333', themeMode)}
            onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? themeWiseColor('#fafafa', '#232323', themeMode) : themeWiseColor('#ffffff', '#181818', themeMode)}
          >
            {financeTableColumns.map((col) => (
              <td
                key={`${task.id}-${col.key}`}
                style={{
                  width: col.width,
                  paddingInline: 16,
                  textAlign: col.type === 'string' ? 'left' : 'right',
                  backgroundColor: (col.key === FinanceTableColumnKeys.TASK || col.key === FinanceTableColumnKeys.MEMBERS) ? 
                    (idx % 2 === 0 ? themeWiseColor('#fafafa', '#232323', themeMode) : themeWiseColor('#ffffff', '#181818', themeMode)) : 
                    'transparent',
                  cursor: 'default'
                }}
                className={customColumnStyles(col.key)}
                onClick={
                  col.key === FinanceTableColumnKeys.FIXED_COST 
                    ? (e) => e.stopPropagation() 
                    : undefined
                }
              >
                {renderFinancialTableColumnContent(col.key, task)}
              </td>
            ))}
          </tr>
        ))}
      </>
    </Skeleton>
  );
};

export default FinanceTable;
