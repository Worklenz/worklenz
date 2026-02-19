import { reportingProjectsApiService } from '@/api/reporting/reporting-projects.api.service';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { DEFAULT_PAGE_SIZE, FILTER_INDEX_KEY } from '@/shared/constants';
import { IProjectCategory } from '@/types/project/projectCategory.types';
import { IProjectHealth } from '@/types/project/projectHealth.types';
import { IProjectManager } from '@/types/project/projectManager.types';
import { IProjectStatus } from '@/types/project/projectStatus.types';
import {
  IGetProjectsRequestBody,
  IRPTOverviewProject,
  IRPTOverviewProjectMember,
  IRPTProject,
  IRPTTeam,
} from '@/types/reporting/reporting.types';
import { getFromLocalStorage } from '@/utils/localStorageFunctions';
import { createAsyncThunk, createSlice, createAction } from '@reduxjs/toolkit';

const filterIndex = () => {
  return +(getFromLocalStorage(FILTER_INDEX_KEY.toString()) || 0);
};

const selectedTeams = (state: ProjectReportsState) => {
  return state.teams.filter(team => team.selected).map(team => team.id) as string[];
};

export type ProjectReportsViewMode = 'table' | 'grouped';
export type ProjectReportsGroupBy = 'category' | 'status' | 'health' | 'team' | 'client' | 'manager';

export interface IProjectReportGroup {
  group_id: string;
  group_name: string;
  group_color: string;
  project_count: number;
  total_tasks: number;
  done_tasks: number;
  doing_tasks: number;
  todo_tasks: number;
  projects: IRPTProject[];
}

type ProjectReportsState = {
  isProjectReportsDrawerOpen: boolean;

  isProjectReportsMembersTaskDrawerOpen: boolean;
  selectedMember: IRPTOverviewProjectMember | null;
  selectedProject: IRPTOverviewProject | null;

  projectList: IRPTProject[];
  total: number;
  isLoading: boolean;
  error: string | null;

  // Grouped view data
  groupedProjects: IProjectReportGroup[];
  totalGroups: number;

  // View mode
  viewMode: ProjectReportsViewMode;
  groupBy: ProjectReportsGroupBy;

  // filters
  index: number;
  pageSize: number;
  field: string;
  order: string;
  searchQuery: string;
  filterIndex: number;
  archived: boolean;
  teams: IRPTTeam[];
  loadingTeams: boolean;
  selectedProjectStatuses: IProjectStatus[];
  selectedProjectHealths: IProjectHealth[];
  selectedProjectCategories: IProjectCategory[];
  selectedProjectManagers: IProjectManager[];
  isLoadingMore: boolean; // For "Load More" button loading state
};

export const fetchReportingTeams = createAsyncThunk(
  'projectReports/fetchReportingTeams',
  async () => {
    const res = await reportingApiService.getOverviewTeams();
    return res.body;
  }
);

export const fetchProjectData = createAsyncThunk(
  'projectReports/fetchProjectData',
  async (_, { getState }) => {
    const state = (getState() as any).projectReportsReducer;
    const teams = selectedTeams(state);

    // If teams have been loaded but none are selected, return empty result immediately
    // This handles the "Clear All" case where user deselects all teams
    if (state.teams.length > 0 && teams.length === 0) {
      return { total: 0, projects: [] };
    }

    const body: IGetProjectsRequestBody = {
      index: state.index,
      size: state.pageSize,
      field: state.field,
      order: state.order,
      search: state.searchQuery,
      filter: state.filterIndex.toString(),
      statuses: state.selectedProjectStatuses.map((s: IProjectStatus) => s.id || ''),
      healths: state.selectedProjectHealths.map((h: IProjectHealth) => h.id || ''),
      categories: state.selectedProjectCategories.map((c: IProjectCategory) => c.id || ''),
      project_managers: state.selectedProjectManagers.map((m: IProjectManager) => m.id || ''),
      archived: state.archived,
      teams,
    };
    const response = await reportingProjectsApiService.getProjects(body);
    return response.body;
  }
);

// Fetch more projects for grouped view (append to existing list)
// This enables progressive loading with "Load More" button
export const fetchMoreProjectsForGroupedView = createAsyncThunk(
  'projectReports/fetchMoreProjectsForGroupedView',
  async (_, { getState }) => {
    const state = (getState() as any).projectReportsReducer;
    const teams = selectedTeams(state);

    // If teams have been loaded but none are selected, return empty result immediately
    if (state.teams.length > 0 && teams.length === 0) {
      return { total: 0, projects: [] };
    }

    const body: IGetProjectsRequestBody = {
      index: state.index,
      size: state.pageSize,
      field: state.field,
      order: state.order,
      search: state.searchQuery,
      filter: state.filterIndex.toString(),
      statuses: state.selectedProjectStatuses.map((s: IProjectStatus) => s.id || ''),
      healths: state.selectedProjectHealths.map((h: IProjectHealth) => h.id || ''),
      categories: state.selectedProjectCategories.map((c: IProjectCategory) => c.id || ''),
      project_managers: state.selectedProjectManagers.map((m: IProjectManager) => m.id || ''),
      archived: state.archived,
      teams,
    };
    const response = await reportingProjectsApiService.getProjects(body);
    return response.body;
  }
);

