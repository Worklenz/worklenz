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
        const task = group.tasks.find(t => t.id === taskId);
        if (task) {
          task.fixed_cost = fixedCost;
          // Don't recalculate here - let the backend handle it and we'll refresh
        }
      }
    },
    updateTaskEstimatedCost: (state, action: PayloadAction<{ taskId: string; groupId: string; estimatedCost: number }>) => {
      const { taskId, groupId, estimatedCost } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);
      if (group) {
        const task = group.tasks.find(t => t.id === taskId);
        if (task) {
          task.estimated_cost = estimatedCost;
          // Recalculate task costs after updating estimated cost
          const { totalBudget, totalActual, variance } = calculateTaskCosts(task);
          task.total_budget = totalBudget;
          task.total_actual = totalActual;
          task.variance = variance;
        }
      }
    },
    updateTaskTimeLogged: (state, action: PayloadAction<{ taskId: string; groupId: string; timeLoggedSeconds: number; timeLoggedString: string }>) => {
      const { taskId, groupId, timeLoggedSeconds, timeLoggedString } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);
      if (group) {
        const task = group.tasks.find(t => t.id === taskId);
        if (task) {
          task.total_time_logged_seconds = timeLoggedSeconds;
          task.total_time_logged = timeLoggedString;
          // Recalculate task costs after updating time logged
          const { totalBudget, totalActual, variance } = calculateTaskCosts(task);
          task.total_budget = totalBudget;
          task.total_actual = totalActual;
          task.variance = variance;
        }
      }
    },
    toggleTaskExpansion: (state, action: PayloadAction<{ taskId: string; groupId: string }>) => {
      const { taskId, groupId } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);
      if (group) {
        const task = group.tasks.find(t => t.id === taskId);
        if (task) {
          task.show_sub_tasks = !task.show_sub_tasks;
        }
      }
    },
    updateProjectFinanceCurrency: (state, action: PayloadAction<string>) => {
      if (state.project) {
        state.project.currency = action.payload;
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
        // Update data without changing loading state for silent refresh
        state.taskGroups = action.payload.groups;
        state.projectRateCards = action.payload.project_rate_cards;
        state.project = action.payload.project;
      })
      .addCase(updateTaskFixedCostAsync.fulfilled, (state, action) => {
        const { taskId, groupId, fixedCost } = action.payload;
        const group = state.taskGroups.find(g => g.group_id === groupId);
        if (group) {
          const task = group.tasks.find(t => t.id === taskId);
          if (task) {
            task.fixed_cost = fixedCost;
            // Don't recalculate here - trigger a refresh instead for accuracy
          }
        }
      })
      .addCase(fetchSubTasks.fulfilled, (state, action) => {
        const { parentTaskId, subTasks } = action.payload;
        // Find the parent task in any group and add the subtasks
        for (const group of state.taskGroups) {
          const parentTask = group.tasks.find(t => t.id === parentTaskId);
          if (parentTask) {
            parentTask.sub_tasks = subTasks.map(subTask => ({
              ...subTask,
              is_sub_task: true,
              parent_task_id: parentTaskId
            }));
            parentTask.show_sub_tasks = true;
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
  updateProjectFinanceCurrency
} = projectFinancesSlice.actions;

export default projectFinancesSlice.reducer;
