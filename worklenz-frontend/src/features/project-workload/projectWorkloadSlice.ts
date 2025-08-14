import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import dayjs from 'dayjs';

interface IWorkloadFilters {
  memberIds?: string[];
  teamIds?: string[];
  showOverallocated?: boolean;
  showUnderutilized?: boolean;
  taskStatuses?: string[];
  taskPriorities?: string[];
}

interface IDateRange {
  startDate: string;
  endDate: string;
}

interface IWorkloadState {
  workloadView: 'chart' | 'calendar' | 'table';
  dateRange: IDateRange;
  filters: IWorkloadFilters;
  selectedMemberId: string | null;
  capacityUnit: 'hours' | 'points';
  timeScale: 'day' | 'week' | 'month';
  showWeekends: boolean;
  alertThresholds: {
    overallocation: number;
    underutilization: number;
  };
}

const initialState: IWorkloadState = {
  workloadView: 'chart',
  dateRange: {
    startDate: dayjs().startOf('week').format('YYYY-MM-DD'),
    endDate: dayjs().endOf('week').add(3, 'weeks').format('YYYY-MM-DD'),
  },
  filters: {
    showOverallocated: false,
    showUnderutilized: false,
  },
  selectedMemberId: null,
  capacityUnit: 'hours',
  timeScale: 'week',
  showWeekends: false,
  alertThresholds: {
    overallocation: 100,
    underutilization: 50,
  },
};

const projectWorkloadSlice = createSlice({
  name: 'projectWorkload',
  initialState,
  reducers: {
    setWorkloadView: (state, action: PayloadAction<'chart' | 'calendar' | 'table'>) => {
      state.workloadView = action.payload;
    },
    setDateRange: (state, action: PayloadAction<IDateRange>) => {
      state.dateRange = action.payload;
    },
    setFilters: (state, action: PayloadAction<IWorkloadFilters>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    setSelectedMember: (state, action: PayloadAction<string | null>) => {
      state.selectedMemberId = action.payload;
    },
    setCapacityUnit: (state, action: PayloadAction<'hours' | 'points'>) => {
      state.capacityUnit = action.payload;
    },
    setTimeScale: (state, action: PayloadAction<'day' | 'week' | 'month'>) => {
      state.timeScale = action.payload;
    },
    toggleWeekends: (state) => {
      state.showWeekends = !state.showWeekends;
    },
    setAlertThresholds: (state, action: PayloadAction<{ overallocation?: number; underutilization?: number }>) => {
      state.alertThresholds = { ...state.alertThresholds, ...action.payload };
    },
    resetWorkloadState: () => initialState,
  },
});

export const {
  setWorkloadView,
  setDateRange,
  setFilters,
  clearFilters,
  setSelectedMember,
  setCapacityUnit,
  setTimeScale,
  toggleWeekends,
  setAlertThresholds,
  resetWorkloadState,
} = projectWorkloadSlice.actions;

export default projectWorkloadSlice.reducer;