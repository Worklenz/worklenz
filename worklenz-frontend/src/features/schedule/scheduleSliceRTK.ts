import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { scheduleApi } from '@/api/schedule/scheduleApi';
import { PickerType } from '@/types/schedule/schedule-v2.types';

/**
 * Interface for segment data containing all information about a project segment
 * including dates, hours, tasks, and member assignment
 */
interface SegmentData {
  id: string;
  segment_id?: string;
  segment_number?: number;
  memberId?: string;
  segmentId?: string;
  date_union?: {
    start: string;
    end: string;
  };
  total_hours?: number;
  task_count?: number;
  hours_per_day?: number;
  [key: string]: any; // Allow additional properties
}

interface WorkloadData {
  id: string;
  name: string;
  totalHours: number;
  allocatedHours: number;
  availableHours: number;
  utilizationPercent: number;
  projectCount: number;
  status: 'available' | 'normal' | 'fully-allocated' | 'overallocated';
  conflicts?: Array<{
    type: 'overallocation' | 'schedule-conflict';
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

interface UIState {
  isFullscreen: boolean;
  showWeekends: boolean;
  zoomLevel: number;
  viewMode: 'gantt' | 'list' | 'timeline';
  selectedTimeRange: 'day' | 'week' | 'month' | 'quarter';
  showCriticalPath: boolean;
  showDependencies: boolean;
  showMilestones: boolean;
  showBaseline: boolean;
  colorScheme: 'default' | 'priority' | 'status' | 'team';
}

interface ScheduleState {
  // UI State
  ui: UIState;

  // Core State
  isSettingsDrawerOpen: boolean;
  isScheduleDrawerOpen: boolean;
  workingDays: string[];
  workingHours: number;
  type: PickerType;
  date: Date;

  // Resource Management State
  selectedMemberId: string | null;
  selectedProjectId: string | null;
  selectedDate: string | null;
  selectedDateRange: { start: string | null; end: string | null } | null;
  selectedSegmentData: SegmentData | null; // Store complete segment data with proper typing
  workloadData: WorkloadData[];

  // Filters and Search
  searchTerm: string;
  selectedProjects: string[];
  selectedMembers: string[];
  statusFilter: string[];

  // Cache and Performance
  lastRefresh: number;
  optimisticUpdates: Record<string, any>;
}

const initialUIState: UIState = {
  isFullscreen: false,
  showWeekends: true,
  zoomLevel: 1,
  viewMode: 'gantt',
  selectedTimeRange: 'month',
  showCriticalPath: false,
  showDependencies: true,
  showMilestones: true,
  showBaseline: false,
  colorScheme: 'default',
};

const initialState: ScheduleState = {
  ui: initialUIState,
  isSettingsDrawerOpen: false,
  isScheduleDrawerOpen: false,
  workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  workingHours: 8,
  type: 'month',
  date: new Date(),
  selectedMemberId: null,
  selectedProjectId: null,
  selectedDate: null,
  selectedDateRange: null,
  selectedSegmentData: null, // Store complete segment data
  workloadData: [],
  searchTerm: '',
  selectedProjects: [],
  selectedMembers: [],
  statusFilter: [],
  lastRefresh: 0,
  optimisticUpdates: {},
};

const scheduleSlice = createSlice({
  name: 'scheduleRTK',
  initialState,
  reducers: {
    // UI Actions
    toggleFullscreen: state => {
      state.ui.isFullscreen = !state.ui.isFullscreen;
    },

    setShowWeekends: (state, action: PayloadAction<boolean>) => {
      state.ui.showWeekends = action.payload;
    },

    setZoomLevel: (state, action: PayloadAction<number>) => {
      state.ui.zoomLevel = Math.max(0.5, Math.min(2, action.payload));
    },

    setViewMode: (state, action: PayloadAction<'gantt' | 'list' | 'timeline'>) => {
      state.ui.viewMode = action.payload;
    },

    setTimeRange: (state, action: PayloadAction<'day' | 'week' | 'month' | 'quarter'>) => {
      state.ui.selectedTimeRange = action.payload;
    },

    toggleCriticalPath: state => {
      state.ui.showCriticalPath = !state.ui.showCriticalPath;
    },

    toggleDependencies: state => {
      state.ui.showDependencies = !state.ui.showDependencies;
    },

    toggleMilestones: state => {
      state.ui.showMilestones = !state.ui.showMilestones;
    },

    toggleBaseline: state => {
      state.ui.showBaseline = !state.ui.showBaseline;
    },

    setColorScheme: (state, action: PayloadAction<'default' | 'priority' | 'status' | 'team'>) => {
      state.ui.colorScheme = action.payload;
    },

    // Core Actions
    toggleSettingsDrawer: state => {
      state.isSettingsDrawerOpen = !state.isSettingsDrawerOpen;
    },

    /**
     * Toggle the schedule drawer open/closed state
     * Clears segment data when drawer is being closed to reset state
     */
    toggleScheduleDrawer: state => {
      // Clear segment data when drawer is being closed
      if (state.isScheduleDrawerOpen) {
        state.selectedSegmentData = null;
      }
      state.isScheduleDrawerOpen = !state.isScheduleDrawerOpen;
    },

    setDate: (state, action: PayloadAction<Date>) => {
      state.date = action.payload;
    },

    setType: (state, action: PayloadAction<PickerType>) => {
      state.type = action.payload;
    },

    setSelectedMember: (state, action: PayloadAction<string | null>) => {
      state.selectedMemberId = action.payload;
    },

    setSelectedProject: (state, action: PayloadAction<string | null>) => {
      state.selectedProjectId = action.payload;
    },

    /**
     * Set the selected segment data for the schedule drawer
     * This stores complete segment information including dates, hours, and tasks
     */
    setSelectedSegmentData: (state, action: PayloadAction<SegmentData | null>) => {
      state.selectedSegmentData = action.payload;
    },

    setSelectedDate: (state, action: PayloadAction<string | null>) => {
      state.selectedDate = action.payload;
    },

    setSelectedDateRange: (
      state,
      action: PayloadAction<{ start: string | null; end: string | null } | null>
    ) => {
      state.selectedDateRange = action.payload;
    },

    // Filter Actions
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
    },

    setSelectedProjects: (state, action: PayloadAction<string[]>) => {
      state.selectedProjects = action.payload;
    },

    setSelectedMembers: (state, action: PayloadAction<string[]>) => {
      state.selectedMembers = action.payload;
    },

    setStatusFilter: (state, action: PayloadAction<string[]>) => {
      state.statusFilter = action.payload;
    },

    // Optimistic Updates
    addOptimisticUpdate: (state, action: PayloadAction<{ id: string; data: any }>) => {
      state.optimisticUpdates[action.payload.id] = action.payload.data;
    },

    removeOptimisticUpdate: (state, action: PayloadAction<string>) => {
      delete state.optimisticUpdates[action.payload];
    },

    clearOptimisticUpdates: state => {
      state.optimisticUpdates = {};
    },

    // Bulk UI Updates
    updateUISettings: (state, action: PayloadAction<Partial<UIState>>) => {
      state.ui = { ...state.ui, ...action.payload };
    },

    resetUISettings: state => {
      state.ui = initialUIState;
    },

    // Performance
    updateLastRefresh: state => {
      state.lastRefresh = Date.now();
    },
  },

  extraReducers: builder => {
    // Listen to RTK Query fulfillments for auto-refresh
    builder
      .addMatcher(scheduleApi.endpoints.fetchScheduleSettings.matchFulfilled, (state, action) => {
        if (action.payload?.body) {
          const settings = action.payload.body;
          state.workingDays = settings.workingDays || state.workingDays;
          state.workingHours = settings.workingHours || state.workingHours;
          state.lastRefresh = Date.now();
        }
      })
      .addMatcher(scheduleApi.endpoints.fetchMemberWorkload.matchFulfilled, (state, action) => {
        if (action.payload?.body) {
          state.workloadData = action.payload.body || [];
          state.lastRefresh = Date.now();
          // Clear related optimistic updates
          Object.keys(state.optimisticUpdates)
            .filter(key => key.startsWith('workload_'))
            .forEach(key => delete state.optimisticUpdates[key]);
        }
      })
      .addMatcher(
        scheduleApi.endpoints.updateResourceAllocation.matchPending,
        (state, action: any) => {
          // Add optimistic update
          if (action.meta?.arg) {
            const { memberId, projectId, allocatedHours } = action.meta.arg;
            state.optimisticUpdates[`allocation_${memberId}_${projectId}`] = {
              memberId,
              projectId,
              allocatedHours,
              timestamp: Date.now(),
            };
          }
        }
      )
      .addMatcher(
        scheduleApi.endpoints.updateResourceAllocation.matchFulfilled,
        (state, action: any) => {
          if (action.meta?.arg) {
            const { memberId, projectId } = action.meta.arg;
            delete state.optimisticUpdates[`allocation_${memberId}_${projectId}`];
          }
          state.lastRefresh = Date.now();
        }
      )
      .addMatcher(
        scheduleApi.endpoints.updateResourceAllocation.matchRejected,
        (state, action: any) => {
          if (action.meta?.arg) {
            const { memberId, projectId } = action.meta.arg;
            delete state.optimisticUpdates[`allocation_${memberId}_${projectId}`];
          }
        }
      )
      .addMatcher(scheduleApi.endpoints.rebalanceWorkload.matchFulfilled, (state, action) => {
        // Clear all workload-related optimistic updates after rebalancing
        Object.keys(state.optimisticUpdates)
          .filter(key => key.startsWith('workload_') || key.startsWith('allocation_'))
          .forEach(key => delete state.optimisticUpdates[key]);
        state.lastRefresh = Date.now();
      });
  },
});

export const {
  // UI Actions
  toggleFullscreen,
  setShowWeekends,
  setZoomLevel,
  setViewMode,
  setTimeRange,
  toggleCriticalPath,
  toggleDependencies,
  toggleMilestones,
  toggleBaseline,
  setColorScheme,

  // Core Actions
  toggleSettingsDrawer,
  toggleScheduleDrawer,
  setDate,
  setType,
  setSelectedMember,
  setSelectedProject,
  setSelectedSegmentData,
  setSelectedDate,
  setSelectedDateRange,

  // Filter Actions
  setSearchTerm,
  setSelectedProjects,
  setSelectedMembers,
  setStatusFilter,

  // Optimistic Updates
  addOptimisticUpdate,
  removeOptimisticUpdate,
  clearOptimisticUpdates,

  // Bulk Updates
  updateUISettings,
  resetUISettings,
  updateLastRefresh,
} = scheduleSlice.actions;

export default scheduleSlice.reducer;

// Selectors with proper typing
export const selectUIState = (state: { schedule: ScheduleState }) => state.schedule.ui;
export const selectIsFullscreen = (state: { schedule: ScheduleState }) =>
  state.schedule.ui.isFullscreen;
export const selectZoomLevel = (state: { schedule: ScheduleState }) => state.schedule.ui.zoomLevel;
export const selectShowWeekends = (state: { schedule: ScheduleState }) =>
  state.schedule.ui.showWeekends;
export const selectViewMode = (state: { schedule: ScheduleState }) => state.schedule.ui.viewMode;
export const selectOptimisticUpdates = (state: { schedule: ScheduleState }) =>
  state.schedule.optimisticUpdates;
export const selectWorkloadData = (state: { schedule: ScheduleState }) =>
  state.schedule.workloadData;
export const selectSelectedMemberId = (state: { schedule: ScheduleState }) =>
  state.schedule.selectedMemberId;
export const selectSelectedProjectId = (state: { schedule: ScheduleState }) =>
  state.schedule.selectedProjectId;
export const selectSelectedSegmentData = (state: { schedule: ScheduleState }) =>
  state.schedule.selectedSegmentData;
export const selectSelectedDate = (state: { schedule: ScheduleState }) =>
  state.schedule.selectedDate;
export const selectSelectedDateRange = (state: { schedule: ScheduleState }) =>
  state.schedule.selectedDateRange;
export const selectFilters = (state: { schedule: ScheduleState }) => ({
  searchTerm: state.schedule.searchTerm,
  selectedProjects: state.schedule.selectedProjects,
  selectedMembers: state.schedule.selectedMembers,
  statusFilter: state.schedule.statusFilter,
});

// Export types for use in components
export type { ScheduleState, UIState, WorkloadData, SegmentData };
