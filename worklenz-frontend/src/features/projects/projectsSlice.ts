import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { projectsApiService } from '@/api/projects/projects.api.service';
import logger from '@/utils/errorLogger';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { IProjectCategory } from '@/types/project/projectCategory.types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { IProjectManager } from '@/types/project/projectManager.types';

interface ProjectState {
  projects: {
    data: IProjectViewModel[];
    total: number;
  };
  categories: IProjectCategory[];
  loading: boolean;
  creatingProject: boolean;
  initialized: boolean;
  isProjectDrawerOpen: boolean;
  isSaveAsTemplateDrawerOpen: boolean;
  filteredCategories: string[];
  filteredStatuses: string[];
  requestParams: {
    index: number;
    size: number;
    field: string;
    order: string;
    search: string;
    filter: number;
    statuses: string | null;
    categories: string | null;
  };
  projectManagers: IProjectManager[];
  projectManagersLoading: boolean;
}

const initialState: ProjectState = {
  projects: {
    data: [],
    total: 0,
  },
  categories: [],
  loading: false,
  creatingProject: false,
  initialized: false,
  isProjectDrawerOpen: false,
  isSaveAsTemplateDrawerOpen: false,
  filteredCategories: [],
  filteredStatuses: [],
  requestParams: {
    index: 1,
    size: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'ascend',
    search: '',
    filter: 0,
    statuses: null,
    categories: null,
  },
  projectManagers: [],
  projectManagersLoading: false,
};

// Create async thunk for fetching teams
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
        params.categories
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
    const response = await projectsApiService.updateProject(id, project);
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
    setRequestParams: (state, action: PayloadAction<Partial<ProjectState['requestParams']>>) => {
      state.requestParams = {
        ...state.requestParams,
        ...action.payload,
      };
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
  setRequestParams,
} = projectSlice.actions;
export default projectSlice.reducer;
