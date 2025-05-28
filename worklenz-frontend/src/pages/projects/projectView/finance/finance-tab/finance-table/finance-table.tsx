import { Checkbox, Flex, Input, InputNumber, Skeleton, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState, useRef } from 'react';
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
import { 
  updateTaskFixedCostAsync, 
  updateTaskFixedCost, 
  fetchProjectFinancesSilent,
  toggleTaskExpansion,
  fetchSubTasks
} from '@/features/projects/finance/project-finance.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSelectedTaskId, setShowTaskDrawer, fetchTask } from '@/features/task-drawer/task-drawer.slice';
import { useParams } from 'react-router-dom';
import { parseTimeToSeconds } from '@/utils/timeUtils';
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
  const [editingFixedCostValue, setEditingFixedCostValue] = useState<number | null>(null);
  const [tasks, setTasks] = useState<IProjectFinanceTask[]>(table.tasks);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dispatch = useAppDispatch();
  
  // Get the latest task groups from Redux store
  const taskGroups = useAppSelector((state) => state.projectFinances.taskGroups);
  const activeGroup = useAppSelector((state) => state.projectFinances.activeGroup);
  
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
        // Save current value before closing
        if (editingFixedCostValue !== null) {
          immediateSaveFixedCost(editingFixedCostValue, selectedTask.id);
        } else {
          setSelectedTask(null);
          setEditingFixedCostValue(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedTask, editingFixedCostValue]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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
        return <Typography.Text>{formattedTotals.hours}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_TIME_LOGGED:
        return <Typography.Text>{formattedTotals.total_time_logged}</Typography.Text>;
      case FinanceTableColumnKeys.ESTIMATED_COST:
        return <Typography.Text>{formatNumber(formattedTotals.estimated_cost)}</Typography.Text>;
      case FinanceTableColumnKeys.FIXED_COST:
        return <Typography.Text>{formatNumber(formattedTotals.fixed_cost)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_BUDGET:
        return <Typography.Text>{formatNumber(formattedTotals.total_budget)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_ACTUAL:
        return <Typography.Text>{formatNumber(formattedTotals.total_actual)}</Typography.Text>;
      case FinanceTableColumnKeys.VARIANCE:
        return <Typography.Text style={{ color: formattedTotals.variance > 0 ? '#FF0000' : '#6DC376' }}>{formatNumber(formattedTotals.variance)}</Typography.Text>;
      default:
        return null;
    }
  };

  const handleFixedCostChange = async (value: number | null, taskId: string) => {
    const fixedCost = value || 0;
    
    try {
      // Make the API call to persist the change
      await dispatch(updateTaskFixedCostAsync({ taskId, groupId: table.group_id, fixedCost })).unwrap();
      
      // Silent refresh the data to get accurate calculations from backend without loading animation
      if (projectId) {
        dispatch(fetchProjectFinancesSilent({ projectId, groupBy: activeGroup }));
      }
    } catch (error) {
      console.error('Failed to update fixed cost:', error);
    }
  };

  const { projectId } = useParams<{ projectId: string }>();

  const handleTaskNameClick = (taskId: string) => {
    if (!taskId || !projectId) return;
    
    dispatch(setSelectedTaskId(taskId));
    dispatch(setShowTaskDrawer(true));
    dispatch(fetchTask({ taskId, projectId }));
  };

  // Handle task expansion/collapse
  const handleTaskExpansion = async (task: IProjectFinanceTask) => {
    if (!projectId) return;
    
    // If task has subtasks but they're not loaded yet, load them
    if (task.sub_tasks_count > 0 && !task.sub_tasks) {
      dispatch(fetchSubTasks({ projectId, parentTaskId: task.id }));
    } else {
      // Just toggle the expansion state
      dispatch(toggleTaskExpansion({ taskId: task.id, groupId: table.group_id }));
    }
  };

  // Debounced save function for fixed cost
  const debouncedSaveFixedCost = (value: number | null, taskId: string) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      if (value !== null) {
        handleFixedCostChange(value, taskId);
        setSelectedTask(null);
        setEditingFixedCostValue(null);
      }
    }, 1000); // Save after 1 second of inactivity
  };

  // Immediate save function (for enter/blur)
  const immediateSaveFixedCost = (value: number | null, taskId: string) => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    if (value !== null) {
      handleFixedCostChange(value, taskId);
    }
    setSelectedTask(null);
    setEditingFixedCostValue(null);
  };

  const renderFinancialTableColumnContent = (columnKey: FinanceTableColumnKeys, task: IProjectFinanceTask) => {
    switch (columnKey) {
      case FinanceTableColumnKeys.TASK:
        return (
          <Tooltip title={task.name}>
            <Flex gap={8} align="center">
              {/* Indentation for subtasks */}
              {task.is_sub_task && <div style={{ width: 20 }} />}
              
              {/* Expand/collapse icon for parent tasks */}
              {task.sub_tasks_count > 0 && (
                <div
                  style={{ cursor: 'pointer', width: 16, display: 'flex', justifyContent: 'center' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTaskExpansion(task);
                  }}
                >
                  {task.show_sub_tasks ? <DownOutlined /> : <RightOutlined />}
                </div>
              )}
              
              {/* Task name */}
              <Typography.Text
                ellipsis={{ expanded: false }}
                style={{ 
                  maxWidth: task.is_sub_task ? 140 : (task.sub_tasks_count > 0 ? 140 : 160),
                  cursor: 'pointer',
                  color: '#1890ff'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTaskNameClick(task.id);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
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
        return <Typography.Text>{task.estimated_hours}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_TIME_LOGGED:
        return <Typography.Text>{task.total_time_logged}</Typography.Text>;
      case FinanceTableColumnKeys.ESTIMATED_COST:
        return <Typography.Text>{formatNumber(task.estimated_cost)}</Typography.Text>;
      case FinanceTableColumnKeys.FIXED_COST:
        return selectedTask?.id === task.id ? (
          <InputNumber
            value={editingFixedCostValue !== null ? editingFixedCostValue : task.fixed_cost}
            onChange={(value) => {
              setEditingFixedCostValue(value);
              // Trigger debounced save for up/down arrow clicks
              debouncedSaveFixedCost(value, task.id);
            }}
            onBlur={() => {
              // Immediate save on blur
              immediateSaveFixedCost(editingFixedCostValue, task.id);
            }}
            onPressEnter={() => {
              // Immediate save on enter
              immediateSaveFixedCost(editingFixedCostValue, task.id);
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
              setEditingFixedCostValue(task.fixed_cost);
            }}
          >
            {formatNumber(task.fixed_cost)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.VARIANCE:
        return (
          <Typography.Text 
            style={{ 
              color: task.variance > 0 ? '#FF0000' : '#6DC376' 
            }}
          >
            {formatNumber(task.variance)}
          </Typography.Text>
        );
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

  // Calculate totals for the current table
  const totals = useMemo(() => {
    return tasks.reduce(
      (acc, task) => ({
        hours: acc.hours + (task.estimated_seconds || 0),
        total_time_logged: acc.total_time_logged + (task.total_time_logged_seconds || 0),
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

  // Format the totals for display
  const formattedTotals = useMemo(() => ({
    hours: formatSecondsToTimeString(totals.hours),
    total_time_logged: formatSecondsToTimeString(totals.total_time_logged),
    estimated_cost: totals.estimated_cost,
    fixed_cost: totals.fixed_cost,
    total_budget: totals.total_budget,
    total_actual: totals.total_actual,
    variance: totals.variance
  }), [totals]);

  // Flatten tasks to include subtasks for rendering
  const flattenedTasks = useMemo(() => {
    const flattened: IProjectFinanceTask[] = [];
    
    tasks.forEach(task => {
      // Add the parent task
      flattened.push(task);
      
      // Add subtasks if they are expanded and loaded
      if (task.show_sub_tasks && task.sub_tasks) {
        task.sub_tasks.forEach(subTask => {
          flattened.push(subTask);
        });
      }
    });
    
    return flattened;
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
        {!isCollapse && flattenedTasks.map((task, idx) => (
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
