import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TempClientPortalClientType } from '../../../types/client-portal/temp-client-portal.types';
import {
  ClientPortalClient,
  ClientPortalTeamMember,
} from '../../../api/client-portal/client-portal-api';

export type ClientsState = {
  tempClients: TempClientPortalClientType[]; // Keep for backward compatibility
  selectedClient: ClientPortalClient | null;
  clientTeams: Record<string, ClientPortalTeamMember[]>;
  clientStats: Record<string, any>;
  // UI State
  isAddClientDrawerOpen: boolean;
  isEditClientDrawerOpen: boolean;
  isClientTeamsDrawerOpen: boolean;
  isClientSettingsDrawerOpen: boolean;
  isClientDetailsDrawerOpen: boolean;
  selectedClientId: string | null;
  // Filter and Pagination State (for UI controls)
  filters: {
    search: string;
    status: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  pagination: {
    page: number;
    limit: number;
  };
};

const initialState: ClientsState = {
  tempClients: [],
  selectedClient: null,
  clientTeams: {},
  clientStats: {},
  // UI State
  isAddClientDrawerOpen: false,
  isEditClientDrawerOpen: false,
  isClientTeamsDrawerOpen: false,
  isClientSettingsDrawerOpen: false,
  isClientDetailsDrawerOpen: false,
  selectedClientId: null,
  // Filter and Pagination State
  filters: {
    search: '',
    status: 'active', // Default to active clients
    sortBy: 'name',
    sortOrder: 'asc',
  },
  pagination: {
    page: 1,
    limit: 10,
  },
};

const clientsSlice = createSlice({
  name: 'clientsReducer',
  initialState,
  reducers: {
    // UI Actions
    toggleAddClientDrawer: state => {
      state.isAddClientDrawerOpen = !state.isAddClientDrawerOpen;
    },
    toggleEditClientDrawer: (state, action: PayloadAction<string | null>) => {
      if (action.payload === null) {
        // Close the drawer
        state.isEditClientDrawerOpen = false;
        state.selectedClientId = null;
      } else {
        // Open the drawer with the selected client
        state.isEditClientDrawerOpen = true;
        state.selectedClientId = action.payload;
      }
    },
    toggleClientTeamsDrawer: (state, action: PayloadAction<string | null>) => {
      if (action.payload === null) {
        // Close the drawer
        state.isClientTeamsDrawerOpen = false;
        state.selectedClientId = null;
      } else {
        // Open the drawer with the selected client
        state.isClientTeamsDrawerOpen = true;
        state.selectedClientId = action.payload;
      }
    },
    toggleClientSettingsDrawer: (state, action: PayloadAction<string | null>) => {
      if (action.payload === null) {
        // Close the drawer
        state.isClientSettingsDrawerOpen = false;
        state.selectedClientId = null;
      } else {
        // Open the drawer with the selected client
        state.isClientSettingsDrawerOpen = true;
        state.selectedClientId = action.payload;
      }
    },
    toggleClientDetailsDrawer: (state, action: PayloadAction<string | null>) => {
      if (action.payload === null) {
        // Close the drawer
        state.isClientDetailsDrawerOpen = false;
        state.selectedClientId = null;
      } else {
        // Open the drawer with the selected client
        state.isClientDetailsDrawerOpen = true;
        state.selectedClientId = action.payload;
      }
    },

    // Filter and Pagination Actions
    setSearchFilter: (state, action: PayloadAction<string>) => {
      state.filters.search = action.payload;
      state.pagination.page = 1; // Reset to first page when searching
    },
    setStatusFilter: (state, action: PayloadAction<string>) => {
      state.filters.status = action.payload;
      state.pagination.page = 1;
    },
    setSortBy: (state, action: PayloadAction<string>) => {
      state.filters.sortBy = action.payload;
    },
    setSortOrder: (state, action: PayloadAction<'asc' | 'desc'>) => {
      state.filters.sortOrder = action.payload;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = action.payload;
    },
    setLimit: (state, action: PayloadAction<number>) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1; // Reset to first page when changing limit
    },

    // Clear filters
    clearFilters: state => {
      state.filters = {
        search: '',
        status: 'active', // Keep active as default when clearing filters
        sortBy: 'name',
        sortOrder: 'asc',
      };
      state.pagination.page = 1;
    },

    // Set selected client
    setSelectedClient: (state, action: PayloadAction<ClientPortalClient | null>) => {
      state.selectedClient = action.payload;
    },

    // Set client teams
    setClientTeams: (
      state,
      action: PayloadAction<{ clientId: string; teams: ClientPortalTeamMember[] }>
    ) => {
      const { clientId, teams } = action.payload;
      state.clientTeams[clientId] = teams;
    },

    // Set client stats
    setClientStats: (state, action: PayloadAction<{ clientId: string; stats: any }>) => {
      const { clientId, stats } = action.payload;
      state.clientStats[clientId] = stats;
    },

    // Legacy actions for backward compatibility
    addClient: (state, action: PayloadAction<TempClientPortalClientType>) => {
      state.tempClients.push(action.payload);
    },
    updateClientName: (state, action) => {
      const { id, name } = action.payload;
      const client = state.tempClients.find(c => c.id === id);
      if (client) {
        client.name = name;
      }
    },
    addProjectToClient: (state, action: PayloadAction<{ clientId: string; projectId: string }>) => {
      const clientIndex = state.tempClients.findIndex(
        client => client.id === action.payload.clientId
      );
      state.tempClients[clientIndex].projects.push(action.payload.projectId);
    },
    deleteClientTeamMember: (
      state,
      action: PayloadAction<{ clientId: string; clientTeamMemberId: string }>
    ) => {
      const clientIndex = state.tempClients.findIndex(
        client => client.id === action.payload.clientId
      );
      state.tempClients[clientIndex].team_members = state.tempClients[
        clientIndex
      ].team_members.filter(teamMember => teamMember.id !== action.payload.clientTeamMemberId);
    },
  },
});

export const {
  toggleAddClientDrawer,
  toggleEditClientDrawer,
  toggleClientTeamsDrawer,
  toggleClientSettingsDrawer,
  toggleClientDetailsDrawer,
  setSearchFilter,
  setStatusFilter,
  setSortBy,
  setSortOrder,
  setPage,
  setLimit,
  clearFilters,
  setSelectedClient,
  setClientTeams,
  setClientStats,
  // Legacy actions
  addClient,
  updateClientName,
  addProjectToClient,
  deleteClientTeamMember,
} = clientsSlice.actions;

export default clientsSlice.reducer;
