import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';
import {
  IProjectFinanceGroup,
  IProjectFinanceTask,
  IProjectRateCard,
  IProjectFinanceProject,
} from '@/types/project/project-finance.types';

type FinanceTabType = 'finance' | 'ratecard';
type GroupTypes = 'status' | 'priority' | 'phases';
type BillableFilterType = 'all' | 'billable' | 'non-billable';

interface ProjectFinanceState {
  activeTab: FinanceTabType;
  activeGroup: GroupTypes;
  billableFilter: BillableFilterType;
  loading: boolean;
  taskGroups: IProjectFinanceGroup[];
  projectRateCards: IProjectRateCard[];
  project: IProjectFinanceProject | null;
}

// Enhanced utility functions for efficient frontend calculations
const secondsToHours = (seconds: number) => seconds / 3600;

const calculateTaskCosts = (task: IProjectFinanceTask) => {
  const hours = secondsToHours(task.estimated_seconds || 0);
  const timeLoggedHours = secondsToHours(task.total_time_logged_seconds || 0);

  const totalBudget = (task.estimated_cost || 0) + (task.fixed_cost || 0);
  // task.total_actual already includes actual_cost_from_logs + fixed_cost from backend
  const totalActual = task.total_actual || 0;
  const variance = totalActual - totalBudget;

  return {
    hours,
    timeLoggedHours,
    totalBudget,
    totalActual,
    variance,
  };
};

// Memoization cache for task calculations to improve performance
const taskCalculationCache = new Map<
  string,
  {
    task: IProjectFinanceTask;
    result: IProjectFinanceTask;
    timestamp: number;
  }
>();

// Cache cleanup interval (5 minutes)
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;
const CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutes

// Periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  Array.from(taskCalculationCache.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > CACHE_MAX_AGE) {
      taskCalculationCache.delete(key);
    }
  });
}, CACHE_CLEANUP_INTERVAL);

// Generate cache key for task
const generateTaskCacheKey = (task: IProjectFinanceTask): string => {
  return `${task.id}-${task.estimated_cost}-${task.fixed_cost}-${task.total_actual}-${task.estimated_seconds}-${task.total_time_logged_seconds}`;
};

// Check if task has changed significantly to warrant recalculation
const hasTaskChanged = (oldTask: IProjectFinanceTask, newTask: IProjectFinanceTask): boolean => {
  return (
    oldTask.estimated_cost !== newTask.estimated_cost ||
    oldTask.fixed_cost !== newTask.fixed_cost ||
    oldTask.total_actual !== newTask.total_actual ||
    oldTask.estimated_seconds !== newTask.estimated_seconds ||
    oldTask.total_time_logged_seconds !== newTask.total_time_logged_seconds
  );
};

