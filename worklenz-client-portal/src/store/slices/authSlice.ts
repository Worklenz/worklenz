import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { ClientUser, ClientToken } from '@/types';
import { clientPortalAPI } from '@/services/api';

interface AuthState {
  user: ClientUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  inviteToken: string | null;
  inviteValid: boolean;
  inviteLoading: boolean;
  inviteDetails: {
    email?: string;
    name?: string;
    organizationName?: string;
    clientName?: string;
    companyName?: string;
    isOrganizationInvite?: boolean;
  } | null;
  tokenExpiry: string | null;
}

// Async thunks for authentication
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await clientPortalAPI.login(credentials);
      if (response.done) {
        // Set token in API service
        clientPortalAPI.setToken(response.body.token);
        return response.body;
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Login failed');
    }
  }
);

export const validateInviteToken = createAsyncThunk(
  'auth/validateInvite',
  async (token: string, { rejectWithValue }) => {
    try {
      const response = await clientPortalAPI.validateInvite(token);
      if (response.done) {
        return { token, ...response.body };
      } else {
        throw new Error(response.message || 'Invalid invite token');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Invalid invite token');
    }
  }
);

export const acceptInvite = createAsyncThunk(
  'auth/acceptInvite',
  async (
    inviteData: { 
      token: string; 
      name: string; 
      email: string; 
      password: string; 
    }, 
    { rejectWithValue }
  ) => {
    try {
      const response = await clientPortalAPI.acceptInvite(inviteData);
      if (response.done) {
        // Set token in API service
        clientPortalAPI.setToken(response.body.token);
        return response.body;
      } else {
        throw new Error(response.message || 'Failed to accept invite');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to accept invite');
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const currentToken = state.auth.token;
      
      if (!currentToken) {
        throw new Error('No token available');
      }
      
      const response = await clientPortalAPI.refreshToken();
      if (response.done) {
        // Set token in API service
        clientPortalAPI.setToken(response.body.token);
        return response.body;
      } else {
        throw new Error(response.message || 'Token refresh failed');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Token refresh failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await clientPortalAPI.logout();
      return true;
    } catch (error) {
      // Even if logout fails, we still want to clear local state
      return rejectWithValue(error instanceof Error ? error.message : 'Logout failed');
    }
  }
);

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('clientToken'),
  isAuthenticated: !!localStorage.getItem('clientToken'),
  isLoading: false,
  error: null,
  inviteToken: null,
  inviteValid: false,
  inviteLoading: false,
  inviteDetails: null,
  tokenExpiry: localStorage.getItem('clientTokenExpiry'),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<ClientUser>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem('clientToken', action.payload);
    },
    setTokenWithExpiry: (state, action: PayloadAction<ClientToken>) => {
      state.token = action.payload.token;
      state.tokenExpiry = action.payload.expiresAt;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem('clientToken', action.payload.token);
      localStorage.setItem('clientTokenExpiry', action.payload.expiresAt);
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.tokenExpiry = null;
      state.isAuthenticated = false;
      state.error = null;
      state.inviteToken = null;
      state.inviteValid = false;
      localStorage.removeItem('clientToken');
      localStorage.removeItem('clientTokenExpiry');
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.tokenExpiry = null;
      state.isAuthenticated = false;
      state.error = null;
      state.inviteToken = null;
      state.inviteValid = false;
      state.inviteLoading = false;
      localStorage.removeItem('clientToken');
      localStorage.removeItem('clientTokenExpiry');
    },
    setInviteToken: (state, action: PayloadAction<string | null>) => {
      state.inviteToken = action.payload;
    },
    setInviteValid: (state, action: PayloadAction<boolean>) => {
      state.inviteValid = action.payload;
    },
    setInviteLoading: (state, action: PayloadAction<boolean>) => {
      state.inviteLoading = action.payload;
    },
    // Check if token is expired
    checkTokenExpiry: (state) => {
      if (state.tokenExpiry) {
        const now = new Date().getTime();
        const expiry = new Date(state.tokenExpiry).getTime();
        if (now >= expiry) {
          state.user = null;
          state.token = null;
          state.tokenExpiry = null;
          state.isAuthenticated = false;
          localStorage.removeItem('clientToken');
          localStorage.removeItem('clientTokenExpiry');
        }
      }
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.tokenExpiry = action.payload.expiresAt;
        state.isAuthenticated = true;
        state.error = null;
        localStorage.setItem('clientToken', action.payload.token);
        if (action.payload.expiresAt) {
          localStorage.setItem('clientTokenExpiry', action.payload.expiresAt);
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Validate invite
    builder
      .addCase(validateInviteToken.pending, (state) => {
        state.inviteLoading = true;
        state.error = null;
      })
      .addCase(validateInviteToken.fulfilled, (state, action) => {
        state.inviteLoading = false;
        state.inviteValid = true;
        state.inviteToken = action.payload.token;
        state.inviteDetails = {
          email: action.payload.email,
          organizationName: action.payload.organizationName,
        };
        state.error = null;
      })
      .addCase(validateInviteToken.rejected, (state, action) => {
        state.inviteLoading = false;
        state.inviteValid = false;
        state.error = action.payload as string;
      });

    // Accept invite
    builder
      .addCase(acceptInvite.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(acceptInvite.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.tokenExpiry = action.payload.expiresAt;
        state.isAuthenticated = true;
        state.error = null;
        state.inviteToken = null;
        state.inviteValid = false;
        localStorage.setItem('clientToken', action.payload.token);
        if (action.payload.expiresAt) {
          localStorage.setItem('clientTokenExpiry', action.payload.expiresAt);
        }
      })
      .addCase(acceptInvite.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Refresh token
    builder
      .addCase(refreshToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.tokenExpiry = action.payload.expiresAt;
        state.error = null;
        localStorage.setItem('clientToken', action.payload.token);
        if (action.payload.expiresAt) {
          localStorage.setItem('clientTokenExpiry', action.payload.expiresAt);
        }
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        // If refresh fails, logout
        state.user = null;
        state.token = null;
        state.tokenExpiry = null;
        state.isAuthenticated = false;
        localStorage.removeItem('clientToken');
        localStorage.removeItem('clientTokenExpiry');
      });

    // Logout
    builder
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.tokenExpiry = null;
        state.isAuthenticated = false;
        state.error = null;
        state.inviteToken = null;
        state.inviteValid = false;
        localStorage.removeItem('clientToken');
        localStorage.removeItem('clientTokenExpiry');
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        // Even if logout fails, clear local state
        state.user = null;
        state.token = null;
        state.tokenExpiry = null;
        state.isAuthenticated = false;
        state.error = action.payload as string;
        state.inviteToken = null;
        state.inviteValid = false;
        localStorage.removeItem('clientToken');
        localStorage.removeItem('clientTokenExpiry');
      });
  },
});

export const { 
  setUser, 
  setToken, 
  setTokenWithExpiry,
  logout, 
  setLoading, 
  setError,
  clearAuth,
  setInviteToken,
  setInviteValid,
  setInviteLoading,
  checkTokenExpiry
} = authSlice.actions;

export default authSlice.reducer; 