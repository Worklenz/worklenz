import { ITeamInvitationViewModel } from '@/types/notifications/notifications.types';
import { IWorklenzNotification } from '@/types/notifications/notifications.types';
import { NotificationsDataModel } from '@/types/notifications/notifications.types';
import { NotificationType } from '../../types/notification.types';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { teamsApiService } from '@/api/teams/teams.api.service';
import { notificationsApiService } from '@/api/notifications/notifications.api.service';

type NotificationState = {
  notificationType: 'Read' | 'Unread';
  loading: boolean;
  loadingInvitations: boolean;
  notifications: IWorklenzNotification[];
  notificationsCount: number;
  isDrawerOpen: boolean;
  invitations: ITeamInvitationViewModel[];
  invitationsCount: number;
  showBrowserPush: boolean;
  _dataset: NotificationsDataModel;
  dataset: NotificationsDataModel;
  loadersMap: { [x: string]: boolean };
  unreadNotificationsCount: number;
};

const initialState: NotificationState = {
  notificationType: 'Unread',
  loading: false,
  loadingInvitations: false,
  notifications: [],
  notificationsCount: 0,
  isDrawerOpen: false,
  invitations: [],
  invitationsCount: 0,
  showBrowserPush: false,
  _dataset: [],
  dataset: [],
  loadersMap: {},
  unreadNotificationsCount: 0,
};

export const fetchInvitations = createAsyncThunk('notification/fetchInvitations', async () => {
  const res = await teamsApiService.getInvitations();
  return res.body;
});

export const fetchNotifications = createAsyncThunk(
  'notification/fetchNotifications',
  async (filter: string) => {
    const res = await notificationsApiService.getNotifications(filter);
    return res.body;
  }
);

export const fetchUnreadCount = createAsyncThunk('notification/fetchUnreadCount', async () => {
  const res = await notificationsApiService.getUnreadCount();
  return res.body;
});

const notificationSlice = createSlice({
  name: 'notificationReducer',
  initialState,
  reducers: {
    toggleDrawer: state => {
      state.isDrawerOpen ? (state.isDrawerOpen = false) : (state.isDrawerOpen = true);
    },
    setNotificationType: (state, action) => {
      state.notificationType = action.payload;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchInvitations.pending, state => {
      state.loading = true;
    });
    builder.addCase(fetchInvitations.fulfilled, (state, action) => {
      state.loading = false;
      state.invitations = action.payload;
      state.invitationsCount = action.payload.length;

      state.invitations.map(invitation => {
        state._dataset.push({
          type: 'invitation',
          data: invitation,
        });
      });
    });
    builder.addCase(fetchInvitations.rejected, state => {
      state.loading = false;
    });
    builder.addCase(fetchNotifications.pending, state => {
      state.loading = true;
    });
    builder.addCase(fetchNotifications.fulfilled, (state, action) => {
      state.loading = false;
      state.notifications = action.payload;
      state.notificationsCount = action.payload.length;

      state.notifications.map(notification => {
        state._dataset.push({
          type: 'notification',
          data: notification,
        });
      });
    });
    builder.addCase(fetchUnreadCount.pending, state => {
      state.unreadNotificationsCount = 0;
    });
    builder.addCase(fetchUnreadCount.fulfilled, (state, action) => {
      state.unreadNotificationsCount = action.payload;
    });
    builder.addCase(fetchUnreadCount.rejected, state => {
      state.unreadNotificationsCount = 0;
    });
  },
});

export const { toggleDrawer, setNotificationType } = notificationSlice.actions;
export default notificationSlice.reducer;
