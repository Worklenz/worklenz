import { reportingApiService } from '@/api/reporting/reporting.api.service';
import {
  ISelectableCategory,
  ISelectableProject,
  ISelectableTeam,
} from '@/types/reporting/reporting-filters.types';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ITimeReportsOverviewState {
  archived: boolean;

  teams: ISelectableTeam[];
  loadingTeams: boolean;

  categories: ISelectableCategory[];
  noCategory: boolean;
  loadingCategories: boolean;

  projects: ISelectableProject[];
  loadingProjects: boolean;

  billable: {
    billable: boolean;
    nonBillable: boolean;
  };

  members: any[];
  loadingMembers: boolean;
}

const initialState: ITimeReportsOverviewState = {
  archived: false,

  teams: [],
  loadingTeams: false,

  categories: [],
  noCategory: true,
  loadingCategories: false,

  projects: [],
  loadingProjects: false,

  billable: {
    billable: true,
    nonBillable: true,
  },
  members: [],
  loadingMembers: false,
};

const selectedMembers = (state: ITimeReportsOverviewState) => {
  return state.members.filter(member => member.selected).map(member => member.id) as string[];
};

const selectedTeams = (state: ITimeReportsOverviewState) => {
  return state.teams.filter(team => team.selected).map(team => team.id) as string[];
};

const selectedCategories = (state: ITimeReportsOverviewState) => {
  return state.categories
    .filter(category => category.selected)
    .map(category => category.id) as string[];
};

export const fetchReportingMembers = createAsyncThunk(
  'timeReportsOverview/fetchReportingMembers',
  async (_, { rejectWithValue, getState }) => {
    const state = getState() as { timeReportsOverviewReducer: ITimeReportsOverviewState };
    const { timeReportsOverviewReducer } = state;

    try {
      const res = await reportingApiService.getMembers(selectedMembers(timeReportsOverviewReducer));
      if (res.done) {
        // Extract members from the response
        return res.body.members; // Use `body.members` instead of `body`
      } else {
        return rejectWithValue(res.message || 'Failed to fetch members');
      }
    } catch (error) {
      return rejectWithValue(error.message || 'An error occurred while fetching members');
    }
  }
);

export const fetchReportingTeams = createAsyncThunk(
  'timeReportsOverview/fetchReportingTeams',
  async () => {
    const res = await reportingApiService.getOverviewTeams();
    return res.body;
  }
);

export const fetchReportingCategories = createAsyncThunk(
  'timeReportsOverview/fetchReportingCategories',
  async (_, { rejectWithValue, getState, dispatch }) => {
    const state = getState() as { timeReportsOverviewReducer: ITimeReportsOverviewState };
    const { timeReportsOverviewReducer } = state;

    const res = await reportingApiService.getCategories(selectedTeams(timeReportsOverviewReducer));
    return res.body;
  }
);

export const fetchReportingProjects = createAsyncThunk(
  'timeReportsOverview/fetchReportingProjects',
  async (_, { rejectWithValue, getState, dispatch }) => {
    const state = getState() as { timeReportsOverviewReducer: ITimeReportsOverviewState };
    const { timeReportsOverviewReducer } = state;

    const res = await reportingApiService.getAllocationProjects(
      selectedTeams(timeReportsOverviewReducer),
      selectedCategories(timeReportsOverviewReducer),
      timeReportsOverviewReducer.noCategory
    );
    return res.body;
  }
);

