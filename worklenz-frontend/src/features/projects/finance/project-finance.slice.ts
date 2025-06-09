import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IProjectFinanceGroup, IProjectFinanceTask, IProjectRateCard, IProjectFinanceProject } from '@/types/project/project-finance.types';
import { parseTimeToSeconds } from '@/utils/timeUtils';

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

// Utility functions for frontend calculations
const secondsToHours = (seconds: number) => seconds / 3600;

const calculateTaskCosts = (task: IProjectFinanceTask) => {
  const hours = secondsToHours(task.estimated_seconds || 0);
  const timeLoggedHours = secondsToHours(task.total_time_logged_seconds || 0);
  const fixedCost = task.fixed_cost || 0;
  
  // For fixed cost updates, we'll rely on the backend values
  // and trigger a re-fetch to ensure accuracy
  const totalBudget = (task.estimated_cost || 0) + fixedCost;
  const totalActual = task.total_actual || 0;
  const variance = totalActual - totalBudget;

  return {
    hours,
    timeLoggedHours,
    totalBudget,
    totalActual,
    variance
  };
};

const calculateGroupTotals = (tasks: IProjectFinanceTask[]) => {
  return tasks.reduce(
    (acc, task) => {
      const { hours, timeLoggedHours, totalBudget, totalActual, variance } = calculateTaskCosts(task);
      return {
        hours: acc.hours + hours,
        total_time_logged: acc.total_time_logged + timeLoggedHours,
        estimated_cost: acc.estimated_cost + (task.estimated_cost || 0),
        total_budget: acc.total_budget + totalBudget,
        total_actual: acc.total_actual + totalActual,
        variance: acc.variance + variance
      };
    },
    {
      hours: 0,
      total_time_logged: 0,
      estimated_cost: 0,
      total_budget: 0,
      total_actual: 0,
      variance: 0
    }
  );
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
  async ({ projectId, groupBy, billableFilter }: { projectId: string; groupBy: GroupTypes; billableFilter?: BillableFilterType }) => {
    const response = await projectFinanceApiService.getProjectTasks(projectId, groupBy, billableFilter);
    return response.body;
  }
);

export const fetchProjectFinancesSilent = createAsyncThunk(
  'projectFinances/fetchProjectFinancesSilent',
  async ({ projectId, groupBy, billableFilter }: { projectId: string; groupBy: GroupTypes; billableFilter?: BillableFilterType }) => {
    const response = await projectFinanceApiService.getProjectTasks(projectId, groupBy, billableFilter);
    return response.body;
  }
);

export const fetchSubTasks = createAsyncThunk(
  'projectFinances/fetchSubTasks',
  async ({ projectId, parentTaskId, billableFilter }: { projectId: string; parentTaskId: string; billableFilter?: BillableFilterType }) => {
    const response = await projectFinanceApiService.getSubTasks(projectId, parentTaskId, billableFilter);
    return { parentTaskId, subTasks: response.body };
  }
);

export const updateTaskFixedCostAsync = createAsyncThunk(
  'projectFinances/updateTaskFixedCostAsync',
  async ({ taskId, groupId, fixedCost }: { taskId: string; groupId: string; fixedCost: number }) => {
    await projectFinanceApiService.updateTaskFixedCost(taskId, fixedCost);
    return { taskId, groupId, fixedCost };
  }
);

