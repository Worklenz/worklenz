import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TempClientPortalClientType } from '../../../types/client-portal/temp-client-portal.types';


// temp data for clients table
const tempClientsData: TempClientPortalClientType[] = [
  {
    id: '1',
    name: 'alexander tuner',
    assigned_projects_count: 10,
    projects: [],
    team_members: [
      {
        id: '1',
        name: 'john doe',
        email: 'johndoe@gmail.com',
      },
      {
        id: '2',
        name: 'ravisha dilanka',
        email: 'ravisha@gamail.com',
      },
      {
        id: '3',
        name: 'oliver davis',
        email: 'oliver@gamail.com',
      },
    ],
  },
  {
    id: '2',
    name: 'emily davis',
    assigned_projects_count: 20,
    projects: [],
    team_members: [],
  },
  {
    id: '3',
    name: 'emma cooper',
    assigned_projects_count: 14,
    projects: [],
    team_members: [],
  },
  {
    id: '4',
    name: 'john smith',
    assigned_projects_count: 5,
    projects: [],
    team_members: [],
  },
];

export type ClientsState = {
  clients: TempClientPortalClientType[];
  isAddClientDrawerOpen: boolean;
  isClientTeamsDrawerOpen: boolean;
  isClientSettingsDrawerOpen: boolean;
  selectedClient: string | null;
};

const initialState: ClientsState = {
  clients: tempClientsData,
  isAddClientDrawerOpen: false,
  isClientTeamsDrawerOpen: false,
  isClientSettingsDrawerOpen: false,
  selectedClient: null,
};

const clientsSlice = createSlice({
  name: 'clientsReducer',
  initialState,
  reducers: {
    toggleAddClientDrawer: (state) => {
      state.isAddClientDrawerOpen = !state.isAddClientDrawerOpen;
    },
    addClient: (state, action: PayloadAction<TempClientPortalClientType>) => {
      state.clients.push(action.payload);
    },
    updateClientName: (state, action) => {
      const { id, name } = action.payload;
      const client = state.clients.find((c) => c.id === id);
      if (client) {
        client.name = name;
      }
    },
    addProjectToClient: (
      state,
      action: PayloadAction<{ clientId: string; projectId: string }>
    ) => {
      const clientIndex = state.clients.findIndex(
        (client) => client.id === action.payload.clientId
      );
      state.clients[clientIndex].projects.push(action.payload.projectId);
    },
    deleteClient: (state, action: PayloadAction<string>) => {
      state.clients = state.clients.filter(
        (client) => client.id !== action.payload
      );
    },

    // client teams invitation drawer
    toggleClientTeamsDrawer: (state, action: PayloadAction<string | null>) => {
      state.isClientTeamsDrawerOpen = !state.isClientTeamsDrawerOpen;

      if (state.isClientTeamsDrawerOpen) {
        state.selectedClient = action.payload;
      } else {
        state.selectedClient = null;
      }
    },
    deleteClientTeamMember: (
      state,
      action: PayloadAction<{ clientId: string; clientTeamMemberId: string }>
    ) => {
      const clientIndex = state.clients.findIndex(
        (client) => client.id === action.payload.clientId
      );

      state.clients[clientIndex].team_members = state.clients[
        clientIndex
      ].team_members.filter(
        (teamMember) => teamMember.id !== action.payload.clientTeamMemberId
      );
    },

    // client settings drawer
    toggleClientSettingsDrawer: (
      state,
      action: PayloadAction<string | null>
    ) => {
      state.isClientSettingsDrawerOpen = !state.isClientSettingsDrawerOpen;
      if (state.isClientSettingsDrawerOpen) {
        state.selectedClient = action.payload;
      } else {
        state.selectedClient = null;
      }
    },
  },
});

export const {
  toggleAddClientDrawer,
  addClient,
  updateClientName,
  addProjectToClient,
  deleteClient,
  toggleClientTeamsDrawer,
  deleteClientTeamMember,
  toggleClientSettingsDrawer,
} = clientsSlice.actions;
export default clientsSlice.reducer;
