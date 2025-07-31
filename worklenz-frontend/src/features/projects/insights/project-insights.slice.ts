import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type SegmentType = 'Overview' | 'Members' | 'Tasks';

type ProjectInsightsState = {
  initialized: boolean;
  loading: boolean;
  activeSegment: SegmentType;
  includeArchivedTasks: boolean;
  projectId: string;
};

const initialState: ProjectInsightsState = {
  initialized: false,
  loading: false,
  activeSegment: 'Overview',
  includeArchivedTasks: false,
  projectId: '',
};

const projectInsightsSlice = createSlice({
  name: 'projectInsights',
  initialState,
  reducers: {
    setActiveSegment: (state, action: PayloadAction<SegmentType>) => {
      state.activeSegment = action.payload;
    },
    setIncludeArchivedTasks: (state, action: PayloadAction<boolean>) => {
      state.includeArchivedTasks = action.payload;
    },
    setProjectId: (state, action: PayloadAction<string>) => {
      state.projectId = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setActiveSegment, setIncludeArchivedTasks, setLoading, setProjectId } =
  projectInsightsSlice.actions;
export default projectInsightsSlice.reducer;
