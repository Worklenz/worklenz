import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  projectRateCardApiService,
  IProjectRateCardRole,
} from '@/api/project-finance-ratecard/project-finance-rate-cards.api.service';
import logger from '@/utils/errorLogger';
import { JobRoleType } from '@/types/project/ratecard.types';

type ProjectFinanceRateCardState = {
  isDrawerOpen: boolean;
  isLoading: boolean;
  rateCardRoles: JobRoleType[] | null;
  drawerRole: IProjectRateCardRole | null;
  error?: string | null;
};

const initialState: ProjectFinanceRateCardState = {
  isDrawerOpen: false,
  isLoading: false,
  rateCardRoles: null,
  drawerRole: null,
  error: null,
};

// Async thunks
export const fetchProjectRateCardRoles = createAsyncThunk(
  'projectFinance/fetchAll',
  async (project_id: string, { rejectWithValue }) => {
    try {
      const response = await projectRateCardApiService.getFromProjectId(project_id);
      return response.body;
    } catch (error) {
      logger.error('Fetch Project RateCard Roles', error);
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue('Failed to fetch project rate card roles');
    }
  }
);

export const fetchProjectRateCardRoleById = createAsyncThunk(
  'projectFinance/fetchById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await projectRateCardApiService.getFromId(id);
      return response.body;
    } catch (error) {
      logger.error('Fetch Project RateCard Role By Id', error);
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue('Failed to fetch project rate card role');
    }
  }
);

export const insertProjectRateCardRoles = createAsyncThunk(
  'projectFinance/insertMany',
  async (
    {
      project_id,
      roles,
    }: { project_id: string; roles: Omit<IProjectRateCardRole, 'id' | 'project_id'>[] },
    { rejectWithValue }
  ) => {
    try {
      const response = await projectRateCardApiService.insertMany(project_id, roles);
      return response.body;
    } catch (error) {
      logger.error('Insert Project RateCard Roles', error);
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue('Failed to insert project rate card roles');
    }
  }
);

export const insertProjectRateCardRole = createAsyncThunk(
  'projectFinance/insertOne',
  async (
    {
      project_id,
      job_title_id,
      rate,
      man_day_rate,
    }: { project_id: string; job_title_id: string; rate: number; man_day_rate?: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await projectRateCardApiService.insertOne({
        project_id,
        job_title_id,
        rate,
        man_day_rate,
      });
      return response.body;
    } catch (error) {
      logger.error('Insert Project RateCard Role', error);
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue('Failed to insert project rate card role');
    }
  }
);

export const updateProjectRateCardRoleById = createAsyncThunk(
  'projectFinance/updateById',
  async (
    {
      id,
      body,
    }: { id: string; body: { job_title_id: string; rate?: string; man_day_rate?: string } },
    { rejectWithValue }
  ) => {
    try {
      const response = await projectRateCardApiService.updateFromId(id, body);
      return response.body;
    } catch (error) {
      logger.error('Update Project RateCard Role By Id', error);
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue('Failed to update project rate card role');
    }
  }
);

export const updateProjectRateCardRolesByProjectId = createAsyncThunk(
  'projectFinance/updateByProjectId',
  async (
    {
      project_id,
      roles,
    }: { project_id: string; roles: Omit<IProjectRateCardRole, 'id' | 'project_id'>[] },
    { rejectWithValue }
  ) => {
    try {
      const response = await projectRateCardApiService.updateFromProjectId(project_id, roles);
      return response.body;
    } catch (error) {
      logger.error('Update Project RateCard Roles By ProjectId', error);
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue('Failed to update project rate card roles');
    }
  }
);

export const deleteProjectRateCardRoleById = createAsyncThunk(
  'projectFinance/deleteById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await projectRateCardApiService.deleteFromId(id);
      return response.body;
    } catch (error) {
      logger.error('Delete Project RateCard Role By Id', error);
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue('Failed to delete project rate card role');
    }
  }
);

export const assignMemberToRateCardRole = createAsyncThunk(
  'projectFinance/assignMemberToRateCardRole',
  async ({
    project_id,
    member_id,
    project_rate_card_role_id,
  }: {
    project_id: string;
    member_id: string;
    project_rate_card_role_id: string;
  }) => {
    const response = await projectRateCardApiService.updateMemberRateCardRole(
      project_id,
      member_id,
      project_rate_card_role_id
    );
    return response.body;
  }
);

export const deleteProjectRateCardRolesByProjectId = createAsyncThunk(
  'projectFinance/deleteByProjectId',
  async (project_id: string, { rejectWithValue }) => {
    try {
      const response = await projectRateCardApiService.deleteFromProjectId(project_id);
      return response.body;
    } catch (error) {
      logger.error('Delete Project RateCard Roles By ProjectId', error);
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue('Failed to delete project rate card roles');
    }
  }
);

const projectFinanceSlice = createSlice({
  name: 'projectFinanceRateCard',
  initialState,
  reducers: {
    toggleDrawer: state => {
      state.isDrawerOpen = !state.isDrawerOpen;
    },
    clearDrawerRole: state => {
      state.drawerRole = null;
    },
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      // Fetch all
      .addCase(fetchProjectRateCardRoles.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProjectRateCardRoles.fulfilled, (state, action) => {
        state.isLoading = false;
        state.rateCardRoles = action.payload || [];
      })
      .addCase(fetchProjectRateCardRoles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.rateCardRoles = [];
      })
      // Fetch by id
      .addCase(fetchProjectRateCardRoleById.pending, state => {
        state.isLoading = true;
        state.drawerRole = null;
        state.error = null;
      })
      .addCase(fetchProjectRateCardRoleById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.drawerRole = action.payload || null;
      })
      .addCase(fetchProjectRateCardRoleById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.drawerRole = null;
      })
      // Insert many
      .addCase(insertProjectRateCardRoles.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(insertProjectRateCardRoles.fulfilled, (state, action) => {
        state.isLoading = false;
        state.rateCardRoles = action.payload || [];
      })
      .addCase(insertProjectRateCardRoles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Update by id
      .addCase(updateProjectRateCardRoleById.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProjectRateCardRoleById.fulfilled, (state, action) => {
        state.isLoading = false;
        if (state.rateCardRoles && action.payload) {
          state.rateCardRoles = state.rateCardRoles.map(role =>
            role.id === action.payload.id ? action.payload : role
          );
        }
      })
      .addCase(updateProjectRateCardRoleById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Update by project id
      .addCase(updateProjectRateCardRolesByProjectId.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProjectRateCardRolesByProjectId.fulfilled, (state, action) => {
        state.isLoading = false;
        state.rateCardRoles = action.payload || [];
      })
      .addCase(updateProjectRateCardRolesByProjectId.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Delete by id
      .addCase(deleteProjectRateCardRoleById.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteProjectRateCardRoleById.fulfilled, (state, action) => {
        state.isLoading = false;
        if (state.rateCardRoles && action.payload) {
          state.rateCardRoles = state.rateCardRoles.filter(role => role.id !== action.payload.id);
        }
      })
      .addCase(deleteProjectRateCardRoleById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Delete by project id
      .addCase(deleteProjectRateCardRolesByProjectId.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteProjectRateCardRolesByProjectId.fulfilled, state => {
        state.isLoading = false;
        state.rateCardRoles = [];
      })
      .addCase(deleteProjectRateCardRolesByProjectId.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { toggleDrawer, clearDrawerRole, clearError } = projectFinanceSlice.actions;

export default projectFinanceSlice.reducer;
