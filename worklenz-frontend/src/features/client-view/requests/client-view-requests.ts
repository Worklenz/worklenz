import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ClientRequest {
  id: string;
  req_no: string;
  service: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  time: string;
  attachments: any[];
}

interface RequestsState {
  requests: ClientRequest[];
  loading: boolean;
  error: string | null;
}

const initialState: RequestsState = {
  requests: [],
  loading: false,
  error: null
};

const requestsSlice = createSlice({
  name: 'requests',
  initialState,
  reducers: {
    setRequests: (state, action: PayloadAction<ClientRequest[]>) => {
      state.requests = action.payload;
    },
    addRequest: (state, action: PayloadAction<ClientRequest>) => {
      state.requests.push(action.payload);
    },
    updateRequest: (state, action: PayloadAction<ClientRequest>) => {
      const index = state.requests.findIndex(req => req.id === action.payload.id);
      if (index !== -1) {
        state.requests[index] = action.payload;
      }
    },
    removeRequest: (state, action: PayloadAction<string>) => {
      state.requests = state.requests.filter(req => req.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    }
  }
});

export const { setRequests, addRequest, updateRequest, removeRequest, setLoading, setError } = requestsSlice.actions;
export default requestsSlice.reducer; 