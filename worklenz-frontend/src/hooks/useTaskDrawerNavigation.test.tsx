import { act, renderHook } from '@testing-library/react';
import { configureStore, type UnknownAction } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/task-drawer/task-drawer.slice', () => ({
  setNavigationContext: (payload: unknown) => ({ type: 'navigation', payload }),
}));
import useTaskDrawerNavigation from './useTaskDrawerNavigation';

interface NavigationContext {
  taskIds: string[];
  currentIndex: number;
  sourceView: string;
  projectId: string | null;
}
const makeStore = () => {
  const initial = {
    taskDrawerReducer: {
      showTaskDrawer: false,
      selectedTaskId: 'b',
      navigationContext: null as NavigationContext | null,
    },
    projectReducer: { projectId: 'project' },
    taskManagement: { groups: [] as { id: string; taskIds: string[] }[] },
    taskReducer: { taskGroups: [] },
    boardReducer: { taskGroups: [] },
    enhancedKanbanReducer: { taskGroups: [] },
    homePageReducer: { model: { tasks: [] } },
  };
  return configureStore({
    reducer: (state = initial, action: UnknownAction) => {
      if (action.type === 'groups')
        return { ...state, taskManagement: { groups: [{ id: 'group', taskIds: ['a', 'b'] }] } };
      if (action.type === 'open')
        return {
          ...state,
          taskDrawerReducer: { ...state.taskDrawerReducer, showTaskDrawer: true },
        };
      if (action.type === 'navigation')
        return {
          ...state,
          taskDrawerReducer: {
            ...state.taskDrawerReducer,
            navigationContext: action.payload as NavigationContext,
          },
        };
      return state;
    },
  });
};

describe('task drawer navigation subscriptions', () => {
  it('ignores closed list updates and builds navigation from V3 task ids on opening', () => {
    const store = makeStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    let renders = 0;
    renderHook(
      () => {
        renders++;
        useTaskDrawerNavigation();
      },
      { wrapper }
    );
    const initial = renders;
    act(() => store.dispatch({ type: 'groups' }));
    expect(renders).toBe(initial);
    act(() => store.dispatch({ type: 'open' }));
    expect(store.getState().taskDrawerReducer.navigationContext).toEqual({
      taskIds: ['a', 'b'],
      currentIndex: 1,
      sourceView: 'task-list',
      projectId: 'project',
    });
    const opened = renders;
    act(() => store.dispatch({ type: 'groups' }));
    expect(renders).toBe(opened);
  });

  it('waits for groups arriving after a direct drawer opening', () => {
    const store = makeStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    renderHook(() => useTaskDrawerNavigation(), { wrapper });
    act(() => store.dispatch({ type: 'open' }));
    expect(store.getState().taskDrawerReducer.navigationContext).toBeNull();
    act(() => store.dispatch({ type: 'groups' }));
    expect(store.getState().taskDrawerReducer.navigationContext?.taskIds).toEqual(['a', 'b']);
  });
});