// Optimized recursive calculation for task hierarchy with memoization
const recalculateTaskHierarchy = (tasks: IProjectFinanceTask[]): IProjectFinanceTask[] => {
  return tasks.map(task => {
    // If task has loaded subtasks, recalculate from subtasks
    if (task.sub_tasks && task.sub_tasks.length > 0) {
      const updatedSubTasks = recalculateTaskHierarchy(task.sub_tasks);

      // Calculate totals from subtasks only (for time and costs from logs)
      const subtaskTotals = updatedSubTasks.reduce(
        (acc, subtask) => ({
          estimated_cost: acc.estimated_cost + (subtask.estimated_cost || 0),
          fixed_cost: acc.fixed_cost + (subtask.fixed_cost || 0),
          actual_cost_from_logs: acc.actual_cost_from_logs + (subtask.actual_cost_from_logs || 0),
          estimated_seconds: acc.estimated_seconds + (subtask.estimated_seconds || 0),
          total_time_logged_seconds:
            acc.total_time_logged_seconds + (subtask.total_time_logged_seconds || 0),
        }),
        {
          estimated_cost: 0,
          fixed_cost: 0,
          actual_cost_from_logs: 0,
          estimated_seconds: 0,
          total_time_logged_seconds: 0,
        }
      );

      // For parent tasks with loaded subtasks: use ONLY the subtask totals
      // The parent's original values were backend-aggregated, now we use frontend subtask aggregation
      const totalFixedCost = subtaskTotals.fixed_cost; // Only subtask fixed costs
      const totalEstimatedCost = subtaskTotals.estimated_cost; // Only subtask estimated costs
      const totalActualCostFromLogs = subtaskTotals.actual_cost_from_logs; // Only subtask logged costs
      const totalActual = totalActualCostFromLogs + totalFixedCost;

      // Update parent task with aggregated values
      const updatedTask = {
        ...task,
        sub_tasks: updatedSubTasks,
        estimated_cost: totalEstimatedCost,
        fixed_cost: totalFixedCost,
        actual_cost_from_logs: totalActualCostFromLogs,
        total_actual: totalActual,
        estimated_seconds: subtaskTotals.estimated_seconds,
        total_time_logged_seconds: subtaskTotals.total_time_logged_seconds,
        total_budget: totalEstimatedCost + totalFixedCost,
        variance: totalActual - (totalEstimatedCost + totalFixedCost),
      };

      return updatedTask;
    }

    // For parent tasks without loaded subtasks, trust backend-calculated values
    if (task.sub_tasks_count > 0 && (!task.sub_tasks || task.sub_tasks.length === 0)) {
      // Parent task with unloaded subtasks - backend has already calculated aggregated values
      const { totalBudget, totalActual, variance } = calculateTaskCosts(task);
      return {
        ...task,
        total_budget: totalBudget,
        total_actual: totalActual,
        variance: variance,
      };
    }

    // For leaf tasks, check cache first
    const cacheKey = generateTaskCacheKey(task);
    const cached = taskCalculationCache.get(cacheKey);

    if (cached && !hasTaskChanged(cached.task, task)) {
      return { ...cached.result, ...task }; // Merge with current task to preserve other properties
    }

    // For leaf tasks, just recalculate their own values
    const { totalBudget, totalActual, variance } = calculateTaskCosts(task);
    const updatedTask = {
      ...task,
      total_budget: totalBudget,
      total_actual: totalActual,
      variance: variance,
    };

    // Cache the result only for leaf tasks
    taskCalculationCache.set(cacheKey, {
      task: { ...task },
      result: updatedTask,
      timestamp: Date.now(),
    });

    return updatedTask;
  });
};

// Optimized function to find and update a specific task, then recalculate hierarchy
const updateTaskAndRecalculateHierarchy = (
  tasks: IProjectFinanceTask[],
  targetId: string,
  updateFn: (task: IProjectFinanceTask) => IProjectFinanceTask
): { updated: boolean; tasks: IProjectFinanceTask[] } => {
  let updated = false;

  const updatedTasks = tasks.map(task => {
    if (task.id === targetId) {
      updated = true;
      return updateFn(task);
    }

    // Search in subtasks recursively
    if (task.sub_tasks && task.sub_tasks.length > 0) {
      const result = updateTaskAndRecalculateHierarchy(task.sub_tasks, targetId, updateFn);
      if (result.updated) {
        updated = true;
        return {
          ...task,
          sub_tasks: result.tasks,
        };
      }
    }

    return task;
  });

  // If a task was updated, recalculate the entire hierarchy to ensure parent totals are correct
  return {
    updated,
    tasks: updated ? recalculateTaskHierarchy(updatedTasks) : updatedTasks,
  };
};

const initialState: ProjectFinanceState = {
  activeTab: 'finance',
  activeGroup: 'status',
  billableFilter: 'billable',
  loading: false,
  taskGroups: [],
  projectRateCards: [],
  project: null,
};

export const fetchProjectFinances = createAsyncThunk(
  'projectFinances/fetchProjectFinances',
  async ({
    projectId,
    groupBy,
    billableFilter,
  }: {
    projectId: string;
    groupBy: GroupTypes;
    billableFilter?: BillableFilterType;
  }) => {
    const response = await projectFinanceApiService.getProjectTasks(
      projectId,
      groupBy,
      billableFilter
    );
    return response.body;
  }
);

export const fetchProjectFinancesSilent = createAsyncThunk(
  'projectFinances/fetchProjectFinancesSilent',
  async ({
    projectId,
    groupBy,
    billableFilter,
    resetExpansions = false,
  }: {
    projectId: string;
    groupBy: GroupTypes;
    billableFilter?: BillableFilterType;
    resetExpansions?: boolean;
  }) => {
    const response = await projectFinanceApiService.getProjectTasks(
      projectId,
      groupBy,
      billableFilter
    );
    return { ...response.body, resetExpansions };
  }
);

