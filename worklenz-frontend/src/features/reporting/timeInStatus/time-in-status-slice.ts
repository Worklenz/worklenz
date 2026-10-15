import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TIME_IN_STATUS_COLUMNS } from '@/shared/constants';
import { getJSONFromLocalStorage, saveJSONToLocalStorage } from '@/utils/localStorageFunctions';
import type { TimeInStatusGroupBy } from '@/api/reporting/progress-chart.api.service';

export type TimeInStatusViewMode = 'table' | 'grouped';

/** Column keys; `name` is always shown and is not toggleable. */
export type TimeInStatusColumnKey =
  | 'taskKey'
  | 'name'
  | 'project'
  | 'status'
  | 'timeInStatus'
  | 'timeOverdue'
  | 'assignees'
  | 'lastUpdated';

export const TOGGLEABLE_COLUMNS: TimeInStatusColumnKey[] = [
  'taskKey',
  'project',
  'status',
  'timeInStatus',
  'timeOverdue',
  'assignees',
  'lastUpdated',
];

export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_SORT_FIELD = 'hours_in_status';

export type TimeInStatusColumnsVisibility = Record<TimeInStatusColumnKey, boolean>;

export interface TimeInStatusState {
  viewMode: TimeInStatusViewMode;
  groupBy: TimeInStatusGroupBy;
  searchQuery: string;
  selectedProjects: string[];
  selectedStatuses: string[];
  selectedAssignees: string[];
  includeSubtasks: boolean;
  includeArchived: boolean;
  index: number;
  pageSize: number;
  field: string;
  order: 'asc' | 'desc';
  columns: TimeInStatusColumnsVisibility;
}

const DEFAULT_COLUMNS: TimeInStatusColumnsVisibility = {
  taskKey: true,
  name: true,
  project: true,
  status: true,
  timeInStatus: true,
  timeOverdue: true,
  assignees: true,
  lastUpdated: true,
};

const loadColumns = (): TimeInStatusColumnsVisibility => {
  try {
    const saved = getJSONFromLocalStorage(TIME_IN_STATUS_COLUMNS) as Partial<TimeInStatusColumnsVisibility> | null;
    return { ...DEFAULT_COLUMNS, ...(saved ?? {}), name: true };
  } catch {
    return DEFAULT_COLUMNS;
  }
};

const initialState: TimeInStatusState = {
  viewMode: 'table',
  groupBy: 'project',
  searchQuery: '',
  selectedProjects: [],
  selectedStatuses: [],
  selectedAssignees: [],
  includeSubtasks: false,
  includeArchived: false,
  index: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  field: DEFAULT_SORT_FIELD,
  order: 'desc',
  columns: loadColumns(),
};

const timeInStatusSlice = createSlice({
  name: 'timeInStatusReducer',
  initialState,
  reducers: {
    setViewMode: (state, action: PayloadAction<TimeInStatusViewMode>) => {
      state.viewMode = action.payload;
      state.index = 1;
      state.pageSize = DEFAULT_PAGE_SIZE;
    },
    setGroupBy: (state, action: PayloadAction<TimeInStatusGroupBy>) => {
      state.groupBy = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.index = 1;
    },
    setSelectedProjects: (state, action: PayloadAction<string[]>) => {
      state.selectedProjects = action.payload;
      state.index = 1;
    },
    setSelectedStatuses: (state, action: PayloadAction<string[]>) => {
      state.selectedStatuses = action.payload;
      state.index = 1;
    },
    setSelectedAssignees: (state, action: PayloadAction<string[]>) => {
      state.selectedAssignees = action.payload;
      state.index = 1;
    },
    setIncludeSubtasks: (state, action: PayloadAction<boolean>) => {
      state.includeSubtasks = action.payload;
      state.index = 1;
    },
    setIncludeArchived: (state, action: PayloadAction<boolean>) => {
      state.includeArchived = action.payload;
      state.index = 1;
    },
    setIndex: (state, action: PayloadAction<number>) => {
      state.index = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
      state.index = 1;
    },
    setSort: (state, action: PayloadAction<{ field: string; order: 'asc' | 'desc' } | null>) => {
      state.field = action.payload?.field ?? DEFAULT_SORT_FIELD;
      state.order = action.payload?.order ?? 'desc';
      state.index = 1;
    },
    toggleColumn: (state, action: PayloadAction<TimeInStatusColumnKey>) => {
      if (action.payload === 'name') return;
      state.columns[action.payload] = !state.columns[action.payload];
      saveJSONToLocalStorage(TIME_IN_STATUS_COLUMNS, state.columns);
    },
    /** Clears every filter; keeps the view, sort and column choices. */
    resetFilters: state => {
      state.searchQuery = '';
      state.selectedProjects = [];
      state.selectedStatuses = [];
      state.selectedAssignees = [];
      state.includeSubtasks = false;
      state.includeArchived = false;
      state.index = 1;
    },
    /** Back to the defaults when leaving the page; saved columns survive. */
    resetTimeInStatus: state => ({ ...initialState, columns: state.columns }),
  },
});

export const {
  setViewMode,
  setGroupBy,
  setSearchQuery,
  setSelectedProjects,
  setSelectedStatuses,
  setSelectedAssignees,
  setIncludeSubtasks,
  setIncludeArchived,
  setIndex,
  setPageSize,
  setSort,
  toggleColumn,
  resetFilters,
  resetTimeInStatus,
} = timeInStatusSlice.actions;

export default timeInStatusSlice.reducer;
