import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProjectGroupBy, ProjectViewType } from '@/types/project/project.types';

interface ProjectViewState {
  mode: ProjectViewType;
  groupBy: ProjectGroupBy;
  lastUpdated?: string;
}

const LOCAL_STORAGE_KEY = 'project_view_preferences_v2';

const loadInitialState = (): ProjectViewState => {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved) as ProjectViewState;
    return {
      ...parsed,
      groupBy: parsed.groupBy || ProjectGroupBy.PRIORITY,
    };
  }

  return {
    mode: ProjectViewType.LIST,
    groupBy: ProjectGroupBy.PRIORITY,
    lastUpdated: new Date().toISOString(),
  };
};

const initialState: ProjectViewState = loadInitialState();

export const projectViewSlice = createSlice({
  name: 'projectView',
  initialState,
  reducers: {
    setViewMode: (state, action: PayloadAction<ProjectViewType>) => {
      state.mode = action.payload;
      state.lastUpdated = new Date().toISOString();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    },
    setGroupBy: (state, action: PayloadAction<ProjectGroupBy>) => {
      state.groupBy = action.payload;
      state.lastUpdated = new Date().toISOString();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    },
    resetViewState: () => {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return loadInitialState();
    },
  },
});

export const { setViewMode, setGroupBy, resetViewState } = projectViewSlice.actions;
export default projectViewSlice.reducer;
