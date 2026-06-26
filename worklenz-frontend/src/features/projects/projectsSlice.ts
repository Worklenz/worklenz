import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { projectsApiService } from '@/api/projects/projects.api.service';
import logger from '@/utils/errorLogger';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { IProjectCategory } from '@/types/project/projectCategory.types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { IProjectManager } from '@/types/project/projectManager.types';
import { IGroupedProjectsViewModel } from '@/types/project/groupedProjectsViewModel.types';
import { ProjectGroupBy } from '@/types/project/project.types';

interface ProjectState {
  projects: {
    data: IProjectViewModel[];
    total: number;
  };
  groupedProjects: {
    data: IGroupedProjectsViewModel | null;
    loading: boolean;
  };
  categories: IProjectCategory[];
  loading: boolean;
  creatingProject: boolean;
  initialized: boolean;
  isProjectDrawerOpen: boolean;
  isSaveAsTemplateDrawerOpen: boolean;
  filteredCategories: string[];
  filteredStatuses: string[];
  filteredPriorities: string[]; // FIX #1: was missing from interface
  requestParams: {
    index: number;
    size: number;
    field: string;
    order: string;
    search: string;
    filter: number;
    statuses: string | null;
    categories: string | null;
    priorities: string | null; // FIX #2: was missing from interface
  };
  groupedRequestParams: {
    index: number;
    size: number;
    field: string;
    order: string;
    search: string;
    groupBy: string;
    filter: number;
    statuses: string | null;
    categories: string | null;
    priorities: string | null; // FIX #2: was missing from interface
  };
  projectManagers: IProjectManager[];
  projectManagersLoading: boolean;
}

interface UpdateProjectMemberDefaultViewPayload {
  projectId: string;
  defaultView: 'BOARD' | 'TASK_LIST';
}

const initialState: ProjectState = {
  projects: {
    data: [],
    total: 0,
  },
  groupedProjects: {
    data: null,
    loading: false,
  },
  categories: [],
  loading: false,
  creatingProject: false,
  initialized: false,
  isProjectDrawerOpen: false,
  isSaveAsTemplateDrawerOpen: false,
  filteredCategories: [],
  filteredStatuses: [],
  filteredPriorities: [], // FIX #1: now properly typed
  requestParams: {
    index: 1,
    size: DEFAULT_PAGE_SIZE,
    field: '',
    order: '',
    search: '',
    filter: 0,
    statuses: null,
    categories: null,
    priorities: null,
  },
  groupedRequestParams: {
    index: 1,
    size: DEFAULT_PAGE_SIZE,
    field: 'priority',
    order: 'descend',
    search: '',
    groupBy: ProjectGroupBy.PRIORITY,
    filter: 0,
    statuses: null,
    categories: null,
    priorities: null, // FIX #2: now properly typed
  },
  projectManagers: [],
  projectManagersLoading: false,
};

export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async (
    params: {
      index: number;
      size: number;
      field: string;
      order: string;
      search: string;
      filter: number;
      statuses: string | null;
      categories: string | null;
      priorities: string | null;
    },
    { rejectWithValue }
  ) => {
    try {
      const projectsResponse = await projectsApiService.getProjects(
        params.index,
        params.size,
        params.field,
        params.order,
        params.search,
        params.filter,
        params.statuses,
        params.categories,
        params.priorities
      );
      return projectsResponse.body;
    } catch (error) {
      logger.error('Fetch Projects', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch projects');
    }
  }
);

export const fetchGroupedProjects = createAsyncThunk(
  'projects/fetchGroupedProjects',
  async (
    params: {
      index: number;
      size: number;
      field: string;
      order: string;
      search: string;
      groupBy: string;
      filter: number;
      statuses: string | null;
      categories: string | null;
      priorities: string | null;
    },
    { rejectWithValue }
  ) => {
    try {
      const groupedProjectsResponse = await projectsApiService.getGroupedProjects(
        params.index,
        params.size,
        params.field,
        params.order,
        params.search,
        params.groupBy,
        params.filter,
        params.statuses,
        params.categories,
        params.priorities
      );
      return groupedProjectsResponse.body;
    } catch (error) {
      logger.error('Fetch Grouped Projects', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch grouped projects');
    }
  }
);

export const toggleFavoriteProject = createAsyncThunk(
  'projects/toggleFavoriteProject',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await projectsApiService.toggleFavoriteProject(id);
      return response.body;
    } catch (error) {
      logger.error('Toggle Favorite Project', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
    }
  }
);

export const createProject = createAsyncThunk(
  'projects/createProject',
  async (project: IProjectViewModel, { rejectWithValue }) => {
    try {
      const response = await projectsApiService.createProject(project);
      return response.body;
    } catch (error) {
      logger.error('Create Project', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
    }
  }
);

export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async ({ id, project }: { id: string; project: IProjectViewModel }, { rejectWithValue }) => {
    const response = await projectsApiService.updateProject({ id, ...project });
    return response.body;
  }
);

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (id: string, { rejectWithValue }) => {
    const response = await projectsApiService.deleteProject(id);
    return response.body;
  }
);

