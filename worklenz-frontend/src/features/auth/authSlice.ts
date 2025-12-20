import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApiService } from '@/api/auth/auth.api.service';
import { IAuthState, IAuthorizeResponse, IUserLoginRequest } from '@/types/auth/login.types';
import { IUserSignUpRequest } from '@/types/auth/signup.types';
import logger from '@/utils/errorLogger';
import { deleteSession, setSession } from '@/utils/session-helper';

// Initial state
const initialState: IAuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  teamId: undefined,
  projectId: undefined,
};

// Helper function for error handling
const handleAuthError = (error: any, action: string) => {
  logger.error(action, error);
  return error.response?.data?.message || 'An unknown error has occurred';
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: IUserLoginRequest, { rejectWithValue }) => {
    try {
      await authApiService.login(credentials);
      const authorizeResponse = await authApiService.verify();

      if (!authorizeResponse.authenticated) {
        return rejectWithValue(authorizeResponse.auth_error || 'Authorization failed');
      }

      return authorizeResponse;
    } catch (error: any) {
      return rejectWithValue(handleAuthError(error, 'Login'));
    }
  }
);

export const signUp = createAsyncThunk(
  'auth/signup',
  async (credentials: IUserSignUpRequest, { rejectWithValue }) => {
    try {
      const signUpResponse = await authApiService.signUp(credentials);
      const authorizeResponse = await authApiService.verify();

      if (!authorizeResponse.authenticated) {
        // If signup was successful but not authenticated (e.g., pending approval)
        if (signUpResponse.done) {
          deleteSession();
          return {
            authenticated: false,
            message: signUpResponse.message || 'Registration successful. Awaiting approval.',
          };
        }
        return rejectWithValue(authorizeResponse.auth_error || 'Authorization failed');
      }

      if (authorizeResponse.user) {
        setSession(authorizeResponse.user);
      }

      return authorizeResponse;
    } catch (error: any) {
      return rejectWithValue(handleAuthError(error, 'SignUp'));
    }
  }
);

export const logout = createAsyncThunk('secure/logout', async (_, { rejectWithValue }) => {
  try {
    const response = await authApiService.logout();
    if (!response.done) {
      return rejectWithValue(response.message || 'Logout failed');
    }
    return response;
  } catch (error: any) {
    return rejectWithValue(handleAuthError(error, 'Logout'));
  }
});

export const verifyAuthentication = createAsyncThunk('secure/verify', async () => {
  return await authApiService.verify();
});

export const resetPassword = createAsyncThunk('auth/resetPassword', async (email: string) => {
  return await authApiService.resetPassword(email);
});

export const updatePassword = createAsyncThunk('auth/updatePassword', async (values: any) => {
  return await authApiService.updatePassword(values);
});

const applyAuthorizeResponse = (state: IAuthState, response?: IAuthorizeResponse | null) => {
  const isAuthenticated = !!response?.authenticated;
  state.isAuthenticated = isAuthenticated;
  state.user = isAuthenticated ? response?.user ?? null : null;

  if (isAuthenticated && response?.user) {
    setSession(response.user);
  } else {
    deleteSession();
  }
};

// Common state updates
const setPending = (state: IAuthState) => {
  state.isLoading = true;
  state.error = null;
};

const setRejected = (state: IAuthState, action: any) => {
  state.isLoading = false;
  state.error = action.payload as string;
};

// Slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTeamAndProject: (state, action: { payload: { teamId?: string; projectId?: string } }) => {
      state.teamId = action.payload.teamId;
      state.projectId = action.payload.projectId;
    },
  },
  extraReducers: builder => {
    builder
      // Login cases
      .addCase(login.pending, setPending)
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        applyAuthorizeResponse(state, action.payload);
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        setRejected(state, action);
        applyAuthorizeResponse(state, null);
      })

      // Logout cases
      .addCase(logout.pending, setPending)
      .addCase(logout.fulfilled, state => {
        state.isLoading = false;
        applyAuthorizeResponse(state, null);
        state.error = null;
        state.teamId = undefined;
        state.projectId = undefined;
      })
      .addCase(logout.rejected, (state, action) => {
        setRejected(state, action);
        applyAuthorizeResponse(state, null);
      })

      // Verify authentication cases
      .addCase(verifyAuthentication.pending, state => {
        state.isLoading = true;
      })
      .addCase(verifyAuthentication.fulfilled, (state, action) => {
        state.isLoading = false;
        applyAuthorizeResponse(state, action.payload);
      })
      .addCase(verifyAuthentication.rejected, state => {
        state.isLoading = false;
        applyAuthorizeResponse(state, null);
      });
  },
});

export const { setTeamAndProject } = authSlice.actions;
export default authSlice.reducer;
