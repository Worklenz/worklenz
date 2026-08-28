import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { ClientUser, ClientToken, ClientOrganization } from '@/types';
import { clientPortalAPI } from '@/services/api';

interface AuthState {
  user: ClientUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  inviteToken: string | null;
  inviteValid: boolean;
  inviteChecked: boolean;
  inviteLoading: boolean;
  inviteDetails: {
    email?: string;
    name?: string;
    organizationName?: string;
    clientName?: string;
    companyName?: string;
    isOrganizationInvite?: boolean;
    isExistingWorklenzUser?: boolean;
  } | null;
  tokenExpiry: string | null;
  organizations: ClientOrganization[];
  currentOrganizationId: string | null;
  switchingOrganization: boolean;
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
    } catch (error: any) {
      // Extract error message from API response
      const errorMessage = error?.response?.data?.message || error?.message || 'Login failed';
      return rejectWithValue(errorMessage);
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
    } catch (error: any) {
      // Extract error message from API response
      const errorMessage = error?.response?.data?.message || error?.message || 'Invalid invite token';
      return rejectWithValue(errorMessage);
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
        // If response.done is false, check for messageKey or titleKey
        const messageKey = (response as any).messageKey || (response as any).titleKey;
        const message = response.message || 'Failed to accept invite';
        return rejectWithValue(messageKey || message);
      }
    } catch (error: any) {
      // Extract error message from API response
      // Check both error.response.data (for axios errors) and error.response (for direct responses)
      const responseData = error?.response?.data || error?.response;
      const messageKey = responseData?.messageKey;
      const titleKey = responseData?.titleKey;
      const message = responseData?.message || error?.message || 'Failed to accept invite';
      
      // Prefer messageKey over message, as it's the i18n key
      return rejectWithValue(messageKey || titleKey || message);
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

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await clientPortalAPI.getCurrentUser();
      if (response.done) {
        return response.body;
      } else {
        throw new Error(response.message || 'Failed to fetch user information');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch user information');
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

export const switchOrganization = createAsyncThunk(
  'auth/switchOrganization',
  async (organizationId: string, { rejectWithValue }) => {
    try {
      const response = await clientPortalAPI.switchOrganization(organizationId);
      if (response.done) {
        // Set new token in API service
        clientPortalAPI.setToken(response.body.token);
        return response.body;
      } else {
        throw new Error(response.message || 'Failed to switch organization');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to switch organization');
    }
  }
);

export const fetchOrganizations = createAsyncThunk(
  'auth/fetchOrganizations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await clientPortalAPI.getOrganizations();
      if (response.done) {
        return response.body.organizations;
      } else {
        throw new Error(response.message || 'Failed to fetch organizations');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch organizations');
    }
  }
);

export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { dispatch }) => {
    try {
      const token = localStorage.getItem('clientToken');
      const tokenExpiry = localStorage.getItem('clientTokenExpiry');
      
      // If no token exists, user is not authenticated
      if (!token) {
        dispatch(clearAuth());
        return { isAuthenticated: false };
      }

      // Check if token is expired
      if (tokenExpiry) {
        const now = new Date().getTime();
        const expiry = new Date(tokenExpiry).getTime();
        if (now >= expiry) {
          dispatch(clearAuth());
          return { isAuthenticated: false };
        }
      }

      // Set token in API service
      clientPortalAPI.setToken(token);

      // Validate token by fetching current user (bypasses interceptor retry)
      const response = await clientPortalAPI.validateTokenForInit();
      
      if (response.done) {
        return {
          isAuthenticated: true,
          user: response.body,
          token,
          tokenExpiry
        };
      } else {
        // Token is invalid, clear auth
        console.warn('Token validation failed during initialization:', response.message);
        dispatch(clearAuth());
        return { isAuthenticated: false };
      }
    } catch (error) {
      // If we get a 401 or any error, clear auth state and return unauthenticated
      console.error('Error during auth initialization:', error);
      dispatch(clearAuth());
      return { isAuthenticated: false };
    }
  }
);

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('clientToken'),
  isAuthenticated: false, // Don't assume authentication until validated
  isLoading: true, // Start with loading state during initialization
  error: null,
  inviteToken: null,
  inviteValid: false,
  inviteChecked: false,
  inviteLoading: false,
  inviteDetails: null,
  tokenExpiry: localStorage.getItem('clientTokenExpiry'),
  organizations: [],
  currentOrganizationId: null,
  switchingOrganization: false,
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
      state.isLoading = false;
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
        state.organizations = action.payload.user.organizations || [];
        state.currentOrganizationId = action.payload.user.organizationId || null;
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
        state.inviteChecked = false;
        state.error = null;
      })
      .addCase(validateInviteToken.fulfilled, (state, action) => {
        state.inviteLoading = false;
        state.inviteValid = true;
        state.inviteChecked = true;
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
        state.inviteChecked = true;
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

    // Fetch current user
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        // If fetching user fails, we might want to logout since token might be invalid
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
        state.organizations = [];
        state.currentOrganizationId = null;
        localStorage.removeItem('clientToken');
        localStorage.removeItem('clientTokenExpiry');
      });

    // Initialize Auth
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.isAuthenticated) {
          state.user = action.payload.user || null;
          state.token = action.payload.token || null;
          state.tokenExpiry = action.payload.tokenExpiry || null;
          state.isAuthenticated = true;
        } else {
          state.user = null;
          state.token = null;
          state.tokenExpiry = null;
          state.isAuthenticated = false;
        }
        state.error = null;
      });

    // Switch Organization
    builder
      .addCase(switchOrganization.pending, (state) => {
        state.switchingOrganization = true;
        state.error = null;
      })
      .addCase(switchOrganization.fulfilled, (state, action) => {
        state.switchingOrganization = false;
        state.token = action.payload.token;
        state.tokenExpiry = action.payload.expiresAt;
        state.currentOrganizationId = action.payload.organizationId;
        if (state.user) {
          state.user.organizationId = action.payload.organizationId;
        }
        localStorage.setItem('clientToken', action.payload.token);
        if (action.payload.expiresAt) {
          localStorage.setItem('clientTokenExpiry', action.payload.expiresAt);
        }
      })
      .addCase(switchOrganization.rejected, (state, action) => {
        state.switchingOrganization = false;
        state.error = action.payload as string;
      });

    // Fetch Organizations
    builder
      .addCase(fetchOrganizations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrganizations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.organizations = action.payload;
      })
      .addCase(fetchOrganizations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
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