// Fetch grouped projects with accurate task counts
export const fetchGroupedProjects = createAsyncThunk(
  'projectReports/fetchGroupedProjects',
  async (_, { getState }) => {
    const state = (getState() as any).projectReportsReducer;
    const teams = selectedTeams(state);

    // If teams have been loaded but none are selected, return empty result immediately
    if (state.teams.length > 0 && teams.length === 0) {
      return { groups: [], total_groups: 0 };
    }

    const params = {
      group_by: state.groupBy,
      search: state.searchQuery,
      field: state.field,
      order: state.order,
      statuses: state.selectedProjectStatuses.map((s: IProjectStatus) => s.id || '').join(','),
      healths: state.selectedProjectHealths.map((h: IProjectHealth) => h.id || '').join(','),
      categories: state.selectedProjectCategories.map((c: IProjectCategory) => c.id || '').join(','),
      project_managers: state.selectedProjectManagers.map((m: IProjectManager) => m.id || '').join(','),
      teams: teams.join(','),
      archived: state.archived,
    };
    const response = await reportingProjectsApiService.getProjectsGrouped(params);
    // Ensure we return a valid structure even if response.body is null
    return response.body || { groups: [], total_groups: 0 };
  }
);

export const updateProjectCategory = createAction<{
  projectId: string;
  category: IProjectCategory;
}>('projectReports/updateProjectCategory');

export const updateProjectStatus = createAction<{
  projectId: string;
  status: IProjectStatus;
}>('projectReports/updateProjectStatus');

const initialState: ProjectReportsState = {
  isProjectReportsDrawerOpen: false,

  isProjectReportsMembersTaskDrawerOpen: false,
  selectedMember: null,
  selectedProject: null,

  projectList: [],
  total: 0,
  isLoading: false,
  error: null,

  // Grouped view data
  groupedProjects: [],
  totalGroups: 0,

  // View mode
  viewMode: 'table',
  groupBy: 'category',

  // filters
  index: 1,
  pageSize: 10,
  field: 'name',
  order: 'asc',
  searchQuery: '',
  filterIndex: filterIndex(),
  archived: false,
  teams: [],
  loadingTeams: false,
  selectedProjectStatuses: [],
  selectedProjectHealths: [],
  selectedProjectCategories: [],
  selectedProjectManagers: [],
  isLoadingMore: false,
};