export const updateTaskFixedCostWithRecalculation = createAsyncThunk(
  'projectFinances/updateTaskFixedCostWithRecalculation',
  async ({ taskId, groupId, fixedCost, projectId, groupBy, billableFilter }: { 
    taskId: string; 
    groupId: string; 
    fixedCost: number; 
    projectId: string; 
    groupBy: GroupTypes; 
    billableFilter?: BillableFilterType; 
  }, { dispatch }) => {
    // Update the fixed cost
    await projectFinanceApiService.updateTaskFixedCost(taskId, fixedCost);
    
    // Trigger a silent refresh to get accurate calculations from backend
    dispatch(fetchProjectFinancesSilent({ projectId, groupBy, billableFilter }));
    
    return { taskId, groupId, fixedCost };
  }
);

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
    updateTaskFixedCost: (state, action: PayloadAction<{ taskId: string; groupId: string; fixedCost: number }>) => {
      const { taskId, groupId, fixedCost } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);
      
      if (group) {
        // Recursive function to find and update a task in the hierarchy
        const findAndUpdateTask = (tasks: IProjectFinanceTask[], targetId: string): boolean => {
          for (const task of tasks) {
            if (task.id === targetId) {
              task.fixed_cost = fixedCost;
              // Don't recalculate here - let the backend handle it and we'll refresh
              return true;
            }
            
            // Search in subtasks recursively
            if (task.sub_tasks && findAndUpdateTask(task.sub_tasks, targetId)) {
              return true;
            }
          }
          return false;
        };
        
        findAndUpdateTask(group.tasks, taskId);
      }
    },
    updateTaskEstimatedCost: (state, action: PayloadAction<{ taskId: string; groupId: string; estimatedCost: number }>) => {
      const { taskId, groupId, estimatedCost } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);
      
      if (group) {
        // Recursive function to find and update a task in the hierarchy
        const findAndUpdateTask = (tasks: IProjectFinanceTask[], targetId: string): boolean => {
          for (const task of tasks) {
            if (task.id === targetId) {
              task.estimated_cost = estimatedCost;
              // Recalculate task costs after updating estimated cost
              const { totalBudget, totalActual, variance } = calculateTaskCosts(task);
              task.total_budget = totalBudget;
              task.total_actual = totalActual;
              task.variance = variance;
              return true;
            }
            
            // Search in subtasks recursively
            if (task.sub_tasks && findAndUpdateTask(task.sub_tasks, targetId)) {
              return true;
            }
          }
          return false;
        };
        
        findAndUpdateTask(group.tasks, taskId);
      }
    },
    updateTaskTimeLogged: (state, action: PayloadAction<{ taskId: string; groupId: string; timeLoggedSeconds: number; timeLoggedString: string }>) => {
      const { taskId, groupId, timeLoggedSeconds, timeLoggedString } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);
      
      if (group) {
        // Recursive function to find and update a task in the hierarchy
        const findAndUpdateTask = (tasks: IProjectFinanceTask[], targetId: string): boolean => {
          for (const task of tasks) {
            if (task.id === targetId) {
              task.total_time_logged_seconds = timeLoggedSeconds;
              task.total_time_logged = timeLoggedString;
              // Recalculate task costs after updating time logged
              const { totalBudget, totalActual, variance } = calculateTaskCosts(task);
              task.total_budget = totalBudget;
              task.total_actual = totalActual;
              task.variance = variance;
              return true;
            }
            
            // Search in subtasks recursively
            if (task.sub_tasks && findAndUpdateTask(task.sub_tasks, targetId)) {
              return true;
            }
          }
          return false;
        };
        
        findAndUpdateTask(group.tasks, taskId);
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
    updateParentTaskCalculations: (state, action: PayloadAction<{ taskId: string; groupId: string }>) => {
      const { taskId, groupId } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);
      
      if (group) {
        // Recursive function to recalculate parent task totals
        const recalculateParentTotals = (tasks: IProjectFinanceTask[], targetId: string): boolean => {
          for (const task of tasks) {
            if (task.id === targetId) {
              // If this task has subtasks, recalculate its totals from subtasks
              if (task.sub_tasks && task.sub_tasks.length > 0) {
                const subtaskTotals = task.sub_tasks.reduce((acc, subtask) => ({
                  estimated_cost: acc.estimated_cost + (subtask.estimated_cost || 0),
                  fixed_cost: acc.fixed_cost + (subtask.fixed_cost || 0),
                  total_actual: acc.total_actual + (subtask.total_actual || 0),
                  estimated_seconds: acc.estimated_seconds + (subtask.estimated_seconds || 0),
                  total_time_logged_seconds: acc.total_time_logged_seconds + (subtask.total_time_logged_seconds || 0)
                }), {
                  estimated_cost: 0,
                  fixed_cost: 0,
                  total_actual: 0,
                  estimated_seconds: 0,
                  total_time_logged_seconds: 0
                });
                
                // Update parent task with aggregated values
                task.estimated_cost = subtaskTotals.estimated_cost;
                task.fixed_cost = subtaskTotals.fixed_cost;
                task.total_actual = subtaskTotals.total_actual;
                task.estimated_seconds = subtaskTotals.estimated_seconds;
                task.total_time_logged_seconds = subtaskTotals.total_time_logged_seconds;
                task.total_budget = task.estimated_cost + task.fixed_cost;
                task.variance = task.total_actual - task.total_budget;
              }
              return true;
            }
            
            // Search in subtasks recursively and recalculate if found
            if (task.sub_tasks && recalculateParentTotals(task.sub_tasks, targetId)) {
              // After updating subtask, recalculate this parent's totals
              if (task.sub_tasks && task.sub_tasks.length > 0) {
                const subtaskTotals = task.sub_tasks.reduce((acc, subtask) => ({
                  estimated_cost: acc.estimated_cost + (subtask.estimated_cost || 0),
                  fixed_cost: acc.fixed_cost + (subtask.fixed_cost || 0),
                  total_actual: acc.total_actual + (subtask.total_actual || 0),
                  estimated_seconds: acc.estimated_seconds + (subtask.estimated_seconds || 0),
                  total_time_logged_seconds: acc.total_time_logged_seconds + (subtask.total_time_logged_seconds || 0)
                }), {
                  estimated_cost: 0,
                  fixed_cost: 0,
                  total_actual: 0,
                  estimated_seconds: 0,
                  total_time_logged_seconds: 0
                });
                
                task.estimated_cost = subtaskTotals.estimated_cost;
                task.fixed_cost = subtaskTotals.fixed_cost;
                task.total_actual = subtaskTotals.total_actual;
                task.estimated_seconds = subtaskTotals.estimated_seconds;
                task.total_time_logged_seconds = subtaskTotals.total_time_logged_seconds;
                task.total_budget = task.estimated_cost + task.fixed_cost;
                task.variance = task.total_actual - task.total_budget;
              }
              return true;
            }
          }
          return false;
        };
        
        recalculateParentTotals(group.tasks, taskId);
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjectFinances.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProjectFinances.fulfilled, (state, action) => {
        state.loading = false;
        state.taskGroups = action.payload.groups;
        state.projectRateCards = action.payload.project_rate_cards;
        state.project = action.payload.project;
      })
      .addCase(fetchProjectFinances.rejected, (state) => {
        state.loading = false;
      })
      .addCase(fetchProjectFinancesSilent.fulfilled, (state, action) => {
        // Helper function to preserve expansion state and sub_tasks during updates
        const preserveExpansionState = (existingTasks: IProjectFinanceTask[], newTasks: IProjectFinanceTask[]): IProjectFinanceTask[] => {
          return newTasks.map(newTask => {
            const existingTask = existingTasks.find(t => t.id === newTask.id);
            if (existingTask) {
              // Preserve expansion state and subtasks
              const updatedTask = {
                ...newTask,
                show_sub_tasks: existingTask.show_sub_tasks,
                sub_tasks: existingTask.sub_tasks ? 
                  preserveExpansionState(existingTask.sub_tasks, newTask.sub_tasks || []) : 
                  newTask.sub_tasks
              };
              return updatedTask;
            }
            return newTask;
          });
        };

        // Update groups while preserving expansion state
        const updatedTaskGroups = action.payload.groups.map(newGroup => {
          const existingGroup = state.taskGroups.find(g => g.group_id === newGroup.group_id);
          if (existingGroup) {
            return {
              ...newGroup,
              tasks: preserveExpansionState(existingGroup.tasks, newGroup.tasks)
            };
          }
          return newGroup;
        });

        // Update data without changing loading state for silent refresh
        state.taskGroups = updatedTaskGroups;
        state.projectRateCards = action.payload.project_rate_cards;
        state.project = action.payload.project;
      })
      .addCase(updateTaskFixedCostAsync.fulfilled, (state, action) => {
        const { taskId, groupId, fixedCost } = action.payload;
        const group = state.taskGroups.find(g => g.group_id === groupId);
        
        if (group) {
          // Recursive function to find and update a task in the hierarchy
          const findAndUpdateTask = (tasks: IProjectFinanceTask[], targetId: string): boolean => {
            for (const task of tasks) {
              if (task.id === targetId) {
                task.fixed_cost = fixedCost;
                // Recalculate financial values immediately for UI responsiveness
                const totalBudget = (task.estimated_cost || 0) + fixedCost;
                const totalActual = task.total_actual || 0;
                const variance = totalActual - totalBudget;
                
                task.total_budget = totalBudget;
                task.variance = variance;
                return true;
              }
              
              // Search in subtasks recursively
              if (task.sub_tasks && findAndUpdateTask(task.sub_tasks, targetId)) {
                return true;
              }
            }
            return false;
          };
          
          findAndUpdateTask(group.tasks, taskId);
        }
      })
      .addCase(updateTaskFixedCostWithRecalculation.fulfilled, (state, action) => {
        const { taskId, groupId, fixedCost } = action.payload;
        const group = state.taskGroups.find(g => g.group_id === groupId);
        
        if (group) {
          // Recursive function to find and update a task in the hierarchy
          const findAndUpdateTask = (tasks: IProjectFinanceTask[], targetId: string): boolean => {
            for (const task of tasks) {
              if (task.id === targetId) {
                task.fixed_cost = fixedCost;
                // Immediate calculation for UI responsiveness
                const totalBudget = (task.estimated_cost || 0) + fixedCost;
                const totalActual = task.total_actual || 0;
                const variance = totalActual - totalBudget;
                
                task.total_budget = totalBudget;
                task.variance = variance;
                return true;
              }
              
              // Search in subtasks recursively
              if (task.sub_tasks && findAndUpdateTask(task.sub_tasks, targetId)) {
                return true;
              }
            }
            return false;
          };
          
          findAndUpdateTask(group.tasks, taskId);
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
                parent_task_id: targetId
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
            break;
          }
        }
      });
  },
});

export const { 
  setActiveTab, 
  setActiveGroup, 
  setBillableFilter,
  updateTaskFixedCost,
  updateTaskEstimatedCost,
  updateTaskTimeLogged,
  toggleTaskExpansion,
  updateProjectFinanceCurrency,
  updateParentTaskCalculations
} = projectFinancesSlice.actions;

export default projectFinancesSlice.reducer;
