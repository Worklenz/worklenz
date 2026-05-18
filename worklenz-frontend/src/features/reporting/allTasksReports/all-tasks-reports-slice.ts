import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { IRPTTeam } from '@/types/reporting/reporting.types';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { allTasksReportsApiService } from '@/api/reporting/all-tasks-reports.api.service';

// Types
export type AllTasksGroupBy =
  | 'none'
  | 'project'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'dueDate'
  | 'phase'
  | 'team';
export type AllTasksViewMode = 'table' | 'board' | 'list';
export type CompletionStatus = 'all' | 'completed' | 'incomplete' | 'overdue';
export type DateFilterField = 'due_date' | 'start_date' | 'created_at' | 'completed_at';

export interface IAllTasksStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  unassignedTasks: number;
  dueThisWeek: number;
}

export interface IAllTasksGroup {
  id: string;
  name: string;
  color: string;
  tasks: IProjectTask[];
  isExpanded: boolean;
}

interface AllTasksReportsState {
  // Data
  tasksList: IProjectTask[];
  groupedTasks: IAllTasksGroup[];
  total: number;
  stats: IAllTasksStats;
  isLoading: boolean;
  error: string | null;

  // View settings
  viewMode: AllTasksViewMode;
  groupBy: AllTasksGroupBy;

  // Pagination
  index: number;
  pageSize: number;

  // Sorting
  sortField: string;
  sortOrder: 'asc' | 'desc';

  // Search
  searchQuery: string;

  // Filters
  teams: IRPTTeam[];
  loadingTeams: boolean;
  teamsLoaded: boolean;
  selectedProjects: string[];
  selectedStatuses: string[];
  selectedPriorities: string[];
  selectedAssignees: string[];
  selectedLabels: string[];
  selectedPhases: string[];
  selectedClients: string[];

  // Date filter
  dateFilterField: DateFilterField;
  dateFrom: string | null;
  dateTo: string | null;

  // Additional filters
  includeArchived: boolean;
  includeSubtasks: boolean;
  completionStatus: CompletionStatus;
  billableFilter: 'all' | 'billable' | 'non-billable';

  // Column visibility
  visibleColumns: string[];
}

const defaultVisibleColumns = [
  'taskName',
  'project',
  'status',
  'priority',
  'assignees',
  'dueDate',
  'estimatedTime',
  'loggedTime',
];

const initialState: AllTasksReportsState = {
  tasksList: [],
  groupedTasks: [],
  total: 0,
  stats: {
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    unassignedTasks: 0,
    dueThisWeek: 0,
  },
  isLoading: false,
  error: null,

  viewMode: 'table',
  groupBy: 'none',

  index: 1,
  pageSize: 50,

  sortField: 'end_date',
  sortOrder: 'asc',

  searchQuery: '',

  teams: [],
  loadingTeams: false,
  teamsLoaded: false,
  selectedProjects: [],
  selectedStatuses: [],
  selectedPriorities: [],
  selectedAssignees: [],
  selectedLabels: [],
  selectedPhases: [],
  selectedClients: [],

  dateFilterField: 'due_date',
  dateFrom: null,
  dateTo: null,

  includeArchived: false,
  includeSubtasks: true,
  completionStatus: 'all',
  billableFilter: 'all',

  visibleColumns: defaultVisibleColumns,
};

// Returns selected team IDs from state.
const getSelectedTeamIds = (state: AllTasksReportsState): string[] => {
  if (state.teams.length === 0) return [];
  return state.teams.filter(team => team.selected).map(team => team.id) as string[];
};

// ─── Async Thunks ────────────────────────────────────────────────────────────

export const fetchAllTasksTeams = createAsyncThunk('allTasksReports/fetchTeams', async () => {
  const res = await reportingApiService.getOverviewTeams();
  return res.body;
});

export const fetchAllTasks = createAsyncThunk(
  'allTasksReports/fetchAllTasks',
  async (_, { getState }) => {
    const state = (getState() as any).allTasksReportsReducer as AllTasksReportsState;
    const selectedTeamIds = getSelectedTeamIds(state);

    // BUG FIX: When no teams are selected, skip the API entirely and return
    // an empty result. Previously an empty teams array was sent to the backend
    // which ignored the filter and returned all tasks regardless.
    if (state.teamsLoaded && selectedTeamIds.length === 0) {
      return { data: [], total: 0, stats: initialState.stats, groups: [] };
    }

    const body = {
      index: state.index,
      size: state.pageSize,
      sortField: state.sortField,
      sortOrder: state.sortOrder,
      search: state.searchQuery,
      teams: selectedTeamIds,
      projects: state.selectedProjects,
      statuses: state.selectedStatuses,
      priorities: state.selectedPriorities,
      assignees: state.selectedAssignees,
      labels: state.selectedLabels,
      phases: state.selectedPhases,
      clients: state.selectedClients,
      dateField: state.dateFilterField,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      includeArchived: state.includeArchived,
      includeSubtasks: state.includeSubtasks,
      completionStatus: state.completionStatus,
      billable: state.billableFilter,
      groupBy: state.groupBy,
    };

    const response = await allTasksReportsApiService.getAllTasks(body);
    return response.body;
  }
);

