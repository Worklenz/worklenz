import { reportingMembersApiService } from '@/api/reporting/reporting-members.api.service';
import { durations } from '@/shared/constants';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

type MembersReportsState = {
  isMembersReportsDrawerOpen: boolean;
  isMembersOverviewTasksStatsDrawerOpen: boolean;
  isMembersOverviewProjectsStatsDrawerOpen: boolean;
  activeTab: 'overview' | 'timeLogs' | 'activityLogs' | 'tasks';
  total: number;
  membersList: any[];
  isLoading: boolean;
  error: string | null;

  // filters
  archived: boolean;
  searchQuery: string;
  index: number;
  pageSize: number;
  field: string;
  order: string;
  duration: string;
  dateRange: string;
};

const initialState: MembersReportsState = {
  isMembersReportsDrawerOpen: false,
  isMembersOverviewTasksStatsDrawerOpen: false,
  isMembersOverviewProjectsStatsDrawerOpen: false,
  activeTab: 'overview',
  total: 0,
  membersList: [],
  isLoading: false,
  error: null,

  // filters
  archived: false,
  searchQuery: '',
  index: 1,
  pageSize: 10,
  field: 'name',
  order: 'asc',
  duration: durations[1].key,
  dateRange: '',
};

export const fetchMembersData = createAsyncThunk(
  'membersReports/fetchMembersData',
  async ({ duration, dateRange }: { duration: string; dateRange: string[] }, { getState }) => {
    const state = (getState() as any).membersReportsReducer;
    const body = {
      index: state.index,
      size: state.pageSize,
      field: state.field,
      order: state.order,
      search: state.searchQuery,
      archived: state.archived,
      duration: duration || state.duration,
      date_range: dateRange || state.dateRange,
    };
    const response = await reportingMembersApiService.getMembers(body);
    return response.body;
  }
);

const membersReportsSlice = createSlice({
  name: 'membersReportsReducer',
  initialState,
  reducers: {
    toggleMembersReportsDrawer: state => {
      state.isMembersReportsDrawerOpen = !state.isMembersReportsDrawerOpen;
    },
    toggleMembersOverviewTasksStatsDrawer: state => {
      state.isMembersOverviewTasksStatsDrawerOpen = !state.isMembersOverviewTasksStatsDrawerOpen;
    },
    toggleMembersOverviewProjectsStatsDrawer: state => {
      state.isMembersOverviewProjectsStatsDrawerOpen =
        !state.isMembersOverviewProjectsStatsDrawerOpen;
    },
    setMemberReportingDrawerActiveTab: (
      state,
      action: PayloadAction<'overview' | 'timeLogs' | 'activityLogs' | 'tasks'>
    ) => {
      state.activeTab = action.payload;
    },
    setArchived: (state, action) => {
      state.archived = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setIndex: (state, action) => {
      state.index = action.payload;
    },
    setPageSize: (state, action) => {
      state.pageSize = action.payload;
    },
    setField: (state, action) => {
      state.field = action.payload;
    },
    setOrder: (state, action) => {
      state.order = action.payload;
    },
    setDuration: (state, action) => {
      state.duration = action.payload;
    },
    setDateRange: (state, action) => {
      state.dateRange = action.payload;
    },
    setPagination: (state, action) => {
      state.index = action.payload.index;
      state.pageSize = action.payload.pageSize;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchMembersData.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMembersData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.membersList = action.payload.members || [];
        state.total = action.payload.total || 0;
      })
      .addCase(fetchMembersData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch members data';
      });
  },
});

export const {
  toggleMembersReportsDrawer,
  toggleMembersOverviewTasksStatsDrawer,
  toggleMembersOverviewProjectsStatsDrawer,
  setMemberReportingDrawerActiveTab,
  setArchived,
  setSearchQuery,
  setIndex,
  setPageSize,
  setField,
  setOrder,
  setDuration,
  setDateRange,
  setPagination,
} = membersReportsSlice.actions;
export default membersReportsSlice.reducer;
