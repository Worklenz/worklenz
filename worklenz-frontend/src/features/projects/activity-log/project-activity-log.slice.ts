import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { projectActivityLogsApiService, IProjectActivityLog } from '../../../api/projects/project-activity-logs-api.service';

interface ProjectActivityLogState {
  logs: IProjectActivityLog[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  filterType: string;
  totalLogs: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  isItemLoaded: (index: number) => boolean;
}

const initialState: ProjectActivityLogState = {
  logs: [],
  loading: false,
  loadingMore: false,
  error: null,
  filterType: 'all',
  totalLogs: 0,
  currentPage: 1,
  pageSize: 20,
  hasNextPage: true,
  isItemLoaded: (index: number) => false,
};

export const fetchProjectActivityLogs = createAsyncThunk(
  'projectActivityLog/fetchLogs',
  async ({ 
    projectId, 
    page = 1, 
    size = 20, 
    filter = 'all',
    append = false
  }: { 
    projectId: string; 
    page?: number; 
    size?: number; 
    filter?: string; 
    append?: boolean;
  }) => {
    const response = await projectActivityLogsApiService.getActivityLogsByProjectId(projectId, page, size, filter);
    return { ...response.body, append, page };
  }
);

const projectActivityLogSlice = createSlice({
  name: 'projectActivityLog',
  initialState,
  reducers: {
    setFilterType: (state, action: PayloadAction<string>) => {
      state.filterType = action.payload;
      state.currentPage = 1;
      state.logs = [];
      state.hasNextPage = true;
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    clearLogs: (state) => {
      state.logs = [];
      state.totalLogs = 0;
      state.currentPage = 1;
      state.error = null;
      state.hasNextPage = true;
    },
    updateIsItemLoaded: (state) => {
      state.isItemLoaded = (index: number) => {
        return index < state.logs.length;
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjectActivityLogs.pending, (state, action) => {
        const { append } = action.meta.arg;
        if (append) {
          state.loadingMore = true;
        } else {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchProjectActivityLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        
        if (action.payload) {
          const { logs, pagination, append } = action.payload;
          
          if (logs && Array.isArray(logs)) {
            if (append) {
              state.logs = [...state.logs, ...logs];
            } else {
              state.logs = logs;
            }
            
            state.totalLogs = pagination?.total || 0;
            state.currentPage = pagination?.current || 1;
            state.hasNextPage = state.logs.length < state.totalLogs;
          }
        }
        
        state.isItemLoaded = (index: number) => index < state.logs.length;
      })
      .addCase(fetchProjectActivityLogs.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.error.message || 'Failed to fetch activity logs';
        if (!action.meta.arg.append) {
          state.logs = [];
          state.totalLogs = 0;
        }
      });
  },
});

export const { setFilterType, setCurrentPage, clearLogs, updateIsItemLoaded } = projectActivityLogSlice.actions;
export default projectActivityLogSlice.reducer;