// BUG FIX: Replaces the old two-dispatch pattern in the team filter component:
//
//   dispatch(setSelectOrDeselectTeam(...))  ← updates state
//   dispatch(fetchAllTasks())               ← but reads OLD state via getState()
//
// Redux does not flush state between two dispatches in the same event handler,
// so fetchAllTasks always read the stale team selections. By combining both
// into a single thunk we guarantee the state mutation runs first (as a plain
// action which is synchronous inside Redux), and only then fetchAllTasks reads
// the now-updated state via getState().
export const setTeamsAndFetch = createAsyncThunk(
  'allTasksReports/setTeamsAndFetch',
  async (
    payload:
      | { type: 'all'; selected: boolean }
      | { type: 'single'; id: string; selected: boolean },
    { dispatch }
  ) => {
    if (payload.type === 'all') {
      dispatch(setSelectOrDeselectAllTeams(payload.selected));
    } else {
      dispatch(setSelectOrDeselectTeam({ id: payload.id, selected: payload.selected }));
    }
    // State is now updated — fetchAllTasks will read correct selections
    await dispatch(fetchAllTasks());
  }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const allTasksReportsSlice = createSlice({
  name: 'allTasksReportsReducer',
  initialState,
  reducers: {
    setViewMode: (state, action: PayloadAction<AllTasksViewMode>) => {
      state.viewMode = action.payload;
    },
    setGroupBy: (state, action: PayloadAction<AllTasksGroupBy>) => {
      state.groupBy = action.payload;
    },

    setIndex: (state, action: PayloadAction<number>) => {
      state.index = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
      state.index = 1;
    },

    setSortField: (state, action: PayloadAction<string>) => {
      state.sortField = action.payload;
    },
    setSortOrder: (state, action: PayloadAction<'asc' | 'desc'>) => {
      state.sortOrder = action.payload;
    },
    setSort: (state, action: PayloadAction<{ field: string; order: 'asc' | 'desc' }>) => {
      state.sortField = action.payload.field;
      state.sortOrder = action.payload.order;
    },

    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.index = 1;
    },

    // Used internally by setTeamsAndFetch only.
    // Do NOT dispatch these directly and then call fetchAllTasks in a
    // component — that causes a stale-state race. Use setTeamsAndFetch instead.
    setSelectOrDeselectAllTeams: (state, action: PayloadAction<boolean>) => {
      state.teams.forEach(team => {
        team.selected = action.payload;
      });
    },
    setSelectOrDeselectTeam: (state, action: PayloadAction<{ id: string; selected: boolean }>) => {
      const team = state.teams.find(t => t.id === action.payload.id);
      if (team) {
        team.selected = action.payload.selected;
      }
    },

    setSelectedProjects: (state, action: PayloadAction<string[]>) => {
      state.selectedProjects = action.payload;
      state.index = 1;
    },
    toggleProject: (state, action: PayloadAction<string>) => {
      const index = state.selectedProjects.indexOf(action.payload);
      if (index >= 0) {
        state.selectedProjects.splice(index, 1);
      } else {
        state.selectedProjects.push(action.payload);
      }
      state.index = 1;
    },

    setSelectedStatuses: (state, action: PayloadAction<string[]>) => {
      state.selectedStatuses = action.payload;
      state.index = 1;
    },
    toggleStatus: (state, action: PayloadAction<string>) => {
      const index = state.selectedStatuses.indexOf(action.payload);
      if (index >= 0) {
        state.selectedStatuses.splice(index, 1);
      } else {
        state.selectedStatuses.push(action.payload);
      }
      state.index = 1;
    },

    setSelectedPriorities: (state, action: PayloadAction<string[]>) => {
      state.selectedPriorities = action.payload;
      state.index = 1;
    },
    togglePriority: (state, action: PayloadAction<string>) => {
      const index = state.selectedPriorities.indexOf(action.payload);
      if (index >= 0) {
        state.selectedPriorities.splice(index, 1);
      } else {
        state.selectedPriorities.push(action.payload);
      }
      state.index = 1;
    },

    setSelectedAssignees: (state, action: PayloadAction<string[]>) => {
      state.selectedAssignees = action.payload;
      state.index = 1;
    },
    toggleAssignee: (state, action: PayloadAction<string>) => {
      const index = state.selectedAssignees.indexOf(action.payload);
      if (index >= 0) {
        state.selectedAssignees.splice(index, 1);
      } else {
        state.selectedAssignees.push(action.payload);
      }
      state.index = 1;
    },

    setSelectedLabels: (state, action: PayloadAction<string[]>) => {
      state.selectedLabels = action.payload;
      state.index = 1;
    },

    setSelectedPhases: (state, action: PayloadAction<string[]>) => {
      state.selectedPhases = action.payload;
      state.index = 1;
    },

    setSelectedClients: (state, action: PayloadAction<string[]>) => {
      state.selectedClients = action.payload;
      state.index = 1;
    },
    toggleClient: (state, action: PayloadAction<string>) => {
      const index = state.selectedClients.indexOf(action.payload);
      if (index >= 0) {
        state.selectedClients.splice(index, 1);
      } else {
        state.selectedClients.push(action.payload);
      }
      state.index = 1;
    },

    setDateFilterField: (state, action: PayloadAction<DateFilterField>) => {
      state.dateFilterField = action.payload;
    },
    setDateRange: (state, action: PayloadAction<{ from: string | null; to: string | null }>) => {
      state.dateFrom = action.payload.from;
      state.dateTo = action.payload.to;
      state.index = 1;
    },

    setIncludeArchived: (state, action: PayloadAction<boolean>) => {
      state.includeArchived = action.payload;
      state.index = 1;
    },
    setIncludeSubtasks: (state, action: PayloadAction<boolean>) => {
      state.includeSubtasks = action.payload;
      state.index = 1;
    },
    setCompletionStatus: (state, action: PayloadAction<CompletionStatus>) => {
      state.completionStatus = action.payload;
      state.index = 1;
    },
    setBillableFilter: (state, action: PayloadAction<'all' | 'billable' | 'non-billable'>) => {
      state.billableFilter = action.payload;
      state.index = 1;
    },

    setVisibleColumns: (state, action: PayloadAction<string[]>) => {
      state.visibleColumns = action.payload;
    },
    toggleColumnVisibility: (state, action: PayloadAction<string>) => {
      const index = state.visibleColumns.indexOf(action.payload);
      if (index >= 0) {
        state.visibleColumns.splice(index, 1);
      } else {
        state.visibleColumns.push(action.payload);
      }
    },

    toggleGroupExpansion: (state, action: PayloadAction<string>) => {
      const group = state.groupedTasks.find(g => g.id === action.payload);
      if (group) {
        group.isExpanded = !group.isExpanded;
      }
    },
    expandAllGroups: state => {
      state.groupedTasks.forEach(group => {
        group.isExpanded = true;
      });
    },
    collapseAllGroups: state => {
      state.groupedTasks.forEach(group => {
        group.isExpanded = false;
      });
    },

    resetAllFilters: state => {
      state.searchQuery = '';
      state.selectedProjects = [];
      state.selectedStatuses = [];
      state.selectedPriorities = [];
      state.selectedAssignees = [];
      state.selectedLabels = [];
      state.selectedPhases = [];
      state.selectedClients = [];
      state.dateFrom = null;
      state.dateTo = null;
      state.includeArchived = false;
      state.includeSubtasks = true;
      state.completionStatus = 'all';
      state.billableFilter = 'all';
      state.index = 1;
      state.teams.forEach(team => {
        team.selected = true;
      });
    },
    resetState: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchAllTasksTeams.pending, state => {
        state.loadingTeams = true;
        state.teamsLoaded = false;
      })
      .addCase(fetchAllTasksTeams.fulfilled, (state, action) => {
        state.teams = action.payload.map(team => ({
          ...team,
          selected: true,
        }));
        state.loadingTeams = false;
        state.teamsLoaded = true;
      })
      .addCase(fetchAllTasksTeams.rejected, state => {
        state.loadingTeams = false;
        state.teamsLoaded = false;
      })

      .addCase(fetchAllTasks.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllTasks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasksList = action.payload.data || [];
        state.total = action.payload.total || 0;
        state.stats = action.payload.stats || initialState.stats;
        if (action.payload.groups) {
          state.groupedTasks = action.payload.groups.map((group: any) => ({
            ...group,
            isExpanded: true,
          }));
        }
      })
      .addCase(fetchAllTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch tasks';
      });
  },
});

export const {
  setViewMode,
  setGroupBy,
  setIndex,
  setPageSize,
  setSortField,
  setSortOrder,
  setSort,
  setSearchQuery,
  setSelectOrDeselectAllTeams,
  setSelectOrDeselectTeam,
  setSelectedProjects,
  toggleProject,
  setSelectedStatuses,
  toggleStatus,
  setSelectedPriorities,
  togglePriority,
  setSelectedAssignees,
  toggleAssignee,
  setSelectedLabels,
  setSelectedPhases,
  setDateFilterField,
  setDateRange,
  setIncludeArchived,
  setIncludeSubtasks,
  setCompletionStatus,
  setBillableFilter,
  setVisibleColumns,
  toggleColumnVisibility,
  toggleGroupExpansion,
  expandAllGroups,
  collapseAllGroups,
  resetAllFilters,
  resetState,
  setSelectedClients,
  toggleClient,
} = allTasksReportsSlice.actions;

export default allTasksReportsSlice.reducer;