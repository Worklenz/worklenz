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
import { financeTableColumns } from '@/lib/project/project-view-finance-table-columns';
import Avatars from '@/components/avatars/avatars';
import { IProjectFinanceGroup, IProjectFinanceTask } from '@/types/project/project-finance.types';
import { updateTaskFixedCost } from '@/features/projects/finance/project-finance.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';

type FinanceTableProps = {
  table: IProjectFinanceGroup;
  loading: boolean;
};

const FinanceTable = ({
  table,
  loading,
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

  // get theme data from theme reducer
  const themeMode = useAppSelector((state) => state.themeReducer.mode);

  const formatNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0.00';
    return value.toFixed(2);
  };

  const renderFinancialTableHeaderContent = (columnKey: string) => {
    switch (columnKey) {
      case 'hours':
        return <Typography.Text>{formatNumber(totals.hours)}</Typography.Text>;
      case 'total_time_logged':
        return <Typography.Text>{formatNumber(totals.total_time_logged)}</Typography.Text>;
      case 'estimated_cost':
        return <Typography.Text>{formatNumber(totals.estimated_cost)}</Typography.Text>;
      case 'totalBudget':
        return <Typography.Text>{formatNumber(totals.total_budget)}</Typography.Text>;
      case 'totalActual':
        return <Typography.Text>{formatNumber(totals.total_actual)}</Typography.Text>;
      case 'variance':
        return <Typography.Text>{formatNumber(totals.variance)}</Typography.Text>;
      default:
        return null;
    }
  };

  const handleFixedCostChange = (value: number | null, taskId: string) => {
    dispatch(updateTaskFixedCost({ taskId, groupId: table.group_id, fixedCost: value || 0 }));
  };

  const renderFinancialTableColumnContent = (columnKey: string, task: IProjectFinanceTask) => {
    switch (columnKey) {
      case 'task':
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
      case 'members':
        return task.members && (
          <Avatars 
            members={task.members.map(member => ({
              ...member,
              avatar_url: member.avatar_url || undefined
            }))} 
          />
        );
      case 'hours':
        return <Typography.Text>{formatNumber(task.estimated_hours / 60)}</Typography.Text>;
      case 'total_time_logged':
        return <Typography.Text>{formatNumber(task.total_time_logged / 60)}</Typography.Text>;
      case 'estimated_cost':
        return <Typography.Text>{formatNumber(task.estimated_cost)}</Typography.Text>;
      case 'fixedCost':
        return selectedTask?.id === task.id ? (
          <InputNumber
            value={task.fixed_cost}
            onBlur={(e) => {
              handleFixedCostChange(Number(e.target.value), task.id);
              setSelectedTask(null);
            }}
            autoFocus
            style={{ width: '100%', textAlign: 'right' }}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ''))}
            min={0}
            precision={2}
          />
        ) : (
          <Typography.Text>{formatNumber(task.fixed_cost)}</Typography.Text>
        );
      case 'variance':
        return <Typography.Text>{formatNumber(task.variance)}</Typography.Text>;
      case 'totalBudget':
        return <Typography.Text>{formatNumber(task.total_budget)}</Typography.Text>;
      case 'totalActual':
        return <Typography.Text>{formatNumber(task.total_actual)}</Typography.Text>;
      case 'cost':
        return <Typography.Text>{formatNumber(task.cost || 0)}</Typography.Text>;
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
        total_budget: acc.total_budget + (task.total_budget || 0),
        total_actual: acc.total_actual + (task.total_actual || 0),
        variance: acc.variance + (task.variance || 0)
      }),
      {
        hours: 0,
        total_time_logged: 0,
        estimated_cost: 0,
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
          className="group"
        >
          <td
            colSpan={3}
            style={{
              width: 48,
              textTransform: 'capitalize',
              textAlign: 'left',
              paddingInline: 16,
              backgroundColor: themeWiseColor(
                table.color_code,
                table.color_code_dark,
                themeMode
              ),
              cursor: 'pointer',
            }}
            onClick={() => setIsCollapse((prev) => !prev)}
          >
            <Flex gap={8} align="center" style={{ color: colors.darkGray }}>
              {isCollapse ? <RightOutlined /> : <DownOutlined />}
              {table.group_name} ({tasks.length})
            </Flex>
          </td>

          {financeTableColumns.map(
            (col) =>
              col.key !== 'task' &&
              col.key !== 'members' && (
                <td
                  key={`header-${col.key}`}
                  style={{
                    width: col.width,
                    paddingInline: 16,
                    textAlign: 'end',
                  }}
                >
                  {renderFinancialTableHeaderContent(col.key)}
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
              background: idx % 2 === 0 ? '#232323' : '#181818',
              transition: 'background 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#333'}
            onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#232323' : '#181818'}
            onClick={() => setSelectedTask(task)}
          >
            <td style={{ width: 48, paddingInline: 16 }}>
              <Checkbox />
            </td>
            {financeTableColumns.map((col) => (
              <td
                key={`${task.id}-${col.key}`}
                style={{
                  width: col.width,
                  paddingInline: 16,
                  textAlign: col.type === 'string' ? 'left' : 'right',
                }}
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