export const fetchSubTasks = createAsyncThunk(
  'projectFinances/fetchSubTasks',
  async ({
    projectId,
    parentTaskId,
    billableFilter,
  }: {
    projectId: string;
    parentTaskId: string;
    billableFilter?: BillableFilterType;
  }) => {
    const response = await projectFinanceApiService.getSubTasks(
      projectId,
      parentTaskId,
      billableFilter
    );
    return { parentTaskId, subTasks: response.body };
  }
);

export const updateTaskFixedCostAsync = createAsyncThunk(
  'projectFinances/updateTaskFixedCostAsync',
  async ({
    taskId,
    groupId,
    fixedCost,
  }: {
    taskId: string;
    groupId: string;
    fixedCost: number;
  }) => {
    await projectFinanceApiService.updateTaskFixedCost(taskId, fixedCost);
    return { taskId, groupId, fixedCost };
  }
);

export const updateProjectCalculationMethodAsync = createAsyncThunk(
  'projectFinances/updateProjectCalculationMethodAsync',
  async ({
    projectId,
    calculationMethod,
    hoursPerDay,
  }: {
    projectId: string;
    calculationMethod: 'hourly' | 'man_days';
    hoursPerDay?: number;
  }) => {
    await projectFinanceApiService.updateProjectCalculationMethod(
      projectId,
      calculationMethod,
      hoursPerDay
    );
    return { calculationMethod, hoursPerDay };
  }
);

export const updateTaskEstimatedManDaysAsync = createAsyncThunk(
  'projectFinances/updateTaskEstimatedManDaysAsync',
  async ({
    taskId,
    groupId,
    estimatedManDays,
  }: {
    taskId: string;
    groupId: string;
    estimatedManDays: number;
  }) => {
    await projectFinanceApiService.updateTaskEstimatedManDays(taskId, estimatedManDays);
    return { taskId, groupId, estimatedManDays };
  }
);

export const updateRateCardManDayRateAsync = createAsyncThunk(
  'projectFinances/updateRateCardManDayRateAsync',
  async ({ rateCardRoleId, manDayRate }: { rateCardRoleId: string; manDayRate: number }) => {
    await projectFinanceApiService.updateRateCardManDayRate(rateCardRoleId, manDayRate);
    return { rateCardRoleId, manDayRate };
  }
);

// Function to clear calculation cache (useful for testing or when data is refreshed)
const clearCalculationCache = () => {
  taskCalculationCache.clear();
};

