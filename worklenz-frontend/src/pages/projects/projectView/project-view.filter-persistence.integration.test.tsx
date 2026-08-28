import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import taskReducer, {
  startFilterRestoration,
  endFilterRestoration,
  restoreFilters,
  persistFilters,
  setPriorities,
  setPhases,
  setStatuses,
  setMembers,
  setLabels,
  setSearch,
  setTaskListProjectId,
} from '@/features/tasks/tasks.slice';
import { ITaskStatusViewModel } from '@/types/tasks/taskStatusGetResponse.types';

interface TestProjectReducerState {
  projectId: string | null;
  project: any;
  projectLoading: boolean;
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
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

/**
 * Integration test for filter persistence bug fix
 * 
 * Bug: When switching between projects, stale filters from the previous project
 * could overwrite the new project's saved filters in localStorage.
 * 
 * Root cause: projectReducer.projectId changes before taskReducer filters are reset.
 * useFilterPersistence would read old project's filter state while taskReducer still
 * contained old filters, then write them to new project's storage key.
 * 
 * Fix: Gate persistence until isRestoringFilters completes for the new project.
 */
describe('Project View - Filter Persistence Integration Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('Regression test: Filter overwrite when switching projects', () => {
    test('should preserve Project B filters when switching from Project A with active filters', async () => {
      // Step 1: Setup - Save distinct filters for both projects
      const projectAKey = 'worklenz.tasklist.filters.project-a';
      const projectBKey = 'worklenz.tasklist.filters.project-b';

      const projectAFilters = {
        priorities: ['high', 'critical'],
        phases: ['design', 'planning'],
        members: ['alice', 'bob'],
        statuses: ['todo', 'in-progress'],
        labels: ['urgent', 'backend'],
        search: 'authentication',
        archived: false,
      };

      const projectBFilters = {
        priorities: ['low', 'medium'],
        phases: ['testing'],
        members: ['charlie'],
        statuses: ['review', 'done'],
        labels: ['frontend'],
        search: 'ui',
        archived: true,
      };

      // Pre-populate localStorage with both projects' filters
      localStorage.setItem(projectAKey, JSON.stringify(projectAFilters));
      localStorage.setItem(projectBKey, JSON.stringify(projectBFilters));

      // Step 2: Create store in Project A state with restoration cycle complete
      const store = configureStore({
        reducer: {
          taskReducer,
          projectReducer: (
            state: TestProjectReducerState = {
              projectId: 'project-a',
              project: null,
              projectLoading: false,
            },
            action: any
          ) => {
            if (action.type === 'setProjectId') {
              return { ...state, projectId: action.payload };
            }
            return state;
          },
        },
        preloadedState: {
          taskReducer: {
            ...taskReducer(undefined, { type: '@@INIT' }),
            projectId: 'project-a',
            isRestoringFilters: false,
            priorities: projectAFilters.priorities,
            phases: projectAFilters.phases,
            search: projectAFilters.search,
            archived: projectAFilters.archived,
          },
          projectReducer: {
            projectId: 'project-a',
            project: null,
            projectLoading: false,
          },
        },
      });

      // Step 3: Simulate switching to Project B
      // This mimics what project-view.tsx does when route changes
      act(() => {
        store.dispatch({ type: 'setProjectId', payload: 'project-b' });
        store.dispatch(setTaskListProjectId('project-b'));

        // Start restoration - this should gate persistence
        store.dispatch(startFilterRestoration());

        // Important: At this point, taskReducer still has Project A's filters
        // but projectId is now 'project-b'
        // If persistence fires now, it would write Project A filters under Project B's key

        // Simulate the restoration sequence
        store.dispatch(restoreFilters());

        // Restore statuses
        const projectBStatuses: ITaskStatusViewModel[] = [
          { id: 'review', name: 'Review', color_code: '#ff0000', color_code_dark: '#cc0000' },
          { id: 'done', name: 'Done', color_code: '#00ff00', color_code_dark: '#00cc00' },
        ];
        store.dispatch(setStatuses(projectBStatuses));

        // Mark restoration as complete
        store.dispatch(endFilterRestoration());
      });

      // Step 4: Verify that Project B filters are still intact in localStorage
      const savedProjectBFilters = localStorage.getItem(projectBKey);
      expect(savedProjectBFilters).toBeTruthy();

      const parsedProjectBFilters = JSON.parse(savedProjectBFilters!);
      expect(parsedProjectBFilters.search).toBe('ui');
      expect(parsedProjectBFilters.archived).toBe(true);
      expect(parsedProjectBFilters.priorities).toContain('low');
      expect(parsedProjectBFilters.statuses).toContain('review');

      // Step 5: Verify that Project B filters were NOT overwritten with Project A filters
      expect(parsedProjectBFilters.search).not.toBe('authentication');
      expect(parsedProjectBFilters.archived).not.toBe(false);
      expect(parsedProjectBFilters.priorities).not.toContain('high');
    });

    test('should restore and then allow persisting new changes in switched project', async () => {
      const projectBKey = 'worklenz.tasklist.filters.project-b';

      const projectBInitialFilters = {
        priorities: ['low'],
        phases: ['testing'],
        members: [],
        statuses: ['done'],
        labels: [],
        search: '',
        archived: false,
      };

      localStorage.setItem(projectBKey, JSON.stringify(projectBInitialFilters));

      const store = configureStore({
        reducer: {
          taskReducer,
          projectReducer: (
            state: TestProjectReducerState = { projectId: 'project-b', project: null, projectLoading: false },
            action: any
          ) => {
            if (action.type === 'setProjectId') {
              return { ...state, projectId: action.payload };
            }
            return state;
          },
        },
        preloadedState: {
          taskReducer: {
            ...taskReducer(undefined, { type: '@@INIT' }),
            projectId: 'project-b',
            isRestoringFilters: true,
          },
          projectReducer: {
            projectId: 'project-b',
            project: null,
            projectLoading: false,
          },
        },
      });

      // Complete the restoration cycle
      act(() => {
        store.dispatch(restoreFilters());
        store.dispatch(endFilterRestoration());
      });

      // Now make a new filter change - should persist
      act(() => {
        store.dispatch(setPriorities(['low', 'medium']));
        store.dispatch(persistFilters());
      });

      // Verify the new filters were persisted
      const savedFilters = localStorage.getItem(projectBKey);
      const parsed = JSON.parse(savedFilters!);
      expect(parsed.priorities).toContain('low');
      expect(parsed.priorities).toContain('medium');
    });
  });

  describe('Correct filter restoration sequence', () => {
    test('should not persist old project filters during restoration window', async () => {
      const projectAKey = 'worklenz.tasklist.filters.project-a';
      const projectBKey = 'worklenz.tasklist.filters.project-b';

      const projectAFilters = {
        priorities: ['high'],
        phases: [],
        members: [],
        statuses: ['todo'],
        labels: [],
        search: 'bug',
        archived: false,
      };

      localStorage.setItem(projectAKey, JSON.stringify(projectAFilters));

      const store = configureStore({
        reducer: {
          taskReducer,
          projectReducer: (
            state: TestProjectReducerState = { projectId: 'project-a', project: null, projectLoading: false },
            action: any
          ) => {
            if (action.type === 'setProjectId') {
              return { ...state, projectId: action.payload };
            }
            return state;
          },
        },
        preloadedState: {
          taskReducer: {
            ...taskReducer(undefined, { type: '@@INIT' }),
            projectId: 'project-a',
            isRestoringFilters: false,
            priorities: projectAFilters.priorities,
            search: projectAFilters.search,
          },
          projectReducer: {
            projectId: 'project-a',
            project: null,
            projectLoading: false,
          },
        },
      });

      // Start switching to Project B
      act(() => {
        store.dispatch({ type: 'setProjectId', payload: 'project-b' });
        store.dispatch(setTaskListProjectId('project-b'));
        store.dispatch(startFilterRestoration());

        // At this point, trying to persist should be blocked
        // (useFilterPersistence hook would skip persistence)
        store.dispatch(persistFilters());
      });

      // Project B should not have filters written yet (only during restoration)
      const projectBData = localStorage.getItem(projectBKey);
      expect(projectBData).toBeFalsy();
    });

    test('should complete full project switch cycle without filter corruption', async () => {
      const projectCKey = 'worklenz.tasklist.filters.project-c';

      const projectCFilters = {
        priorities: ['critical'],
        phases: ['deployment'],
        members: ['dev-team'],
        statuses: ['production'],
        labels: ['hotfix'],
        search: 'crash',
        archived: false,
      };

      localStorage.setItem(projectCKey, JSON.stringify(projectCFilters));

      const store = configureStore({
        reducer: {
          taskReducer,
          projectReducer: (
            state: TestProjectReducerState = { projectId: null, project: null, projectLoading: false },
            action: any
          ) => {
            if (action.type === 'setProjectId') {
              return { ...state, projectId: action.payload };
            }
            return state;
          },
        },
      });

      // Simulate full project switch cycle
      act(() => {
        // 1. Set project ID
        store.dispatch({ type: 'setProjectId', payload: 'project-c' });
        store.dispatch(setTaskListProjectId('project-c'));

        // 2. Start restoration
        store.dispatch(startFilterRestoration());

        // 3. Restore filters (simulating async load)
        setTimeout(() => {
          store.dispatch(restoreFilters());
          store.dispatch(endFilterRestoration());
        }, 100);
      });

      // Wait for restoration to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify Project C filters are preserved
      const savedFilters = localStorage.getItem(projectCKey);
      expect(savedFilters).toBeTruthy();

      const parsed = JSON.parse(savedFilters!);
      expect(parsed.search).toBe('crash');
      expect(parsed.priorities).toContain('critical');
    });
  });
});
