import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useFilterPersistence } from './useFilterPersistence';
import taskReducer, { ITaskState, persistFilters, startFilterRestoration, endFilterRestoration, restoreFilters } from '@/features/tasks/tasks.slice';
import { ReactNode } from 'react';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

interface TestState {
  taskReducer: ITaskState;
  projectReducer: {
    projectId: string | null;
    project: any;
    projectLoading: boolean;
  };
}

const createTestStore = (preloadedState?: TestState) => {
  return configureStore({
    reducer: {
      taskReducer,
      projectReducer: (state: TestState['projectReducer'] = { projectId: null, project: null, projectLoading: false }, action: any) => {
        if (action.type === 'project/setProjectId') {
          return { ...state, projectId: action.payload };
        }
        return state;
      },
    },
    preloadedState,
  });
};

const renderHookWithStore = (hook: any, preloadedState?: TestState) => {
  const store = createTestStore(preloadedState);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return { hook: renderHook(hook, { wrapper }), store };
};

describe('useFilterPersistence - Filter Overwrite Bug Regression Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('Bug: Filter persistence race condition when switching projects', () => {
    test('should not overwrite Project B filters with Project A filters when quickly switching projects', () => {
      const projectAFilters = {
        priorities: ['priority-1'],
        phases: ['phase-1'],
        members: ['member-1'],
        statuses: ['status-1'],
        labels: ['label-1'],
        search: 'search-a',
        archived: false,
      };

      const projectBFilters = {
        priorities: ['priority-2', 'priority-3'],
        phases: ['phase-2'],
        members: ['member-2', 'member-3'],
        statuses: ['status-2', 'status-3'],
        labels: ['label-2'],
        search: 'search-b',
        archived: true,
      };

      localStorage.setItem('worklenz.tasklist.filters.project-a', JSON.stringify(projectAFilters));
      localStorage.setItem('worklenz.tasklist.filters.project-b', JSON.stringify(projectBFilters));

      const { store } = renderHookWithStore(useFilterPersistence, {
        taskReducer: {
          ...taskReducer(undefined, { type: '@@INIT' }),
          projectId: 'project-b',
          isRestoringFilters: true,
          priorities: ['priority-2', 'priority-3'],
        },
        projectReducer: { projectId: 'project-b', project: null, projectLoading: false },
      });

      const savedProjectBFilters = localStorage.getItem('worklenz.tasklist.filters.project-b');
      expect(savedProjectBFilters).toBeTruthy();
      const parsedB = JSON.parse(savedProjectBFilters!);
      expect(parsedB.search).toBe('search-b');
      expect(parsedB.archived).toBe(true);
    });

    test('should gate persistence until filter restoration completes for new project', () => {
      const { store } = renderHookWithStore(useFilterPersistence, {
        taskReducer: {
          ...taskReducer(undefined, { type: '@@INIT' }),
          projectId: 'project-a',
          isRestoringFilters: false,
          priorities: [],
        },
        projectReducer: { projectId: 'project-a', project: null, projectLoading: false },
      });

      const dispatchSpy = vi.spyOn(store, 'dispatch');

      act(() => {
        store.dispatch(startFilterRestoration());
        store.dispatch({ type: 'taskReducer/setPriorities', payload: ['p2'] });
      });

      expect(dispatchSpy.mock.calls.some(call => call[0]?.type === 'taskReducer/persistFilters')).toBe(false);

      act(() => {
        store.dispatch(endFilterRestoration());
        store.dispatch({ type: 'taskReducer/setPriorities', payload: ['p3'] });
      });

      expect(dispatchSpy.mock.calls.some(call => call[0]?.type === 'taskReducer/persistFilters')).toBe(true);
    });

    test('should handle rapid project switches without filter corruption', () => {
      const store = createTestStore({
        taskReducer: {
          ...taskReducer(undefined, { type: '@@INIT' }),
          projectId: 'project-a',
          isRestoringFilters: false,
          priorities: ['p1'],
        },
        projectReducer: { projectId: 'project-a', project: null, projectLoading: false },
      });

      act(() => {
        store.dispatch({ type: 'project/setProjectId', payload: 'project-b' });
        store.dispatch(startFilterRestoration());
        store.dispatch({ type: 'taskReducer/setPriorities', payload: ['p2'] });

        store.dispatch({ type: 'project/setProjectId', payload: 'project-c' });
        store.dispatch({ type: 'taskReducer/setPriorities', payload: ['p3'] });
        store.dispatch({ type: 'taskReducer/setTaskListProjectId', payload: 'project-c' });

        store.dispatch(endFilterRestoration());
      });

      const state = store.getState();
      expect(state.projectReducer.projectId).toBe('project-c');
      expect(state.taskReducer.projectId).toBe('project-c');
    });

    test('should persist filters after project is fully loaded and restored', () => {
      const { store } = renderHookWithStore(useFilterPersistence, {
        taskReducer: {
          ...taskReducer(undefined, { type: '@@INIT' }),
          projectId: 'project-a',
          isRestoringFilters: true,
          priorities: ['p1'],
        },
        projectReducer: { projectId: 'project-a', project: null, projectLoading: false },
      });

      localStorageMock.clear();
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      act(() => {
        store.dispatch(endFilterRestoration());
        store.dispatch({ type: 'taskReducer/setPriorities', payload: ['p2'] });
      });

      expect(dispatchSpy.mock.calls.some(call => call[0]?.type === 'taskReducer/persistFilters')).toBe(true);
    });

    test('should not persist if project has never completed restoration cycle', () => {
      const store = createTestStore({
        taskReducer: {
          ...taskReducer(undefined, { type: '@@INIT' }),
          projectId: 'project-b',
          isRestoringFilters: false,
          priorities: ['old-p1'],
        },
        projectReducer: { projectId: 'project-b', project: null, projectLoading: false },
      });

      const persistFiltersSpy = vi.spyOn(store, 'dispatch');

      act(() => {
        store.dispatch({ type: 'taskReducer/setPriorities', payload: ['new-p1'] });
      });

      const persistCalls = persistFiltersSpy.mock.calls.filter(
        call => call[0]?.type === 'taskReducer/persistFilters'
      );
      expect(persistCalls.length).toBe(0);
    });
  });

  describe('Filter persistence with normal workflows', () => {
    test('should persist filters after initial project load and restoration', () => {
      localStorageMock.clear();

      const { store } = renderHookWithStore(useFilterPersistence, {
        taskReducer: {
          ...taskReducer(undefined, { type: '@@INIT' }),
          projectId: 'project-a',
          isRestoringFilters: true,
        },
        projectReducer: { projectId: 'project-a', project: null, projectLoading: false },
      });

      const dispatchSpy = vi.spyOn(store, 'dispatch');

      act(() => {
        store.dispatch(endFilterRestoration());
      });

      act(() => {
        store.dispatch({ type: 'taskReducer/setPriorities', payload: ['p1', 'p2'] });
      });

      const persistCalls = dispatchSpy.mock.calls.filter(
        call => call[0]?.type === 'taskReducer/persistFilters'
      );
      expect(persistCalls.length).toBeGreaterThan(0);
    });

    test('should handle multiple filter changes within same project', () => {
      localStorageMock.clear();

      const { store } = renderHookWithStore(useFilterPersistence, {
        taskReducer: {
          ...taskReducer(undefined, { type: '@@INIT' }),
          projectId: 'project-a',
          isRestoringFilters: false,
          priorities: [],
        },
        projectReducer: { projectId: 'project-a', project: null, projectLoading: false },
      });

      const dispatchSpy = vi.spyOn(store, 'dispatch');

      act(() => {
        store.dispatch({ type: 'taskReducer/setPriorities', payload: ['p1'] });
        store.dispatch({ type: 'taskReducer/setPhases', payload: ['phase1'] });
        store.dispatch({ type: 'taskReducer/setSearch', payload: 'search term' });
      });

      const persistCalls = dispatchSpy.mock.calls.filter(
        call => call[0]?.type === 'taskReducer/persistFilters'
      );
      expect(persistCalls.length).toBeGreaterThan(0);
    });
  });
});
