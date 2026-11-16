import { act, cleanup, renderHook } from '@testing-library/react';
import { configureStore, type UnknownAction } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface TimerState {
  taskReducer: { activeTimers: Record<string, number> };
  taskManagement: {
    entities: Record<
      string,
      { id: string; title?: string; timeTracking?: { activeTimer?: number } }
    >;
  };
}
const runtime = vi.hoisted(() => ({
  getState: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}));
vi.mock('@/app/store', () => ({ store: { getState: () => runtime.getState() } }));
vi.mock('@/socket/socketContext', () => ({ useSocket: () => ({ socket: runtime.socket }) }));
vi.mock('@/shared/antd-imports', () => ({ message: { warning: vi.fn() } }));
vi.mock('@/features/task-management/task-management.slice', () => ({
  selectTaskById: (state: TimerState, id: string) => state.taskManagement.entities[id],
  updateTask: (payload: unknown) => ({ type: 'task/update', payload }),
}));
vi.mock('@/features/tasks/tasks.slice', () => ({
  updateTaskTimeTracking: (payload: unknown) => ({ type: 'timer/set', payload }),
}));

import { useTaskTimer } from './useTaskTimer';

function createTimerStore() {
  const initialState: TimerState = {
    taskReducer: { activeTimers: {} },
    taskManagement: { entities: { task: { id: 'task' } } },
  };
  const store = configureStore({
    reducer: (state = initialState, action: UnknownAction): TimerState => {
      if (action.type === 'timer/set') {
        const { taskId, timeTracking } = action.payload as {
          taskId: string;
          timeTracking: number | null;
        };
        const activeTimers = { ...state.taskReducer.activeTimers };
        if (timeTracking === null) delete activeTimers[taskId];
        else activeTimers[taskId] = timeTracking;
        return { ...state, taskReducer: { activeTimers } };
      }
      if (action.type === 'task/rename') {
        return {
          ...state,
          taskManagement: {
            entities: {
              ...state.taskManagement.entities,
              task: { ...state.taskManagement.entities.task, title: 'Changed name' },
            },
          },
        };
      }
      return state;
    },
  });
  runtime.getState.mockImplementation(store.getState);
  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('task timer subscriptions', () => {
  it('starts, ticks, and stops with one active interval', () => {
    const store = createTimerStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result, unmount } = renderHook(() => useTaskTimer('task', null), { wrapper });
    expect(result.current.started).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    act(() => result.current.handleStartTimer());
    expect(result.current.started).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.timeString).toBe('0m 3s');
    act(() => result.current.handleStopTimer());
    expect(result.current.started).toBe(false);
    expect(result.current.timeString).toBe('0m 0s');
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });

  it('ignores another task timer and unrelated edits to this task', () => {
    const store = createTimerStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders++;
        return useTaskTimer('task', null);
      },
      { wrapper }
    );
    const initialRenders = renders;
    act(() =>
      store.dispatch({ type: 'timer/set', payload: { taskId: 'other', timeTracking: Date.now() } })
    );
    act(() => store.dispatch({ type: 'task/rename' }));
    expect(renders).toBe(initialRenders);
    expect(result.current.started).toBe(false);
  });

  it('initializes a provided start time and releases its interval on unmount', () => {
    const store = createTimerStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result, unmount } = renderHook(() => useTaskTimer('task', Date.now() - 5000), {
      wrapper,
    });
    expect(result.current.started).toBe(true);
    expect(result.current.timeString).toBe('0m 5s');
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
