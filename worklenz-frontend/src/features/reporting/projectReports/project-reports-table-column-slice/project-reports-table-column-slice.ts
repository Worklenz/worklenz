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

const getInitialState = () => {
  const savedState = getJSONFromLocalStorage(PROJECT_LIST_COLUMNS);
  return (
    savedState || {
      name: true,
      projectHealth: true,
      category: true,
      projectUpdate: true,
      client: true,
      team: true,
      projectManager: true,
      estimatedVsActual: true,
      tasksProgress: true,
      lastActivity: true,
      status: true,
      dates: true,
      daysLeft: true,
    }
  );
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
