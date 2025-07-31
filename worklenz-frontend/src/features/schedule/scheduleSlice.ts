import { scheduleAPIService } from '@/api/schedule/schedule.api.service';
import { PickerType, ScheduleData } from '@/types/schedule/schedule-v2.types';
import logger from '@/utils/errorLogger';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

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
} = scheduleSlice.actions;
export default scheduleSlice.reducer;
