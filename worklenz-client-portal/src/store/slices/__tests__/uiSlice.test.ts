import { describe, it, expect, beforeEach } from 'vitest';
import uiReducer, {
  toggleSidebar,
  setSidebarCollapsed,
  setTheme,
  setLanguage,
  setUnreadNotifications,
  toggleNotificationPanel,
  setNotificationPanel,
} from '../uiSlice';

describe('uiSlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const baseUIState = {
    sidebarCollapsed: false,
    theme: 'light' as const,
    language: 'en',
    notifications: {
      unreadCount: 0,
      showNotificationPanel: false,
    },
  };

  it('should return initial state by default', () => {
    const state = uiReducer(undefined, { type: 'unknown' });
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.theme).toBe('light');
    expect(state.language).toBe('en');
    expect(state.notifications.unreadCount).toBe(0);
  });

  it('should toggle sidebar state', () => {
    const collapsed = uiReducer(baseUIState, toggleSidebar());
    expect(collapsed.sidebarCollapsed).toBe(true);

    const expanded = uiReducer(collapsed, toggleSidebar());
    expect(expanded.sidebarCollapsed).toBe(false);
  });

  it('should set sidebarCollapsed explicitly', () => {
    const state = uiReducer(baseUIState, setSidebarCollapsed(true));
    expect(state.sidebarCollapsed).toBe(true);
  });

  it('should set theme and persist to localStorage', () => {
    const state = uiReducer(baseUIState, setTheme('dark'));
    expect(state.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('should set language and persist to localStorage', () => {
    const state = uiReducer(baseUIState, setLanguage('fr'));
    expect(state.language).toBe('fr');
    expect(localStorage.getItem('language')).toBe('fr');
  });

  it('should set unread notifications count', () => {
    const state = uiReducer(baseUIState, setUnreadNotifications(5));
    expect(state.notifications.unreadCount).toBe(5);
  });

  it('should toggle and set notification panel visibility', () => {
    const panelOpen = uiReducer(baseUIState, toggleNotificationPanel());
    expect(panelOpen.notifications.showNotificationPanel).toBe(true);

    const panelExplicitClosed = uiReducer(panelOpen, setNotificationPanel(false));
    expect(panelExplicitClosed.notifications.showNotificationPanel).toBe(false);
  });
});