export const projectFinancesSlice = createSlice({
  name: 'projectFinances',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<FinanceTabType>) => {
      state.activeTab = action.payload;
    },
    setActiveGroup: (state, action: PayloadAction<GroupTypes>) => {
      state.activeGroup = action.payload;
    },
    setBillableFilter: (state, action: PayloadAction<BillableFilterType>) => {
      state.billableFilter = action.payload;
    },
    resetAllTaskExpansions: state => {
      // Recursive function to reset all expansion states
      const resetExpansionStates = (tasks: IProjectFinanceTask[]): IProjectFinanceTask[] => {
        return tasks.map(task => ({
          ...task,
          show_sub_tasks: false,
          sub_tasks: task.sub_tasks ? resetExpansionStates(task.sub_tasks) : task.sub_tasks,
        }));
      };

      // Reset expansion states for all groups
      state.taskGroups = state.taskGroups.map(group => ({
        ...group,
        tasks: resetExpansionStates(group.tasks),
      }));
    },
    updateTaskFixedCost: (
      state,
      action: PayloadAction<{ taskId: string; groupId: string; fixedCost: number }>
    ) => {
      const { taskId, groupId, fixedCost } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);

      if (group) {
        const result = updateTaskAndRecalculateHierarchy(group.tasks, taskId, task => ({
          ...task,
          fixed_cost: fixedCost,
        }));

        if (result.updated) {
          group.tasks = result.tasks;
        }
      }
    },
    updateTaskEstimatedCost: (
      state,
      action: PayloadAction<{ taskId: string; groupId: string; estimatedCost: number }>
    ) => {
      const { taskId, groupId, estimatedCost } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);

      if (group) {
        const result = updateTaskAndRecalculateHierarchy(group.tasks, taskId, task => ({
          ...task,
          estimated_cost: estimatedCost,
        }));

        if (result.updated) {
          group.tasks = result.tasks;
        }
      }
    },
    updateTaskTimeLogged: (
      state,
      action: PayloadAction<{
        taskId: string;
        groupId: string;
        timeLoggedSeconds: number;
        timeLoggedString: string;
        totalActual: number;
      }>
    ) => {
      const { taskId, groupId, timeLoggedSeconds, timeLoggedString, totalActual } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);

      if (group) {
        const result = updateTaskAndRecalculateHierarchy(group.tasks, taskId, task => ({
          ...task,
          total_time_logged_seconds: timeLoggedSeconds,
          total_time_logged: timeLoggedString,
          total_actual: totalActual,
        }));

        if (result.updated) {
          group.tasks = result.tasks;
        }
      }
    },
    toggleTaskExpansion: (state, action: PayloadAction<{ taskId: string; groupId: string }>) => {
      const { taskId, groupId } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);

      if (group) {
        // Recursive function to find and toggle a task in the hierarchy
        const findAndToggleTask = (tasks: IProjectFinanceTask[], targetId: string): boolean => {
          for (const task of tasks) {
            if (task.id === targetId) {
              task.show_sub_tasks = !task.show_sub_tasks;
              return true;
            }

            // Search in subtasks recursively
            if (task.sub_tasks && findAndToggleTask(task.sub_tasks, targetId)) {
              return true;
            }
          }
          return false;
        };

        findAndToggleTask(group.tasks, taskId);
      }
    },
    updateProjectFinanceCurrency: (state, action: PayloadAction<string>) => {
      if (state.project) {
        state.project.currency = action.payload;
      }
    },
    updateProjectCalculationMethod: (
      state,
      action: PayloadAction<{ calculationMethod: 'hourly' | 'man_days'; hoursPerDay?: number }>
    ) => {
      if (state.project) {
        state.project.calculation_method = action.payload.calculationMethod;
        if (action.payload.hoursPerDay !== undefined) {
          state.project.hours_per_day = action.payload.hoursPerDay;
        }
      }
    },
    updateTaskEstimatedManDays: (
      state,
      action: PayloadAction<{ taskId: string; groupId: string; estimatedManDays: number }>
    ) => {
      const { taskId, groupId, estimatedManDays } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);

      if (group) {
        const result = updateTaskAndRecalculateHierarchy(group.tasks, taskId, task => ({
          ...task,
          estimated_man_days: estimatedManDays,
        }));

        if (result.updated) {
          group.tasks = result.tasks;
        }
      }
    },
    updateRateCardManDayRate: (
      state,
      action: PayloadAction<{ rateCardRoleId: string; manDayRate: number }>
    ) => {
      const { rateCardRoleId, manDayRate } = action.payload;
      const rateCard = state.projectRateCards.find(rc => rc.id === rateCardRoleId);

      if (rateCard) {
        rateCard.man_day_rate = manDayRate.toString();
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchProjectFinances.pending, state => {
        state.loading = true;
      })
      .addCase(fetchProjectFinances.fulfilled, (state, action) => {
        state.loading = false;
        // Apply hierarchy recalculation to ensure parent tasks show correct aggregated values
        const recalculatedGroups = action.payload.groups.map((group: IProjectFinanceGroup) => ({
          ...group,
          tasks: recalculateTaskHierarchy(group.tasks),
        }));
        state.taskGroups = recalculatedGroups;
        state.projectRateCards = action.payload.project_rate_cards;
        state.project = action.payload.project;
        // Clear cache when fresh data is loaded
        clearCalculationCache();
      })
      .addCase(fetchProjectFinances.rejected, state => {
        state.loading = false;
      })
      .addCase(fetchProjectFinancesSilent.fulfilled, (state, action) => {
        const { resetExpansions, ...payload } = action.payload;

        if (resetExpansions) {
          // Reset all expansions and load fresh data
          const recalculatedGroups = payload.groups.map((group: IProjectFinanceGroup) => ({
            ...group,
            tasks: recalculateTaskHierarchy(group.tasks),
          }));
          state.taskGroups = recalculatedGroups;
        } else {
          // Helper function to preserve expansion state and sub_tasks during updates
          const preserveExpansionState = (
            existingTasks: IProjectFinanceTask[],
            newTasks: IProjectFinanceTask[]
          ): IProjectFinanceTask[] => {
            return newTasks.map(newTask => {
              const existingTask = existingTasks.find(t => t.id === newTask.id);
              if (existingTask) {
                // Preserve expansion state and subtasks
                const updatedTask = {
                  ...newTask,
                  show_sub_tasks: existingTask.show_sub_tasks,
                  sub_tasks: existingTask.sub_tasks
                    ? preserveExpansionState(existingTask.sub_tasks, newTask.sub_tasks || [])
                    : newTask.sub_tasks,
                };
                return updatedTask;
              }
              return newTask;
            });
          };

          // Update groups while preserving expansion state and applying hierarchy recalculation
          const updatedTaskGroups = payload.groups.map((newGroup: IProjectFinanceGroup) => {
            const existingGroup = state.taskGroups.find(g => g.group_id === newGroup.group_id);
            if (existingGroup) {
              const tasksWithExpansion = preserveExpansionState(
                existingGroup.tasks,
                newGroup.tasks
              );
              return {
                ...newGroup,
                tasks: recalculateTaskHierarchy(tasksWithExpansion),
              };
            }
            return {
              ...newGroup,
              tasks: recalculateTaskHierarchy(newGroup.tasks),
            };
          });
          state.taskGroups = updatedTaskGroups;
        }

        // Update data without changing loading state for silent refresh
        state.projectRateCards = payload.project_rate_cards;
        state.project = payload.project;
        // Clear cache when data is refreshed from backend
        clearCalculationCache();
      })
      .addCase(updateTaskFixedCostAsync.fulfilled, (state, action) => {
        const { taskId, groupId, fixedCost } = action.payload;
        const group = state.taskGroups.find(g => g.group_id === groupId);

        if (group) {
          // Update the specific task's fixed cost and recalculate the entire hierarchy
          const result = updateTaskAndRecalculateHierarchy(group.tasks, taskId, task => ({
            ...task,
            fixed_cost: fixedCost,
          }));

          if (result.updated) {
            group.tasks = result.tasks;
            clearCalculationCache();
          }
        }
      })
      .addCase(fetchSubTasks.fulfilled, (state, action) => {
        const { parentTaskId, subTasks } = action.payload;

        // Recursive function to find and update a task in the hierarchy
        const findAndUpdateTask = (tasks: IProjectFinanceTask[], targetId: string): boolean => {
          for (const task of tasks) {
            if (task.id === targetId) {
              // Found the parent task, add subtasks
              task.sub_tasks = subTasks.map(subTask => ({
                ...subTask,
                is_sub_task: true,
                parent_task_id: targetId,
              }));
              task.show_sub_tasks = true;
              return true;
            }

            // Search in subtasks recursively
            if (task.sub_tasks && findAndUpdateTask(task.sub_tasks, targetId)) {
              return true;
            }
          }
          return false;
        };

        // Find the parent task in any group and add the subtasks
        for (const group of state.taskGroups) {
          if (findAndUpdateTask(group.tasks, parentTaskId)) {
            // Recalculate the hierarchy after adding subtasks to ensure parent values are correct
            group.tasks = recalculateTaskHierarchy(group.tasks);
            break;
          }
        }
      })
      .addCase(updateProjectCalculationMethodAsync.fulfilled, (state, action) => {
        if (state.project) {
          state.project.calculation_method = action.payload.calculationMethod;
          if (action.payload.hoursPerDay !== undefined) {
            state.project.hours_per_day = action.payload.hoursPerDay;
          }
        }
      })
      .addCase(updateTaskEstimatedManDaysAsync.fulfilled, (state, action) => {
        const { taskId, groupId, estimatedManDays } = action.payload;
        const group = state.taskGroups.find(g => g.group_id === groupId);

        if (group) {
          const result = updateTaskAndRecalculateHierarchy(group.tasks, taskId, task => ({
            ...task,
            estimated_man_days: estimatedManDays,
          }));

          if (result.updated) {
            group.tasks = result.tasks;
            clearCalculationCache();
          }
        }
      })
      .addCase(updateRateCardManDayRateAsync.fulfilled, (state, action) => {
        const { rateCardRoleId, manDayRate } = action.payload;
        const rateCard = state.projectRateCards.find(rc => rc.id === rateCardRoleId);

        if (rateCard) {
          rateCard.man_day_rate = manDayRate.toString();
        }
      });
  },
});

export const {
  setActiveTab,
  setActiveGroup,
  setBillableFilter,
  resetAllTaskExpansions,
  updateTaskFixedCost,
  updateTaskEstimatedCost,
  updateTaskTimeLogged,
  toggleTaskExpansion,
  updateProjectFinanceCurrency,
  updateProjectCalculationMethod,
  updateTaskEstimatedManDays,
  updateRateCardManDayRate,
} = projectFinancesSlice.actions;

export default projectFinancesSlice.reducer;
