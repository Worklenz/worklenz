import { scheduleAPIService } from '@/api/schedule/schedule.api.service';
import { PickerType, ScheduleData } from '@/types/schedule/schedule-v2.types';
import logger from '@/utils/errorLogger';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

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

interface scheduleState {
  isSettingsDrawerOpen: boolean;
  isScheduleDrawerOpen: boolean;
  workingDays: string[];
  workingHours: number;
  teamData: any[];
  dateList: any;
  loading: boolean;
  error: string | null;
  type: PickerType;
  date: Date;
  dayCount: number;
  // Resource Management State
  workloadData: WorkloadData[];
  selectedMemberId: string | null;
  capacityReport: any;
  resourceConflicts: any[];
  allocationLoading: boolean;
  rebalanceLoading: boolean;
}

const initialState: scheduleState = {
  isSettingsDrawerOpen: false,
  isScheduleDrawerOpen: false,
  workingDays: [],
  workingHours: 8,
  teamData: [],
  dateList: {},
  loading: false,
  error: null,
  type: 'month',
  date: new Date(),
  dayCount: 0,
  // Resource Management Initial State
  workloadData: [],
  selectedMemberId: null,
  capacityReport: null,
  resourceConflicts: [],
  allocationLoading: false,
  rebalanceLoading: false,
};

export const fetchTeamData = createAsyncThunk('schedule/fetchTeamData', async () => {
  const response = await scheduleAPIService.fetchScheduleMembers();
  if (!response.done) {
    throw new Error('Failed to fetch team data');
  }
  const data = response.body;
  return data;
});

export const fetchDateList = createAsyncThunk(
  'schedule/fetchDateList',
  async ({ date, type }: { date: Date; type: string }) => {
    const response = await scheduleAPIService.fetchScheduleDates({
      date: date.toISOString(),
      type,
    });
    if (!response.done) {
      throw new Error('Failed to fetch date list');
    }
    const data = response.body;
    return data;
  }
);

export const updateWorking = createAsyncThunk(
  'schedule/updateWorking',
  async ({ workingDays, workingHours }: { workingDays: string[]; workingHours: number }) => {
    const response = await scheduleAPIService.updateScheduleSettings({ workingDays, workingHours });
    if (!response.done) {
      throw new Error('Failed to fetch date list');
    }
    const data = response.body;
    return data;
  }
);

