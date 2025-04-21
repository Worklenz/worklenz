import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IClient, IClientsViewModel } from '@/types/client.types';
import logger from '@/utils/errorLogger';
import { clientsApiService } from '@/api/clients/clients.api.service';

type ClientState = {
  clients: IClientsViewModel;
  loading: boolean;
  isClientDrawerOpen: boolean;
};

const initialState: ClientState = {
  clients: {
    total: 0,
    data: [],
  },
  loading: false,
  isClientDrawerOpen: false,
};

interface FetchClientsParams {
  index: number;
  size: number;
  field: string | null;
  order: string | null;
  search: string | null;
}

// Async thunks
export const fetchClients = createAsyncThunk(
  'clients/fetchAll',
  async (params: FetchClientsParams, { rejectWithValue }) => {
    try {
      const response = await clientsApiService.getClients(
        params.index,
        params.size,
        params.field,
        params.order,
        params.search
      );
      return response.body;
    } catch (error) {
      logger.error('Fetch Clients', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch clients');
    }
  }
);

export const updateClient = createAsyncThunk(
  'clients/update',
  async ({ id, body }: { id: string; body: IClient }, { rejectWithValue }) => {
    try {
      const response = await clientsApiService.updateClient(id, body);
      return response.body;
    } catch (error) {
      logger.error('Update Client', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to update client');
    }
  }
);

export const createClient = createAsyncThunk(
  'clients/create',
  async (body: IClient, { rejectWithValue }) => {
    try {
      const response = await clientsApiService.createClient(body);
      return response;
    } catch (error) {
      logger.error('Create Client', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to create client');
    }
  }
);

export const deleteClient = createAsyncThunk(
  'clients/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await clientsApiService.deleteClient(id);
    } catch (error) {
      logger.error('Delete Client', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to delete client');
    }
  }
);

const clientSlice = createSlice({
  name: 'clientReducer',
  initialState,
  reducers: {
    toggleClientDrawer: state => {
      state.isClientDrawerOpen
        ? (state.isClientDrawerOpen = false)
        : (state.isClientDrawerOpen = true);
    },
    deleteClient: (state, action: PayloadAction<string>) => {},
  },
  extraReducers: builder => {
    builder
      .addCase(fetchClients.pending, state => {
        state.loading = true;
      })
      .addCase(fetchClients.fulfilled, (state, action) => {
        state.loading = false;
        state.clients = action.payload;
      })
      .addCase(fetchClients.rejected, state => {
        state.loading = false;
      });
  },
});

export const { toggleClientDrawer } = clientSlice.actions;
export default clientSlice.reducer;