export const toggleArchiveProject = createAsyncThunk(
  'projects/toggleArchiveProject',
  async (id: string, { rejectWithValue }) => {
    const response = await projectsApiService.toggleArchiveProject(id);
    return response.body;
  }
);

export const toggleArchiveProjectForAll = createAsyncThunk(
  'projects/toggleArchiveProjectForAll',
  async (id: string, { rejectWithValue }) => {
    const response = await projectsApiService.toggleArchiveProjectForAll(id);
    return response.body;
  }
);

export const fetchProjectManagers = createAsyncThunk(
  'projects/fetchProjectManagers',
  async (_, { rejectWithValue }) => {
    const response = await projectsApiService.getProjectManagers();
    return response.body;
  }
);

const projectSlice = createSlice({
  name: 'projectReducer',
  initialState,
  reducers: {
    toggleDrawer: state => {
      state.isProjectDrawerOpen = !state.isProjectDrawerOpen;
    },
    toggleSaveAsTemplateDrawer: state => {
      state.isSaveAsTemplateDrawerOpen = !state.isSaveAsTemplateDrawerOpen;
    },
    createProject: (state, action: PayloadAction<IProjectViewModel>) => {
      state.creatingProject = true;
    },
    deleteProject: (state, action: PayloadAction<string>) => {},
    setCategories: (state, action: PayloadAction<IProjectCategory[]>) => {
      state.categories = action.payload;
    },
    setFilteredCategories: (state, action: PayloadAction<string[]>) => {
      state.filteredCategories = action.payload;
    },
    setFilteredStatuses: (state, action: PayloadAction<string[]>) => {
      state.filteredStatuses = action.payload;
    },
    setFilteredPriorities: (state, action: PayloadAction<string[]>) => {
      state.filteredPriorities = action.payload;
    },
    // FIX #2: priorities is now properly typed in the interface so it
    // will be included in the spread and never silently dropped
    setRequestParams: (state, action: PayloadAction<Partial<ProjectState['requestParams']>>) => {
      state.requestParams = {
        ...state.requestParams,
        ...action.payload,
      };
    },
    setGroupedRequestParams: (
      state,
      action: PayloadAction<Partial<ProjectState['groupedRequestParams']>>
    ) => {
      state.groupedRequestParams = {
        ...state.groupedRequestParams,
        ...action.payload,
      };
    },
    setProjectMemberDefaultView: (
      state,
      action: PayloadAction<UpdateProjectMemberDefaultViewPayload>
    ) => {
      const { projectId, defaultView } = action.payload;

      state.projects.data = state.projects.data.map(project =>
        project.id === projectId ? { ...project, team_member_default_view: defaultView } : project
      );

      if (state.groupedProjects.data?.data) {
        state.groupedProjects.data.data = state.groupedProjects.data.data.map(group => ({
          ...group,
          projects: group.projects.map(project =>
            project.id === projectId
              ? { ...project, team_member_default_view: defaultView }
              : project
          ),
        }));
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchProjects.pending, state => {
        state.loading = true;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = {
          data: action.payload?.data || [],
          total: action.payload?.total || 0,
        };
        state.initialized = true;
      })
      .addCase(fetchProjects.rejected, state => {
        state.loading = false;
      })
      .addCase(fetchGroupedProjects.pending, state => {
        state.groupedProjects.loading = true;
      })
      .addCase(fetchGroupedProjects.fulfilled, (state, action) => {
        state.groupedProjects.loading = false;
        state.groupedProjects.data = action.payload;
      })
      .addCase(fetchGroupedProjects.rejected, state => {
        state.groupedProjects.loading = false;
      })
      .addCase(createProject.pending, state => {
        state.creatingProject = true;
      })
      .addCase(createProject.fulfilled, state => {
        state.creatingProject = false;
      })
      .addCase(createProject.rejected, state => {
        state.creatingProject = false;
      })
      .addCase(toggleArchiveProject.fulfilled, state => {
        state.loading = false;
      })
      .addCase(toggleArchiveProjectForAll.fulfilled, state => {
        state.loading = false;
      })
      .addCase(fetchProjectManagers.pending, state => {
        state.projectManagersLoading = true;
      })
      .addCase(fetchProjectManagers.fulfilled, (state, action) => {
        state.projectManagersLoading = false;
        state.projectManagers = action.payload;
      })
      .addCase(fetchProjectManagers.rejected, state => {
        state.projectManagersLoading = false;
      });
  },
});

export const {
  toggleDrawer,
  toggleSaveAsTemplateDrawer,
  setCategories,
  setFilteredCategories,
  setFilteredStatuses,
  setFilteredPriorities,
  setRequestParams,
  setGroupedRequestParams,
  setProjectMemberDefaultView,
} = projectSlice.actions;
export default projectSlice.reducer;