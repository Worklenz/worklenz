import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { departmentsApiService } from '@/api/settings/departments/departments.api.service';
import { practicesApiService } from '@/api/settings/practices/practices.api.service';
import {
  ISelectableCategory,
  ISelectableDepartment,
  ISelectablePractice,
  ISelectableProject,
  ISelectableTeam,
} from '@/types/reporting/reporting-filters.types';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

const NO_DEPARTMENT_FILTER_ID = '__no_department__';
const NO_PRACTICE_FILTER_ID = '__no_practice__';

interface ITimeReportsOverviewState {
  archived: boolean;

  teams: ISelectableTeam[];
  loadingTeams: boolean;
  departments: ISelectableDepartment[];
  loadingDepartments: boolean;
  practices: ISelectablePractice[];
  loadingPractices: boolean;

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

  utilization: any[];
  loadingUtilization: boolean;
  utilizationVisible: boolean;
  showOnlyMembersWithTimeLogs: boolean;
}

const initialState: ITimeReportsOverviewState = {
  archived: false,
  utilizationVisible: true,
  showOnlyMembersWithTimeLogs: false,

  teams: [],
  loadingTeams: false,
  departments: [],
  loadingDepartments: false,
  practices: [],
  loadingPractices: false,

  categories: [],
  noCategory: false,
  loadingCategories: false,

  projects: [],
  loadingProjects: false,

  billable: {
    billable: true,
    nonBillable: true,
  },
  members: [],
  loadingMembers: false,

  utilization: [],
  loadingUtilization: false,
};

const selectedTeams = (state: ITimeReportsOverviewState) => {
  return state.teams.filter(team => team.selected).map(team => team.id) as string[];
};

const selectedPracticeIds = (state: ITimeReportsOverviewState) => {
  return state.practices.filter(practice => practice.selected).map(practice => practice.id) as string[];
};

const selectedDepartmentIds = (state: ITimeReportsOverviewState) => {
  return state.departments
    .filter(department => department.selected)
    .map(department => department.id) as string[];
};

const selectedCategories = (state: ITimeReportsOverviewState) => {
  return state.categories
    .filter(category => category.selected)
    .map(category => category.id) as string[];
};

const selectedUtilization = (state: ITimeReportsOverviewState) => {
  return state.utilization
    .filter(utilization => utilization.selected)
    .map(utilization => utilization.id) as string[];
};

const allUtilization = (state: ITimeReportsOverviewState) => {
  return state.utilization;
};

