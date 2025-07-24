import { Flex, InputNumber, Skeleton, Tooltip, Typography } from 'antd';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { DollarCircleOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { colors } from '@/styles/colors';
import {
  financeTableColumns,
  FinanceTableColumnKeys,
  getFinanceTableColumns,
} from '@/lib/project/project-view-finance-table-columns';
import { formatManDays } from '@/utils/man-days-utils';
import Avatars from '@/components/avatars/avatars';
import { IProjectFinanceGroup, IProjectFinanceTask } from '@/types/project/project-finance.types';
import {
  updateTaskFixedCostAsync,
  toggleTaskExpansion,
  fetchSubTasks,
  fetchProjectFinancesSilent,
} from '@/features/projects/finance/project-finance.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { useParams } from 'react-router-dom';

import { useAuthService } from '@/hooks/useAuth';
import { canEditFixedCost } from '@/utils/finance-permissions';
import './finance-table.css';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';

type FinanceTableProps = {
  table: IProjectFinanceGroup;
  loading: boolean;
  onTaskClick: (task: any) => void;
  columns?: any[];
};

const FinanceTable = ({ table, loading, onTaskClick, columns }: FinanceTableProps) => {
  const [isCollapse, setIsCollapse] = useState<boolean>(false);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<IProjectFinanceTask | null>(null);
  const [editingFixedCostValue, setEditingFixedCostValue] = useState<number | null>(null);
  const [tasks, setTasks] = useState<IProjectFinanceTask[]>(table.tasks);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dispatch = useAppDispatch();

  // Get the latest task groups from Redux store
  const taskGroups = useAppSelector(state => state.projectFinancesReducer.taskGroups);
  const {
    activeGroup,
    billableFilter,
    project: financeProject,
  } = useAppSelector(state => state.projectFinancesReducer);

  // Get calculation method and dynamic columns
  const calculationMethod = financeProject?.calculation_method || 'hourly';
  const hoursPerDay = financeProject?.hours_per_day || 8;
  const activeColumns = useMemo(
    () => columns || getFinanceTableColumns(calculationMethod),
    [columns, calculationMethod]
  );

  // Auth and permissions
  const auth = useAuthService();
  const currentSession = auth.getCurrentSession();
  const { project } = useAppSelector(state => state.projectReducer);
  const hasEditPermission = canEditFixedCost(currentSession, project);

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
        // Save current value before closing if it has changed
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
  }, [selectedTask, editingFixedCostValue, tasks]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // get theme data from theme reducer
  const themeMode = useAppSelector(state => state.themeReducer.mode);

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
      case FinanceTableColumnKeys.MAN_DAYS:
        return (
          <Typography.Text>
            {formatManDays(formattedTotals.man_days || 0, 1, hoursPerDay)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.TOTAL_TIME_LOGGED:
        return <Typography.Text>{formattedTotals.total_time_logged}</Typography.Text>;
      case FinanceTableColumnKeys.ESTIMATED_COST:
        return <Typography.Text>{formatNumber(formattedTotals.estimated_cost)}</Typography.Text>;
      case FinanceTableColumnKeys.COST:
        return (
          <Typography.Text>{formatNumber(formattedTotals.actual_cost_from_logs)}</Typography.Text>
        );
      case FinanceTableColumnKeys.FIXED_COST:
        return <Typography.Text>{formatNumber(formattedTotals.fixed_cost)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_BUDGET:
        return <Typography.Text>{formatNumber(formattedTotals.total_budget)}</Typography.Text>;
      case FinanceTableColumnKeys.TOTAL_ACTUAL:
        return <Typography.Text>{formatNumber(formattedTotals.total_actual)}</Typography.Text>;
      case FinanceTableColumnKeys.VARIANCE:
        return (
          <Typography.Text
            style={{
              color: formattedTotals.variance < 0 ? '#d32f2f' : '#2e7d32',
              fontWeight: 'bold',
            }}
          >
            {formatNumber(formattedTotals.variance)}
          </Typography.Text>
        );
      default:
        return null;
    }
  };

  const handleFixedCostChange = async (value: number | null, taskId: string) => {
    const fixedCost = value || 0;

    // Find the task to check if it's a parent task
    const findTask = (tasks: IProjectFinanceTask[], id: string): IProjectFinanceTask | null => {
      for (const task of tasks) {
        if (task.id === id) return task;
        if (task.sub_tasks) {
          const found = findTask(task.sub_tasks, id);
          if (found) return found;
        }
      }
      return null;
    };

    const task = findTask(tasks, taskId);
    if (!task) {
      console.error('Task not found:', taskId);
      return;
    }

    // Prevent editing fixed cost for parent tasks
    if (task.sub_tasks_count > 0) {
      console.warn(
        'Cannot edit fixed cost for parent tasks. Fixed cost is calculated from subtasks.'
      );
      return;
    }

    try {
      // Update the task fixed cost - this will automatically trigger hierarchical recalculation
      // The Redux slice handles parent task updates through recalculateTaskHierarchy
      await dispatch(
        updateTaskFixedCostAsync({ taskId, groupId: table.group_id, fixedCost })
      ).unwrap();

      // Trigger a silent refresh with expansion reset to show updated data clearly
      if (projectId) {
        dispatch(
          fetchProjectFinancesSilent({
            projectId,
            groupBy: activeGroup,
            billableFilter,
            resetExpansions: true,
          })
        );
      }

      setSelectedTask(null);
      setEditingFixedCostValue(null);
    } catch (error) {
      console.error('Failed to update fixed cost:', error);
    }
  };

  const { projectId } = useParams<{ projectId: string }>();

  const handleTaskNameClick = (taskId: string) => {
    if (!taskId || !projectId) return;

    dispatch(setSelectedTaskId(taskId));
    dispatch(fetchPhasesByProjectId(projectId));
    dispatch(fetchPriorities());
    dispatch(fetchTask({ taskId, projectId }));
    dispatch(setShowTaskDrawer(true));
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
      // Find the current task to check if value actually changed
      const findTask = (tasks: IProjectFinanceTask[], id: string): IProjectFinanceTask | null => {
        for (const task of tasks) {
          if (task.id === id) return task;
          if (task.sub_tasks) {
            const found = findTask(task.sub_tasks, id);
            if (found) return found;
          }
        }
        return null;
      };

      const currentTask = findTask(tasks, taskId);
      const currentFixedCost = currentTask?.fixed_cost || 0;
      const newFixedCost = value || 0;

      // Only save if the value actually changed
      if (newFixedCost !== currentFixedCost && value !== null) {
        handleFixedCostChange(value, taskId);
        // Don't close the input automatically - let user explicitly close it
      }
    }, 5000); // Save after 5 seconds of inactivity
  };

  // Immediate save function (for enter/blur)
  const immediateSaveFixedCost = (value: number | null, taskId: string) => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Find the current task to check if value actually changed
    const findTask = (tasks: IProjectFinanceTask[], id: string): IProjectFinanceTask | null => {
      for (const task of tasks) {
        if (task.id === id) return task;
        if (task.sub_tasks) {
          const found = findTask(task.sub_tasks, id);
          if (found) return found;
        }
      }
      return null;
    };

    const currentTask = findTask(tasks, taskId);
    const currentFixedCost = currentTask?.fixed_cost || 0;
    const newFixedCost = value || 0;

    // Only save if the value actually changed
    if (newFixedCost !== currentFixedCost && value !== null) {
      handleFixedCostChange(value, taskId);
    } else {
      // Just close the editor without saving
      setSelectedTask(null);
      setEditingFixedCostValue(null);
    }
  };

  // Calculate indentation based on nesting level
  const getTaskIndentation = (level: number) => level * 32; // 32px per level for better visibility

  // Recursive function to render task hierarchy
  const renderTaskHierarchy = (
    task: IProjectFinanceTask,
    level: number = 0
  ): React.ReactElement[] => {
    const elements: React.ReactElement[] = [];

    // Add the current task
    const isHovered = hoveredTaskId === task.id;
    const rowIndex = elements.length;
    const defaultBg =
      rowIndex % 2 === 0
        ? themeWiseColor('#fafafa', '#232323', themeMode)
        : themeWiseColor('#ffffff', '#181818', themeMode);
    const hoverBg = themeMode === 'dark' ? 'rgba(64, 169, 255, 0.08)' : 'rgba(24, 144, 255, 0.04)';

    elements.push(
      <tr
        key={task.id}
        style={{
          height: 40,
          background: isHovered ? hoverBg : defaultBg,
          transition: 'background 0.2s',
        }}
        className={`finance-table-task-row ${level > 0 ? 'finance-table-nested-task' : ''} ${themeMode === 'dark' ? 'dark' : ''}`}
        onMouseEnter={() => setHoveredTaskId(task.id)}
        onMouseLeave={() => setHoveredTaskId(null)}
      >
        {activeColumns.map(col => (
          <td
            key={`${task.id}-${col.key}`}
            style={{
              width: col.width,
              paddingInline: 16,
              textAlign: col.type === 'string' ? 'left' : 'right',
              backgroundColor:
                col.key === FinanceTableColumnKeys.TASK ||
                col.key === FinanceTableColumnKeys.MEMBERS
                  ? isHovered
                    ? hoverBg
                    : defaultBg
                  : isHovered
                    ? hoverBg
                    : 'transparent',
              cursor: 'default',
            }}
            className={customColumnStyles(col.key)}
            onClick={
              col.key === FinanceTableColumnKeys.FIXED_COST ? e => e.stopPropagation() : undefined
            }
          >
            {renderFinancialTableColumnContent(col.key, task, level)}
          </td>
        ))}
      </tr>
    );

    // Add subtasks recursively if they are expanded and loaded
    if (task.show_sub_tasks && task.sub_tasks) {
      task.sub_tasks.forEach(subTask => {
        elements.push(...renderTaskHierarchy(subTask, level + 1));
      });
    }

    return elements;
  };

  const renderFinancialTableColumnContent = (
    columnKey: FinanceTableColumnKeys,
    task: IProjectFinanceTask,
    level: number = 0
  ) => {
    switch (columnKey) {
      case FinanceTableColumnKeys.TASK:
        return (
          <Tooltip title={task.name}>
            <Flex gap={8} align="center" style={{ paddingLeft: getTaskIndentation(level) }}>
              {/* Expand/collapse icon for parent tasks */}
              {task.sub_tasks_count > 0 && (
                <div
                  className="finance-table-expand-btn"
                  style={{
                    cursor: 'pointer',
                    width: 18,
                    height: 18,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexShrink: 0,
                    zIndex: 1,
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    handleTaskExpansion(task);
                  }}
                >
                  {task.show_sub_tasks ? (
                    <DownOutlined style={{ fontSize: 12 }} />
                  ) : (
                    <RightOutlined style={{ fontSize: 12 }} />
                  )}
                </div>
              )}

              {/* Spacer for tasks without subtasks to align with those that have expand icons */}
              {task.sub_tasks_count === 0 && level > 0 && (
                <div style={{ width: 18, height: 18, flexShrink: 0 }} />
              )}

              {/* Task name */}
              <Typography.Text
                className="finance-table-task-name"
                ellipsis={{ expanded: false }}
                style={{
                  maxWidth: Math.max(
                    100,
                    200 - getTaskIndentation(level) - (task.sub_tasks_count > 0 ? 26 : 18)
                  ),
                  cursor: 'pointer',
                  color: '#1890ff',
                  fontSize: Math.max(12, 14 - level * 0.3), // Slightly smaller font for deeper levels
                  opacity: Math.max(0.85, 1 - level * 0.03), // Slightly faded for deeper levels
                  fontWeight: level > 0 ? 400 : 500, // Slightly lighter weight for nested tasks
                }}
                onClick={e => {
                  e.stopPropagation();
                  handleTaskNameClick(task.id);
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {task.name}
              </Typography.Text>
              {task.billable && <DollarCircleOutlined style={{ fontSize: 12, flexShrink: 0 }} />}
            </Flex>
          </Tooltip>
        );
      case FinanceTableColumnKeys.MEMBERS:
        return (
          task.members && (
            <div
              onClick={e => {
                e.stopPropagation();
                onTaskClick(task);
              }}
              style={{
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <Avatars
                members={task.members.map(member => ({
                  ...member,
                  avatar_url: member.avatar_url || undefined,
                }))}
                allowClickThrough={true}
              />
            </div>
          )
        );
      case FinanceTableColumnKeys.HOURS:
        return (
          <Typography.Text style={{ fontSize: Math.max(12, 14 - level * 0.5) }}>
            {task.estimated_hours}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.MAN_DAYS:
        // Backend now provides correct recursive aggregation for parent tasks
        const taskManDays =
          task.total_minutes > 0
            ? task.total_minutes / 60 / (hoursPerDay || 8)
            : task.estimated_seconds / 3600 / (hoursPerDay || 8);

        return (
          <Typography.Text style={{ fontSize: Math.max(12, 14 - level * 0.5) }}>
            {formatManDays(taskManDays, 1, hoursPerDay)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.TOTAL_TIME_LOGGED:
        return (
          <Typography.Text style={{ fontSize: Math.max(12, 14 - level * 0.5) }}>
            {task.total_time_logged}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.ESTIMATED_COST:
        return (
          <Typography.Text style={{ fontSize: Math.max(12, 14 - level * 0.5) }}>
            {formatNumber(task.estimated_cost)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.FIXED_COST:
        // Parent tasks with subtasks should not be editable - they aggregate from subtasks
        const isParentTask = task.sub_tasks_count > 0;
        const canEditThisTask = hasEditPermission && !isParentTask;

        return selectedTask?.id === task.id && canEditThisTask ? (
          <InputNumber
            value={editingFixedCostValue !== null ? editingFixedCostValue : task.fixed_cost}
            onChange={value => {
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
            onFocus={e => {
              // Select all text when input is focused
              e.target.select();
            }}
            autoFocus
            style={{ width: '100%', textAlign: 'right', fontSize: Math.max(12, 14 - level * 0.5) }}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => Number(value!.replace(/\$\s?|(,*)/g, ''))}
            min={0}
            precision={2}
            className="fixed-cost-input"
          />
        ) : (
          <Typography.Text
            style={{
              cursor: canEditThisTask ? 'pointer' : 'default',
              width: '100%',
              display: 'block',
              opacity: canEditThisTask ? 1 : 0.7,
              fontSize: Math.max(12, 14 - level * 0.5),
              fontStyle: isParentTask ? 'italic' : 'normal',
              color: isParentTask ? (themeMode === 'dark' ? '#888' : '#666') : 'inherit',
            }}
            onClick={
              canEditThisTask
                ? e => {
                    e.stopPropagation();
                    setSelectedTask(task);
                    setEditingFixedCostValue(task.fixed_cost);
                  }
                : undefined
            }
            title={isParentTask ? 'Fixed cost is calculated from subtasks' : undefined}
          >
            {formatNumber(task.fixed_cost)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.VARIANCE:
        // Calculate variance as Budget - Actual (positive = under budget = good)
        const varianceBudget = (task.estimated_cost || 0) + (task.fixed_cost || 0);
        const varianceActual = (task.actual_cost_from_logs || 0) + (task.fixed_cost || 0);
        const taskVariance = varianceBudget - varianceActual;
        return (
          <Typography.Text
            style={{
              color: taskVariance < 0 ? '#d32f2f' : '#2e7d32',
              fontSize: Math.max(12, 14 - level * 0.5),
              fontWeight: 'bold',
            }}
          >
            {formatNumber(taskVariance)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.TOTAL_BUDGET:
        const taskTotalBudget = (task.estimated_cost || 0) + (task.fixed_cost || 0);
        return (
          <Typography.Text style={{ fontSize: Math.max(12, 14 - level * 0.5) }}>
            {formatNumber(taskTotalBudget)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.TOTAL_ACTUAL:
        return (
          <Typography.Text style={{ fontSize: Math.max(12, 14 - level * 0.5) }}>
            {formatNumber(task.total_actual || 0)}
          </Typography.Text>
        );
      case FinanceTableColumnKeys.COST:
        return (
          <Typography.Text style={{ fontSize: Math.max(12, 14 - level * 0.5) }}>
            {formatNumber(task.actual_cost_from_logs || 0)}
          </Typography.Text>
        );
      default:
        return null;
    }
  };

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

  // Generate flattened task list with all nested levels
  const flattenedTasks = useMemo(() => {
    const flattened: React.ReactElement[] = [];

    tasks.forEach(task => {
      flattened.push(...renderTaskHierarchy(task, 0));
    });

    return flattened;
  }, [tasks, selectedTask, editingFixedCostValue, hasEditPermission, themeMode, hoveredTaskId]);

  // Calculate totals for the current table - backend provides correct aggregated values
  const totals = useMemo(() => {
    const calculateTaskTotals = (taskList: IProjectFinanceTask[]): any => {
      let totals = {
        hours: 0,
        man_days: 0,
        total_time_logged: 0,
        estimated_cost: 0,
        actual_cost_from_logs: 0,
        fixed_cost: 0,
        total_budget: 0,
        total_actual: 0,
        variance: 0,
      };

      for (const task of taskList) {
        if (task.sub_tasks && task.sub_tasks.length > 0) {
          // Parent task with loaded subtasks - only count subtasks recursively
          const subtaskTotals = calculateTaskTotals(task.sub_tasks);
          totals.hours += subtaskTotals.hours;
          totals.man_days += subtaskTotals.man_days;
          totals.total_time_logged += subtaskTotals.total_time_logged;
          totals.estimated_cost += subtaskTotals.estimated_cost;
          totals.actual_cost_from_logs += subtaskTotals.actual_cost_from_logs;
          totals.fixed_cost += subtaskTotals.fixed_cost;
          totals.total_budget += subtaskTotals.total_budget;
          totals.total_actual += subtaskTotals.total_actual;
          totals.variance += subtaskTotals.variance;
        } else {
          // Leaf task or parent task without loaded subtasks - use backend aggregated values
          const leafTotalActual = task.total_actual || 0;
          const leafTotalBudget = task.total_budget || 0;
          totals.hours += task.estimated_seconds || 0;
          // Use same calculation as individual task display - backend provides correct values
          const taskManDays =
            task.total_minutes > 0
              ? task.total_minutes / 60 / (hoursPerDay || 8)
              : task.estimated_seconds / 3600 / (hoursPerDay || 8);
          totals.man_days += taskManDays;
          totals.total_time_logged += task.total_time_logged_seconds || 0;
          totals.estimated_cost += task.estimated_cost || 0;
          totals.actual_cost_from_logs += task.actual_cost_from_logs || 0;
          totals.fixed_cost += task.fixed_cost || 0;
          totals.total_budget += leafTotalBudget;
          totals.total_actual += leafTotalActual;
          totals.variance += leafTotalBudget - leafTotalActual;
        }
      }

      return totals;
    };

    return calculateTaskTotals(tasks);
  }, [tasks, hoursPerDay]);

  // Format the totals for display
  const formattedTotals = useMemo(
    () => ({
      hours: formatSecondsToTimeString(totals.hours),
      man_days: totals.man_days,
      total_time_logged: formatSecondsToTimeString(totals.total_time_logged),
      estimated_cost: totals.estimated_cost,
      actual_cost_from_logs: totals.actual_cost_from_logs,
      fixed_cost: totals.fixed_cost,
      total_budget: totals.total_budget,
      total_actual: totals.total_actual,
      variance: totals.variance,
    }),
    [totals]
  );

  if (loading) {
    return (
      <tr>
        <td colSpan={activeColumns.length}>
          <Skeleton active />
        </td>
      </tr>
    );
  }

  return (
    <>
      {/* header row */}
      <tr
        style={{
          height: 40,
          backgroundColor: themeWiseColor(table.color_code, table.color_code_dark, themeMode),
          fontWeight: 600,
        }}
        className={`group ${themeMode === 'dark' ? 'dark' : ''}`}
      >
        {activeColumns.map((col, index) => (
          <td
            key={`header-${col.key}`}
            style={{
              width: col.width,
              paddingInline: 16,
              textAlign:
                col.key === FinanceTableColumnKeys.TASK ||
                col.key === FinanceTableColumnKeys.MEMBERS
                  ? 'left'
                  : 'right',
              backgroundColor: themeWiseColor(table.color_code, table.color_code_dark, themeMode),
              cursor: col.key === FinanceTableColumnKeys.TASK ? 'pointer' : 'default',
              textTransform: col.key === FinanceTableColumnKeys.TASK ? 'capitalize' : 'none',
            }}
            className={customHeaderColumnStyles(col.key)}
            onClick={
              col.key === FinanceTableColumnKeys.TASK
                ? () => setIsCollapse(prev => !prev)
                : undefined
            }
          >
            {col.key === FinanceTableColumnKeys.TASK ? (
              <Flex gap={8} align="center" style={{ color: colors.darkGray }}>
                {isCollapse ? <RightOutlined /> : <DownOutlined />}
                {table.group_name} ({tasks.length})
              </Flex>
            ) : col.key === FinanceTableColumnKeys.MEMBERS ? null : (
              renderFinancialTableHeaderContent(col.key)
            )}
          </td>
        ))}
      </tr>

      {/* task rows with recursive hierarchy */}
      {!isCollapse && flattenedTasks}
    </>
  );
};

export default FinanceTable;
