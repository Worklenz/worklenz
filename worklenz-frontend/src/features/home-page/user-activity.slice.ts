import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ActivityFeedType } from '@/types/home/user-activity.types';

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

interface UserActivityState {
  activeTab: ActivityFeedType;
  activities: ActivityItem[];
  loading: boolean;
  error: string | null;
}

const initialState: UserActivityState = {
  activeTab: ActivityFeedType.TIME_LOGGED_TASKS,
  activities: [],
  loading: false,
  error: null,
};

const userActivitySlice = createSlice({
  name: 'userActivity',
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<ActivityFeedType>) {
      state.activeTab = action.payload;
    },
    fetchActivitiesStart(state) {
      state.loading = true;
      state.error = null;
    },
    fetchActivitiesSuccess(state, action: PayloadAction<ActivityItem[]>) {
      state.activities = action.payload;
      state.loading = false;
      state.error = null;
    },
    fetchActivitiesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    clearActivities(state) {
      state.activities = [];
    },
  },
});

export const {
  setActiveTab,
  fetchActivitiesStart,
  fetchActivitiesSuccess,
  fetchActivitiesFailure,
  clearActivities,
} = userActivitySlice.actions;

export default userActivitySlice.reducer;