export const getWorking = createAsyncThunk(
  'schedule/getWorking',
  async (_, { rejectWithValue }) => {
    try {
      const response = await scheduleAPIService.fetchScheduleSettings();
      if (!response.done) {
        throw new Error('Failed to fetch date list');
      }
      return response;
    } catch (error) {
      logger.error('getWorking', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to getWorking');
    }
  }
);

export const fetchMemberProjects = createAsyncThunk(
  'schedule/fetchMemberProjects',
  async ({ id }: { id: string }) => {
    const response = await scheduleAPIService.fetchMemberProjects({ id });
    if (!response.done) {
      throw new Error('Failed to fetch date list');
    }
    const data = response.body;
    return data;
  }
);

export const createSchedule = createAsyncThunk(
  'schedule/createSchedule',
  async ({ schedule }: { schedule: ScheduleData }) => {
    const response = await scheduleAPIService.submitScheduleData({ schedule });
    if (!response.done) {
      throw new Error('Failed to fetch date list');
    }
    const data = response.body;
    return data;
  }
);

// Resource Management Async Thunks
export const fetchMemberWorkload = createAsyncThunk(
  'schedule/fetchMemberWorkload',
  async ({
    memberId,
    startDate,
    endDate,
  }: {
    memberId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await scheduleAPIService.fetchMemberWorkload({ memberId, startDate, endDate });
    if (!response.done) {
      throw new Error('Failed to fetch workload data');
    }
    return response.body;
  }
);

export const updateResourceAllocation = createAsyncThunk(
  'schedule/updateResourceAllocation',
  async ({
    memberId,
    projectId,
    allocatedHours,
    startDate,
    endDate,
  }: {
    memberId: string;
    projectId: string;
    allocatedHours: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await scheduleAPIService.updateResourceAllocation({
      memberId,
      projectId,
      allocatedHours,
      startDate,
      endDate,
    });
    if (!response.done) {
      throw new Error('Failed to update resource allocation');
    }
    return response.body;
  }
);

export const rebalanceWorkload = createAsyncThunk(
  'schedule/rebalanceWorkload',
  async ({
    memberIds,
    strategy = 'even',
    maxUtilization = 100,
  }: {
    memberIds?: string[];
    strategy?: 'even' | 'skills' | 'priority';
    maxUtilization?: number;
  }) => {
    const response = await scheduleAPIService.rebalanceWorkload({
      memberIds,
      strategy,
      maxUtilization,
    });
    if (!response.done) {
      throw new Error('Failed to rebalance workload');
    }
    return response.body;
  }
);

export const fetchCapacityReport = createAsyncThunk(
  'schedule/fetchCapacityReport',
  async ({
    startDate,
    endDate,
    teamId,
  }: {
    startDate: string;
    endDate: string;
    teamId?: string;
  }) => {
    const response = await scheduleAPIService.fetchCapacityReport({ startDate, endDate, teamId });
    if (!response.done) {
      throw new Error('Failed to fetch capacity report');
    }
    return response.body;
  }
);

export const fetchResourceConflicts = createAsyncThunk(
  'schedule/fetchResourceConflicts',
  async () => {
    const response = await scheduleAPIService.fetchResourceConflicts();
    if (!response.done) {
      throw new Error('Failed to fetch resource conflicts');
    }
    return response.body;
  }
);

const scheduleSlice = createSlice({
  name: 'scheduleReducer',
  initialState,
  reducers: {
    toggleSettingsDrawer: state => {
      state.isSettingsDrawerOpen = !state.isSettingsDrawerOpen;
    },
    updateSettings(state, action) {
      state.workingDays = action.payload.workingDays;
      state.workingHours = action.payload.workingHours;
    },
    toggleScheduleDrawer: state => {
      state.isScheduleDrawerOpen = !state.isScheduleDrawerOpen;
    },
    getWorkingSettings(state, action) {
      state.workingDays = action.payload.workingDays;
      state.workingHours = action.payload.workingHours;
    },
    setDate(state, action) {
      state.date = action.payload;
    },
    setType(state, action) {
      state.type = action.payload;
    },
    setDayCount(state, action) {
      state.dayCount = action.payload;
    },
    // Resource Management Reducers
    setSelectedMember(state, action) {
      state.selectedMemberId = action.payload;
    },
    clearWorkloadData(state) {
      state.workloadData = [];
    },
    updateMemberAllocation(state, action) {
      const { memberId, projectId, allocatedHours } = action.payload;
      const member = state.workloadData.find(m => m.id === memberId);
      if (member) {
        member.allocatedHours = allocatedHours;
        member.availableHours = member.totalHours - allocatedHours;
        member.utilizationPercent = (allocatedHours / member.totalHours) * 100;

        // Update status based on utilization
        if (member.utilizationPercent > 100) member.status = 'overallocated';
        else if (member.utilizationPercent === 100) member.status = 'fully-allocated';
        else if (member.utilizationPercent >= 75) member.status = 'normal';
        else member.status = 'available';
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchTeamData.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeamData.fulfilled, (state, action) => {
        state.teamData = action.payload;
        state.loading = false;
      })
      .addCase(fetchTeamData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch team data';
      })
      .addCase(fetchDateList.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDateList.fulfilled, (state, action) => {
        state.dateList = action.payload;
        state.dayCount = (action.payload as any)?.date_data[0]?.days?.length;
        state.loading = false;
      })
      .addCase(fetchDateList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch date list';
      })
      .addCase(updateWorking.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateWorking.fulfilled, (state, action) => {
        state.workingDays = action.payload.workingDays;
        state.workingHours = action.payload.workingHours;
        state.loading = false;
      })
      .addCase(updateWorking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch date list';
      })
      .addCase(getWorking.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getWorking.fulfilled, (state, action) => {
        state.workingDays = action.payload.body.workingDays;
        state.workingHours = action.payload.body.workingHours;
        state.loading = false;
      })
      .addCase(getWorking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch list';
      })
      .addCase(fetchMemberProjects.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMemberProjects.fulfilled, (state, action) => {
        const data = action.payload;

        state.teamData.find((team: any) => {
          if (team.id === data.id) {
            team.projects = data.projects || [];
          }
        });
        state.loading = false;
      })
      .addCase(fetchMemberProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch date list';
      })
      .addCase(createSchedule.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createSchedule.fulfilled, (state, action) => {
        state.loading = false;
      })
      .addCase(createSchedule.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to send schedule';
      })
      // Resource Management Extra Reducers
      .addCase(fetchMemberWorkload.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMemberWorkload.fulfilled, (state, action) => {
        state.workloadData = action.payload;
        state.loading = false;
      })
      .addCase(fetchMemberWorkload.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch workload data';
      })
      .addCase(updateResourceAllocation.pending, state => {
        state.allocationLoading = true;
        state.error = null;
      })
      .addCase(updateResourceAllocation.fulfilled, (state, action) => {
        state.allocationLoading = false;
        // Update the local state with the new allocation
        // This will be handled by the updateMemberAllocation reducer
      })
      .addCase(updateResourceAllocation.rejected, (state, action) => {
        state.allocationLoading = false;
        state.error = action.error.message || 'Failed to update allocation';
      })
      .addCase(rebalanceWorkload.pending, state => {
        state.rebalanceLoading = true;
        state.error = null;
      })
      .addCase(rebalanceWorkload.fulfilled, (state, action) => {
        state.rebalanceLoading = false;
        // Refresh workload data after rebalancing
        if (action.payload.workloadData) {
          state.workloadData = action.payload.workloadData;
        }
      })
      .addCase(rebalanceWorkload.rejected, (state, action) => {
        state.rebalanceLoading = false;
        state.error = action.error.message || 'Failed to rebalance workload';
      })
      .addCase(fetchCapacityReport.pending, state => {
        state.loading = true;
      })
      .addCase(fetchCapacityReport.fulfilled, (state, action) => {
        state.capacityReport = action.payload;
        state.loading = false;
      })
      .addCase(fetchCapacityReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch capacity report';
      })
      .addCase(fetchResourceConflicts.pending, state => {
        state.loading = true;
      })
      .addCase(fetchResourceConflicts.fulfilled, (state, action) => {
        state.resourceConflicts = action.payload;
        state.loading = false;
      })
      .addCase(fetchResourceConflicts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch resource conflicts';
      });
  },
});

export const {
  toggleSettingsDrawer,
  updateSettings,
  toggleScheduleDrawer,
  getWorkingSettings,
  setDate,
  setType,
  setDayCount,
  setSelectedMember,
  clearWorkloadData,
  updateMemberAllocation,
} = scheduleSlice.actions;
export default scheduleSlice.reducer;
