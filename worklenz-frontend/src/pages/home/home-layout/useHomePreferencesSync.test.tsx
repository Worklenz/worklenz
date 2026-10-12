import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import React, { type ReactNode } from 'react';
import homePreferencesReducer, {
  DEFAULT_HOME_PREFERENCES,
  type HomePreferences,
} from '@/features/home-page/homePreferences.slice';
import homePageReducer from '@/features/home-page/home-page.slice';
import { useHomePreferencesSync } from './useHomePreferencesSync';

const { mockPinTaskInitiate, mockClearLegacyHomePins } = vi.hoisted(() => ({
  mockPinTaskInitiate: vi.fn(() => () => Promise.resolve({ data: {} })),
  mockClearLegacyHomePins: vi.fn(),
}));

let mockCurrentSession: { id: string } | null = { id: 'user-1' };
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    getCurrentSession: () => mockCurrentSession,
  }),
}));

const mockQueryArgs: (string | void)[] = [];
let mockServerResponse: { body?: { preferences: HomePreferences; updated_at: string | null } } = {};
let mockIsFetching = false;
let mockIsSuccess = true;

vi.mock('@/api/home-page/home-page.api.service', () => ({
  default: {
    endpoints: {
      updateHomePreferences: {
        initiate: vi.fn(() => ({
          unwrap: () => Promise.resolve(),
        })),
      },
      pinHomeTask: {
        initiate: mockPinTaskInitiate,
      },
    },
  },
  useGetHomePreferencesQuery: (arg: string | void) => {
    mockQueryArgs.push(arg);
    return {
      data: mockServerResponse,
      isFetching: mockIsFetching,
      isSuccess: mockIsSuccess,
    };
  },
}));

const savedLocalStorage: Record<string, HomePreferences> = {};
vi.mock('@/features/home-page/homePreferencesStorage', () => ({
  loadHomePreferences: vi.fn((key: string) => {
    return (
      savedLocalStorage[key] ?? {
        ...DEFAULT_HOME_PREFERENCES,
        selections: {
          ...DEFAULT_HOME_PREFERENCES.selections,
          period: key === 'user-1' ? 'today' : 'week',
        },
      }
    );
  }),
  saveHomePreferences: vi.fn((key: string, prefs: HomePreferences) => {
    savedLocalStorage[key] = prefs;
  }),
}));

let mockLegacyPinIds: Record<string, string[]> = {};
vi.mock('@/features/home-page/legacyHomePins', () => ({
  readLegacyHomePinIds: (userKey: string) => mockLegacyPinIds[userKey] ?? [],
  clearLegacyHomePins: mockClearLegacyHomePins,
}));

const createStore = () =>
  configureStore({
    reducer: {
      homePreferencesReducer,
      homePageReducer,
    },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({ serializableCheck: false }),
  });

describe('useHomePreferencesSync - account switching', () => {
  beforeEach(() => {
    mockCurrentSession = { id: 'user-1' };
    mockQueryArgs.length = 0;
    mockServerResponse = {
      body: {
        preferences: DEFAULT_HOME_PREFERENCES,
        updated_at: '2026-10-12T00:00:00Z',
      },
    };
    mockIsFetching = false;
    mockIsSuccess = true;
    mockPinTaskInitiate.mockReset();
    mockPinTaskInitiate.mockImplementation(() => () => Promise.resolve({ data: {} }));
    mockLegacyPinIds = {};
    mockClearLegacyHomePins.mockReset();
    for (const key of Object.keys(savedLocalStorage)) {
      delete savedLocalStorage[key];
    }
  });

  it('keys RTK Query by the active user ID and updates cache key when account changes', () => {
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { rerender } = renderHook(() => useHomePreferencesSync(), { wrapper });

    expect(mockQueryArgs).toContain('user-1');

    act(() => {
      mockCurrentSession = { id: 'user-2' };
    });
    rerender();

    expect(mockQueryArgs).toContain('user-2');
  });

  it('does not bleed user-1 preferences into user-2 local storage key on switch', () => {
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { rerender } = renderHook(() => useHomePreferencesSync(), { wrapper });

    expect(savedLocalStorage['user-2']).toBeUndefined();

    act(() => {
      mockCurrentSession = { id: 'user-2' };
    });
    rerender();

    // After switching and hydration, user-2 should have user-2 preferences ('week'), not user-1 ('today')
    if (savedLocalStorage['user-2']) {
      expect(savedLocalStorage['user-2'].selections.period).toBe('week');
    }
  });

  it('stops a legacy pin import when the active account changes mid-request', async () => {
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    mockLegacyPinIds = { 'user-1': ['legacy-task-1', 'legacy-task-2'] };
    let resolveFirstPin: ((value: { data: Record<string, never> }) => void) | undefined;
    mockPinTaskInitiate.mockImplementationOnce(
      () => () => new Promise(resolve => {
        resolveFirstPin = resolve;
      })
    );

    const { rerender } = renderHook(() => useHomePreferencesSync(), { wrapper });
    expect(mockPinTaskInitiate).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockCurrentSession = { id: 'user-2' };
      rerender();
      resolveFirstPin?.({ data: {} });
      await Promise.resolve();
    });

    expect(mockPinTaskInitiate).toHaveBeenCalledTimes(1);
    expect(mockClearLegacyHomePins).not.toHaveBeenCalledWith('user-1');
  });
});
