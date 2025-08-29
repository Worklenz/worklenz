import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  totalProjects: number;
  activeProjects: number;
  totalInvoices: number;
  unpaidInvoices: number;
  unreadMessages: number;
}

interface DashboardState {
  stats: DashboardStats;
  recentActivity: any[];
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  stats: {
    totalRequests: 0,
    pendingRequests: 0,
    totalProjects: 0,
    activeProjects: 0,
    totalInvoices: 0,
    unpaidInvoices: 0,
    unreadMessages: 0,
  },
  recentActivity: [],
  loading: false,
  error: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setDashboardStats: (state, action: PayloadAction<DashboardStats>) => {
      state.stats = action.payload;
    },
    setRecentActivity: (state, action: PayloadAction<any[]>) => {
      state.recentActivity = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setDashboardStats, setRecentActivity, setLoading, setError } =
  dashboardSlice.actions;
export default dashboardSlice.reducer;
