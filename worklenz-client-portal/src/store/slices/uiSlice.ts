import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  language: string;
  notifications: {
    unreadCount: number;
    showNotificationPanel: boolean;
  };
  /** The organization's Branding — fetched via getOrganizationSettings once the client is
   * authenticated, so these start null and are filled in by ClientPortalSidebar. */
  orgPrimaryColor: string | null;
  orgPortalTitle: string | null;
}

const initialState: UIState = {
  sidebarCollapsed: false,
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  language: localStorage.getItem('language') || 'en',
  notifications: {
    unreadCount: 0,
    showNotificationPanel: false,
  },
  orgPrimaryColor: null,
  orgPortalTitle: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
    },
    setOrgBranding: (
      state,
      action: PayloadAction<{ primaryColor: string | null; portalTitle: string | null }>
    ) => {
      state.orgPrimaryColor = action.payload.primaryColor;
      state.orgPortalTitle = action.payload.portalTitle;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
      localStorage.setItem('language', action.payload);
    },
    setUnreadNotifications: (state, action: PayloadAction<number>) => {
      state.notifications.unreadCount = action.payload;
    },
    toggleNotificationPanel: (state) => {
      state.notifications.showNotificationPanel = !state.notifications.showNotificationPanel;
    },
    setNotificationPanel: (state, action: PayloadAction<boolean>) => {
      state.notifications.showNotificationPanel = action.payload;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  setTheme,
  setOrgBranding,
  setLanguage,
  setUnreadNotifications,
  toggleNotificationPanel,
  setNotificationPanel,
} = uiSlice.actions;

export default uiSlice.reducer; 