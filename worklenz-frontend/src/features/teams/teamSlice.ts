import { createAsyncThunk, createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit';
import { teamsApiService } from '@/api/teams/teams.api.service';
import logger from '@/utils/errorLogger';
import { ITeam, ITeamGetResponse, ITeamState } from '@/types/teams/team.type';
import { API_BASE_URL } from '@/shared/constants';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';

const initialState: ITeamState = {
  teamsList: [],
  loading: false,
  error: null,
  initialized: false,
  activeTeamId: null,
  ui: {
    drawer: false,
    settingsDrawer: false,
    updateTitleNameModal: false,
  },
};

// Create async thunk for fetching teams
export const fetchTeams = createAsyncThunk(
  `${API_BASE_URL}/teams`,
  async (_, { rejectWithValue }) => {
    try {
      const teamsResponse = await teamsApiService.getTeams();
      return teamsResponse.body;
    } catch (error) {
      logger.error('Fetch Teams', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch teams');
    }
  }
);

// Create async thunk for fetching teams
export const setActiveTeam = createAsyncThunk(
  `${API_BASE_URL}/teams/activate`,
  async (teamId: string, { rejectWithValue }) => {
    try {
      const teamsResponse = await teamsApiService.setActiveTeam(teamId);
      return teamsResponse.body;
    } catch (error) {
      logger.error('Fetch Teams', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch teams');
    }
  }
);

// Create async thunk for editing team name
export const editTeamName = createAsyncThunk(
  `${API_BASE_URL}/teams/name`,
  async ({ id, name }: { id: string; name: string }, { rejectWithValue }) => {
    try {
      const teamsResponse = await profileSettingsApiService.updateTeamName(id, { name });
      return teamsResponse;
    } catch (error) {
      logger.error('Edit Team Name', error);

      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to edit team name');
    }
  }
);

// Initialization thunk

// Initialization thunk
export const initializeTeams = createAsyncThunk(
  'team/initialize',
  async (_, { dispatch, getState }) => {
    const state = getState() as { teamReducer: ITeamState };
    if (!state.teamReducer.initialized) {
      await dispatch(fetchTeams());
    }
  }
);

const teamSlice = createSlice({
  name: 'teamReducer',
  initialState,
  reducers: {
    toggleDrawer: state => {
      state.ui.drawer ? (state.ui.drawer = false) : (state.ui.drawer = true);
    },
    addTeam: (state, action: PayloadAction<ITeam>) => {
      state.teamsList.push(action.payload);
    },
    toggleSettingDrawer: state => {
      state.ui.settingsDrawer
        ? (state.ui.settingsDrawer = false)
        : (state.ui.settingsDrawer = true);
    },
    updateTeam: (state, action: PayloadAction<ITeam>) => {
      const index = state.teamsList.findIndex(team => team.id === action.payload.id);
      state.teamsList[index] = action.payload;
    },
    deleteTeam: (state, action: PayloadAction<string>) => {
      state.teamsList = state.teamsList.filter(team => team.id !== action.payload);
    },
    toggleUpdateTeamNameModal: state => {
      state.ui.updateTitleNameModal
        ? (state.ui.updateTitleNameModal = false)
        : (state.ui.updateTitleNameModal = true);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchTeams.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeams.fulfilled, (state, action: PayloadAction<ITeamGetResponse[]>) => {
        state.loading = false;
        state.teamsList = action.payload;
        state.error = null;
      })
      .addCase(fetchTeams.rejected, (state, action) => {
        state.loading = false;
        state.error = 'Failed to fetch teams';
      });
  },
});

export const {
  toggleDrawer,
  addTeam,
  toggleSettingDrawer,
  updateTeam,
  deleteTeam,
  toggleUpdateTeamNameModal,
} = teamSlice.actions;
export default teamSlice.reducer;