const projectReportsSlice = createSlice({
  name: 'projectReportsReducer',
  initialState,
  reducers: {
    toggleProjectReportsDrawer: state => {
      state.isProjectReportsDrawerOpen = !state.isProjectReportsDrawerOpen;
    },
    toggleProjectReportsMembersTaskDrawer: state => {
      state.isProjectReportsMembersTaskDrawerOpen = !state.isProjectReportsMembersTaskDrawerOpen;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
      state.index = 1;
    },
    setSelectOrDeselectAllTeams: (state, action) => {
      state.teams.forEach(team => {
        team.selected = action.payload;
      });
    },
    setSelectOrDeselectTeam: (state, action) => {
      const team = state.teams.find(team => team.id === action.payload.id);
      if (team) {
        team.selected = action.payload.selected;
      }
    },
    setSelectedProjectStatuses: (state, action) => {
      state.selectedProjectStatuses = action.payload;
    },
    setSelectedProjectHealths: (state, action) => {
      state.selectedProjectHealths = action.payload;
    },
    setSelectedProjectCategories: (state, action) => {
      const category = action.payload;
      const index = state.selectedProjectCategories.findIndex(c => c.id === category.id);
      if (index >= 0) {
        state.selectedProjectCategories.splice(index, 1);
      } else {
        state.selectedProjectCategories.push(category);
      }
    },
    setSelectedProjectManagers: (state, action) => {
      const manager = action.payload;
      const index = state.selectedProjectManagers.findIndex(m => m.id === manager.id);
      if (index >= 0) {
        state.selectedProjectManagers.splice(index, 1);
      } else {
        state.selectedProjectManagers.push(manager);
      }
    },
    setArchived: (state, action) => {
      state.archived = action.payload;
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
    setProjectHealth: (state, action) => {
      const health = action.payload;
      const project = state.projectList.find(p => p.id === health.id);
      if (project) {
        project.project_health = health.id;
        project.health_name = health.name;
        project.health_color = health.color_code;
      }
    },
    setProjectStatus: (state, action) => {
      const status = action.payload;
      const project = state.projectList.find(p => p.id === status.id);
      if (project) {
        project.status_id = status.id;
        project.status_name = status.name;
        project.status_color = status.color_code;
      }
    },
    setProjectStartDate: (state, action) => {
      const project = state.projectList.find(p => p.id === action.payload.id);
      if (project) {
        project.start_date = action.payload.start_date;
      }
    },
    setProjectEndDate: (state, action) => {
      const project = state.projectList.find(p => p.id === action.payload.id);
      if (project) {
        project.end_date = action.payload.end_date;
      }
    },
    setSelectedMember: (state, action) => {
      state.selectedMember = action.payload;
    },
    setSelectedProject: (state, action) => {
      state.selectedProject = action.payload;
    },
    setSelectedProjectCategory: (state, action) => {
      const category = action.payload;
      const project = state.projectList.find(p => p.id === category.id);
      if (project) {
        project.category_id = category.id;
        project.category_name = category.name;
        project.category_color = category.color_code;
      }
    },
    setViewMode: (state, action) => {
      state.viewMode = action.payload;
    },
    setGroupBy: (state, action) => {
      state.groupBy = action.payload;
    },
    resetProjectReports: state => {
      state.projectList = [];
      state.total = 0;
      state.groupedProjects = [];
      state.totalGroups = 0;
      state.isLoading = false;
      state.error = null;
      state.index = 1;
      state.pageSize = 10;
      state.field = 'name';
      state.order = 'asc';
      state.searchQuery = '';
      state.filterIndex = filterIndex();
      state.archived = false;
    },
    resetAllFilters: state => {
      state.searchQuery = '';
      state.archived = false;
      state.index = 1;
      state.viewMode = 'table';
      state.groupBy = 'category';
      state.teams.forEach(team => {
        team.selected = true;
      });
      state.selectedProjectStatuses = [];
      state.selectedProjectHealths = [];
      state.selectedProjectCategories = [];
      state.selectedProjectManagers = [];
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchReportingTeams.fulfilled, (state, action) => {
        const teams = [];
        for (const team of action.payload) {
          teams.push({ selected: true, name: team.name, id: team.id, projects_count: team.projects_count, members: team.members });
        }
        state.teams = teams;
        state.loadingTeams = false;
      })
      .addCase(fetchReportingTeams.pending, state => {
        state.loadingTeams = true;
      })
      .addCase(fetchReportingTeams.rejected, state => {
        state.loadingTeams = false;
      })
      .addCase(fetchProjectData.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProjectData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.total = action.payload.total || 0;
        state.projectList = action.payload.projects || [];
      })
      .addCase(fetchProjectData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch project data';
      })
      .addCase(fetchMoreProjectsForGroupedView.pending, state => {
        state.isLoadingMore = true;
        state.error = null;
      })
      .addCase(fetchMoreProjectsForGroupedView.fulfilled, (state, action) => {
        state.isLoadingMore = false;
        state.total = action.payload.total || 0;
        // Append new projects to existing list
        state.projectList = [...state.projectList, ...(action.payload.projects || [])];
      })
      .addCase(fetchMoreProjectsForGroupedView.rejected, (state, action) => {
        state.isLoadingMore = false;
        state.error = action.error.message || 'Failed to fetch more projects';
      })
      .addCase(updateProjectCategory, (state, action) => {
        const { projectId, category } = action.payload;
        const projectIndex = state.projectList.findIndex(project => project.id === projectId);

        if (projectIndex !== -1) {
          state.projectList[projectIndex].category_id = category.id || null;
          state.projectList[projectIndex].category_name = category.name ?? '';
          state.projectList[projectIndex].category_color = category.color_code ?? '';
        }
      })
      .addCase(updateProjectStatus, (state, action) => {
        const { projectId, status } = action.payload;
        const projectIndex = state.projectList.findIndex(project => project.id === projectId);

        if (projectIndex !== -1) {
          state.projectList[projectIndex].status_id = status.id || '';
          state.projectList[projectIndex].status_name = status.name ?? '';
          state.projectList[projectIndex].status_color = status.color_code ?? '';
        }
      })
      .addCase(fetchGroupedProjects.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGroupedProjects.fulfilled, (state, action) => {
        state.isLoading = false;
        state.groupedProjects = action.payload?.groups || [];
        state.totalGroups = action.payload?.total_groups || 0;
      })
      .addCase(fetchGroupedProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch grouped projects';
      });
  },
});

export const {
  toggleProjectReportsDrawer,
  toggleProjectReportsMembersTaskDrawer,
  setSearchQuery,
  setSelectOrDeselectAllTeams,
  setSelectOrDeselectTeam,
  setSelectedProjectStatuses,
  setSelectedProjectHealths,
  setSelectedProjectCategories,
  setSelectedProjectManagers,
  setArchived,
  setProjectStartDate,
  setProjectEndDate,
  setIndex,
  setPageSize,
  setField,
  setOrder,
  setProjectHealth,
  setProjectStatus,
  setSelectedMember,
  setSelectedProject,
  setSelectedProjectCategory,
  setViewMode,
  setGroupBy,
  resetProjectReports,
  resetAllFilters,
} = projectReportsSlice.actions;
export default projectReportsSlice.reducer;