const timeReportsOverviewSlice = createSlice({
  name: 'timeReportsOverview',
  initialState,
  reducers: {
    setTeams: (state, action) => {
      state.teams = action.payload;
    },
    setSelectOrDeselectAllTeams: (state, action) => {
      state.teams.forEach(team => {
        team.selected = action.payload;
      });
    },
    setSelectOrDeselectTeam: (state, action: PayloadAction<{ id: string; selected: boolean }>) => {
      const team = state.teams.find(team => team.id === action.payload.id);
      if (team) {
        team.selected = action.payload.selected;
      }
    },
    setSelectOrDeselectCategory: (
      state,
      action: PayloadAction<{ id: string; selected: boolean }>
    ) => {
      const category = state.categories.find(category => category.id === action.payload.id);
      if (category) {
        category.selected = action.payload.selected;
      }
    },
    setSelectOrDeselectAllCategories: (state, action) => {
      state.categories.forEach(category => {
        category.selected = action.payload;
      });
    },
    setSelectOrDeselectProject: (state, action) => {
      const project = state.projects.find(project => project.id === action.payload.id);
      if (project) {
        console.log('setSelectOrDeselectProject', project, action.payload);
        project.selected = action.payload.selected;
      }
    },
    setSelectOrDeselectAllProjects: (state, action) => {
      state.projects.forEach(project => {
        project.selected = action.payload;
      });
    },

    setSelectOrDeselectBillable: (state, action) => {
      state.billable = action.payload;
    },
    setNoCategory: (state, action: PayloadAction<boolean>) => {
      state.noCategory = action.payload;
    },
    setArchived: (state, action: PayloadAction<boolean>) => {
      state.archived = action.payload;
    },
    setSelectOrDeselectMember: (state, action: PayloadAction<{ id: string; selected: boolean }>) => {
      const member = state.members.find(member => member.id === action.payload.id);
      if (member) {
        member.selected = action.payload.selected;
      }
    },
    setSelectOrDeselectAllMembers: (state, action: PayloadAction<boolean>) => {
      state.members.forEach(member => {
        member.selected = action.payload;
      });
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchReportingTeams.fulfilled, (state, action) => {
      const teams = [];
      for (const team of action.payload) {
        teams.push({ selected: true, name: team.name, id: team.id });
      }
      state.teams = teams;
      state.loadingTeams = false;
    });
    builder.addCase(fetchReportingTeams.pending, state => {
      state.loadingTeams = true;
    });
    builder.addCase(fetchReportingTeams.rejected, state => {
      state.loadingTeams = false;
    });
    builder.addCase(fetchReportingCategories.fulfilled, (state, action) => {
      const categories = [];
      for (const category of action.payload) {
        categories.push({ selected: true, name: category.name, id: category.id });
      }
      state.categories = categories;
      state.loadingCategories = false;
    });
    builder.addCase(fetchReportingCategories.pending, state => {
      state.loadingCategories = true;
    });
    builder.addCase(fetchReportingCategories.rejected, state => {
      state.loadingCategories = false;
    });
    builder.addCase(fetchReportingProjects.fulfilled, (state, action) => {
      const projects = [];
      for (const project of action.payload) {
        projects.push({ selected: true, name: project.name, id: project.id });
      }
      state.projects = projects;
      state.loadingProjects = false;
    });
    builder.addCase(fetchReportingProjects.pending, state => {
      state.loadingProjects = true;
    });
    builder.addCase(fetchReportingProjects.rejected, state => {
      state.loadingProjects = false;
    });
    builder.addCase(fetchReportingMembers.fulfilled, (state, action) => {
      console.log('fetchReportingMembers fulfilled', action.payload);
      const members = action.payload.map((member: any) => ({
        id: member.id,
        name: member.name,
        selected: true, // Default to selected
        avatar_url: member.avatar_url, // Include avatar URL if needed
        email: member.email, // Include email if needed
      }));
      state.members = members;
      state.loadingMembers = false;
    });

    builder.addCase(fetchReportingMembers.pending, state => {
      console.log('fetchReportingMembers pending');
      state.loadingMembers = true;
    });

    builder.addCase(fetchReportingMembers.rejected, (state, action) => {
      console.log('fetchReportingMembers rejected', action.payload);
      state.loadingMembers = false;
      console.error('Error fetching members:', action.payload);
    });
  },
});

export const {
  setTeams,
  setSelectOrDeselectAllTeams,
  setSelectOrDeselectTeam,
  setSelectOrDeselectCategory,
  setSelectOrDeselectAllCategories,
  setSelectOrDeselectProject,
  setSelectOrDeselectAllProjects,
  setSelectOrDeselectBillable,
  setSelectOrDeselectMember,
  setSelectOrDeselectAllMembers,
  setNoCategory,
  setArchived,
} = timeReportsOverviewSlice.actions;
export default timeReportsOverviewSlice.reducer;
