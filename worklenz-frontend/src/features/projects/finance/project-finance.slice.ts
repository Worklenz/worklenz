import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IProjectFinanceGroup, IProjectFinanceTask, IProjectRateCard } from '@/types/project/project-finance.types';

type FinanceTabType = 'finance' | 'ratecard';
type GroupTypes = 'status' | 'priority' | 'phases';

interface ProjectFinanceState {
  activeTab: FinanceTabType;
  activeGroup: GroupTypes;
  loading: boolean;
  taskGroups: IProjectFinanceGroup[];
  projectRateCards: IProjectRateCard[];
}

// Utility functions for frontend calculations
const minutesToHours = (minutes: number) => minutes / 60;

const calculateTaskCosts = (task: IProjectFinanceTask) => {
  const hours = minutesToHours(task.estimated_hours || 0);
  const timeLoggedHours = minutesToHours(task.total_time_logged || 0);
  const fixedCost = task.fixed_cost || 0;
  
  // Calculate total budget (estimated hours * rate + fixed cost)
  const totalBudget = task.estimated_cost + fixedCost;
  
  // Calculate total actual (time logged * rate + fixed cost)
  const totalActual = task.total_actual || 0;
  
  // Calculate variance (total actual - total budget)
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
  loading: false,
  taskGroups: [],
  projectRateCards: [],
};

export const fetchProjectFinances = createAsyncThunk(
  'projectFinances/fetchProjectFinances',
  async ({ projectId, groupBy }: { projectId: string; groupBy: GroupTypes }) => {
    const response = await projectFinanceApiService.getProjectTasks(projectId, groupBy);
    return response.body;
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
    updateTaskFixedCost: (state, action: PayloadAction<{ taskId: string; groupId: string; fixedCost: number }>) => {
      const { taskId, groupId, fixedCost } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);
      if (group) {
        const task = group.tasks.find(t => t.id === taskId);
        if (task) {
          task.fixed_cost = fixedCost;
          // Recalculate task costs after updating fixed cost
          const { totalBudget, totalActual, variance } = calculateTaskCosts(task);
          task.total_budget = totalBudget;
          task.total_actual = totalActual;
          task.variance = variance;
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
    updateTaskTimeLogged: (state, action: PayloadAction<{ taskId: string; groupId: string; timeLogged: number }>) => {
      const { taskId, groupId, timeLogged } = action.payload;
      const group = state.taskGroups.find(g => g.group_id === groupId);
      if (group) {
        const task = group.tasks.find(t => t.id === taskId);
        if (task) {
          task.total_time_logged = timeLogged;
          // Recalculate task costs after updating time logged
          const { totalBudget, totalActual, variance } = calculateTaskCosts(task);
          task.total_budget = totalBudget;
          task.total_actual = totalActual;
          task.variance = variance;
        }
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
      })
      .addCase(fetchProjectFinances.rejected, (state) => {
        state.loading = false;
      })
      .addCase(updateTaskFixedCostAsync.fulfilled, (state, action) => {
        const { taskId, groupId, fixedCost } = action.payload;
        const group = state.taskGroups.find(g => g.group_id === groupId);
        if (group) {
          const task = group.tasks.find(t => t.id === taskId);
          if (task) {
            task.fixed_cost = fixedCost;
            // Recalculate task costs after updating fixed cost
            const { totalBudget, totalActual, variance } = calculateTaskCosts(task);
            task.total_budget = totalBudget;
            task.total_actual = totalActual;
            task.variance = variance;
          }
        }
      });
  },
});

export const { 
  setActiveTab, 
  setActiveGroup, 
  updateTaskFixedCost,
  updateTaskEstimatedCost,
  updateTaskTimeLogged
} = projectFinancesSlice.actions;

export default projectFinancesSlice.reducer;