export const fetchReportingUtilization = createAsyncThunk(
  'timeReportsOverview/fetchReportingUtilization',
  async (_, { rejectWithValue }) => {
    try {
      const utilization = [
        { id: 'under', nameKey: 'underUtilized', selected: true },
        { id: 'optimal', nameKey: 'optimalUtilized', selected: true },
        { id: 'over', nameKey: 'overUtilized', selected: true },
      ];
      return utilization;
    } catch (error) {
      let errorMessage = 'An error occurred while fetching utilization';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchReportingMembers = createAsyncThunk(
  'timeReportsOverview/fetchReportingMembers',
  async (_, { rejectWithValue, getState }) => {
    const state = getState() as { timeReportsOverviewReducer: ITimeReportsOverviewState };
    const { timeReportsOverviewReducer } = state;

    try {
      // Fetch the full member list (large page size to avoid pagination), scoped to the
      // currently selected practices/departments so the dropdown narrows along with them.
      const queryParams = {
        size: 1000,
        index: 1,
        search: '',
        field: 'name',
        order: 'asc',
        practices: selectedPracticeIds(timeReportsOverviewReducer),
        departments: selectedDepartmentIds(timeReportsOverviewReducer),
      };

      const res = await reportingApiService.getMembers(queryParams);
      if (res.done) {
        return res.body;
      } else {
        return rejectWithValue(res.message || 'Failed to fetch members');
      }
    } catch (error) {
      let errorMessage = 'An error occurred while fetching members';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return rejectWithValue(errorMessage);
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

export const fetchReportingDepartments = createAsyncThunk(
  'timeReportsOverview/fetchReportingDepartments',
  async (_, { rejectWithValue }) => {
    try {
      const res = await departmentsApiService.getDepartments(1, 1000, 'name', 'asc', '');
      if (!res.done) {
        return rejectWithValue(res.message || 'Failed to fetch departments');
      }
      return res.body?.data || [];
    } catch (error) {
      let errorMessage = 'An error occurred while fetching departments';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchReportingPractices = createAsyncThunk(
  'timeReportsOverview/fetchReportingPractices',
  async (_, { rejectWithValue }) => {
    try {
      const res = await practicesApiService.getPractices(1, 1000, 'name', 'asc', '');
      if (!res.done) {
        return rejectWithValue(res.message || 'Failed to fetch practices');
      }
      return res.body?.data || [];
    } catch (error) {
      let errorMessage = 'An error occurred while fetching practices';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return rejectWithValue(errorMessage);
    }
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
  async (
    overrides: { categories?: string[]; noCategory?: boolean } | undefined,
    { rejectWithValue, getState }
  ) => {
    const state = getState() as { timeReportsOverviewReducer: ITimeReportsOverviewState };
    const { timeReportsOverviewReducer } = state;

 const categoriesToUse =
      overrides?.categories !== undefined
        ? overrides.categories
        : selectedCategories(timeReportsOverviewReducer);

    const noCategoryToUse =
      overrides?.noCategory !== undefined
        ? overrides.noCategory
        : timeReportsOverviewReducer.noCategory;


    const res = await reportingApiService.getAllocationProjects(
      selectedTeams(timeReportsOverviewReducer),
     categoriesToUse,
      noCategoryToUse
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
    setSelectOrDeselectDepartment: (
      state,
      action: PayloadAction<{ id: string; selected: boolean }>
    ) => {
      const department = state.departments.find(dep => dep.id === action.payload.id);
      if (department) {
        department.selected = action.payload.selected;
      }
    },
    setSelectOrDeselectAllDepartments: (state, action: PayloadAction<boolean>) => {
      state.departments.forEach(department => {
        department.selected = action.payload;
      });
    },
    setSelectOrDeselectPractice: (
      state,
      action: PayloadAction<{ id: string; selected: boolean }>
    ) => {
      const practice = state.practices.find(p => p.id === action.payload.id);
      if (practice) {
        practice.selected = action.payload.selected;
      }
    },
    setSelectOrDeselectAllPractices: (state, action: PayloadAction<boolean>) => {
      state.practices.forEach(practice => {
        practice.selected = action.payload;
      });
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
    setSelectOrDeselectMember: (
      state,
      action: PayloadAction<{ id: string; selected: boolean }>
    ) => {
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
    setSelectOrDeselectUtilization: (
      state,
      action: PayloadAction<{ id: string; selected: boolean }>
    ) => {
      const utilization = state.utilization.find(u => u.id === action.payload.id);
      if (utilization) {
        utilization.selected = action.payload.selected;
      }
    },
    setSelectOrDeselectAllUtilization: (state, action: PayloadAction<boolean>) => {
      state.utilization.forEach(utilization => {
        utilization.selected = action.payload;
      });
    },
    setUtilizationVisible: (state, action: PayloadAction<boolean>) => {
      state.utilizationVisible = action.payload;
    },
    setShowOnlyMembersWithTimeLogs: (state, action: PayloadAction<boolean>) => {
      state.showOnlyMembersWithTimeLogs = action.payload;
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
    builder.addCase(fetchReportingDepartments.fulfilled, (state, action) => {
      state.departments = [
        {
          selected: true,
          name: NO_DEPARTMENT_FILTER_ID,
          id: NO_DEPARTMENT_FILTER_ID,
        } as any,
        ...(action.payload || []).map((department: any) => ({
          selected: true,
          name: department.name,
          id: department.id,
        })),
      ];
      state.loadingDepartments = false;
    });
    builder.addCase(fetchReportingDepartments.pending, state => {
      state.loadingDepartments = true;
    });
    builder.addCase(fetchReportingDepartments.rejected, state => {
      state.loadingDepartments = false;
    });
    builder.addCase(fetchReportingPractices.fulfilled, (state, action) => {
      state.practices = [
        { selected: true, name: NO_PRACTICE_FILTER_ID, id: NO_PRACTICE_FILTER_ID } as any,
        ...(action.payload || []).map((practice: any) => ({
          selected: true,
          name: practice.name,
          id: practice.id,
        })),
      ];
      state.loadingPractices = false;
    });
    builder.addCase(fetchReportingPractices.pending, state => {
      state.loadingPractices = true;
    });
    builder.addCase(fetchReportingPractices.rejected, state => {
      state.loadingPractices = false;
    });
    builder.addCase(fetchReportingCategories.fulfilled, (state, action) => {
      const categories = [];
      for (const category of action.payload) {
       const existing = state.categories.find(c => c.id === category.id);
    categories.push({
      selected: existing ? existing.selected : true,
      name: category.name,
      id: category.id,
    });
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
         const existing = state.projects.find(p => p.id === project.id);
    projects.push({
      selected: existing ? existing.selected : true,
      name: project.name,
      id: project.id,
    });
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
      const members = action.payload.members.map((member: any) => ({
        id: member.id,
        name: member.name,
        selected: true,
        avatar_url: member.avatar_url,
        email: member.email,
          color_code: member.color_code,
      }));
      state.members = members;
      state.loadingMembers = false;
    });

    builder.addCase(fetchReportingMembers.pending, state => {
      state.loadingMembers = true;
    });

    builder.addCase(fetchReportingMembers.rejected, (state, action) => {
      state.loadingMembers = false;
      console.error('Error fetching members:', action.payload);
    });
    builder.addCase(fetchReportingUtilization.fulfilled, (state, action) => {
      state.utilization = action.payload;
      state.loadingUtilization = false;
    });
    builder.addCase(fetchReportingUtilization.pending, state => {
      state.loadingUtilization = true;
    });
    builder.addCase(fetchReportingUtilization.rejected, (state, action) => {
      state.loadingUtilization = false;
      console.error('Error fetching utilization:', action.payload);
    });
  },
});

export const {
  setTeams,
  setSelectOrDeselectAllTeams,
  setSelectOrDeselectTeam,
  setSelectOrDeselectDepartment,
  setSelectOrDeselectAllDepartments,
  setSelectOrDeselectPractice,
  setSelectOrDeselectAllPractices,
  setSelectOrDeselectCategory,
  setSelectOrDeselectAllCategories,
  setSelectOrDeselectProject,
  setSelectOrDeselectAllProjects,
  setSelectOrDeselectBillable,
  setSelectOrDeselectMember,
  setSelectOrDeselectAllMembers,
  setSelectOrDeselectUtilization,
  setSelectOrDeselectAllUtilization,
  setNoCategory,
  setArchived,
  setUtilizationVisible,
  setShowOnlyMembersWithTimeLogs,
} = timeReportsOverviewSlice.actions;
export default timeReportsOverviewSlice.reducer;
