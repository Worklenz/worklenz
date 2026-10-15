import { PROJECT_LIST_COLUMNS } from '@/shared/constants';
import {
  getJSONFromLocalStorage,
  saveJSONToLocalStorage,
  saveToLocalStorage,
} from '@/utils/localStorageFunctions';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type ColumnsVisibilityState = {
  [key: string]: boolean;
};

const DEFAULT_COLUMNS: ColumnsVisibilityState = {
  name: true,
  projectHealth: true,
  priority: true,
  category: true,
  projectUpdate: false,
  client: false,
  team: false,
  projectManager: true,
  estimatedVsActual: true,
  timeVariance: true,
  tasksProgress: true,
  lastActivity: false,
  status: true,
  startDate: false,
  endDate: false,
  daysLeft: true,
};

// Merge saved preferences over the defaults so newly added columns (and the
// split start/end date columns) appear for users with an older saved state.
const getInitialState = (): ColumnsVisibilityState => {
  const savedState = getJSONFromLocalStorage(PROJECT_LIST_COLUMNS);
  if (!savedState) return DEFAULT_COLUMNS;
  const { dates, ...rest } = savedState as ColumnsVisibilityState;
  return {
    ...DEFAULT_COLUMNS,
    ...rest,
    ...(dates === undefined ? {} : { startDate: dates, endDate: dates }),
  };
};

const initialState: ColumnsVisibilityState = getInitialState();

const projectReportsTableColumnsSlice = createSlice({
  name: 'projectReportsTableColumns',
  initialState,
  reducers: {
    toggleColumnHidden: (state, action: PayloadAction<string>) => {
      const columnKey = action.payload;
      if (columnKey in state) {
        state[columnKey] = !state[columnKey];
      }
      saveJSONToLocalStorage(PROJECT_LIST_COLUMNS, state);
    },
  },
});

export const { toggleColumnHidden } = projectReportsTableColumnsSlice.actions;
export default projectReportsTableColumnsSlice.reducer;
