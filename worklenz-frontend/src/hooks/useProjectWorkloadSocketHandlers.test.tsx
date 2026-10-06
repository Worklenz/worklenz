import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjectWorkloadSocketHandlers } from './useProjectWorkloadSocketHandlers';
import { SocketEvents } from '@/shared/socket-events';

const dispatchMock = vi.fn();
vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => dispatchMock,
}));

type Handler = (...args: unknown[]) => void;

const createFakeSocket = () => {
  const listeners = new Map<string, Set<Handler>>();
  return {
    on: vi.fn((event: string, handler: Handler) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: Handler) => {
      listeners.get(event)?.delete(handler);
    }),
    emit: (event: string) => {
      listeners.get(event)?.forEach(handler => handler());
    },
  };
};

let fakeSocket: ReturnType<typeof createFakeSocket>;
vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({ socket: fakeSocket }),
}));

describe('useProjectWorkloadSocketHandlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dispatchMock.mockClear();
    fakeSocket = createFakeSocket();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('cancels the pending debounced refresh on unmount so no dispatch fires after teardown', () => {
    const { unmount } = renderHook(() => useProjectWorkloadSocketHandlers());

    fakeSocket.emit(SocketEvents.TASK_ASSIGNEES_CHANGE.toString());

    // Unmount before the 300ms debounce window elapses.
    unmount();

    vi.advanceTimersByTime(1000);

    expect(dispatchMock).not.toHaveBeenCalled();
  });

  test('still dispatches the debounced refresh when the component stays mounted', () => {
    renderHook(() => useProjectWorkloadSocketHandlers());

    fakeSocket.emit(SocketEvents.TASK_ASSIGNEES_CHANGE.toString());
    vi.advanceTimersByTime(300);

    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  test('coalesces a burst of events from a bulk operation into a single dispatch', () => {
    renderHook(() => useProjectWorkloadSocketHandlers());

    fakeSocket.emit(SocketEvents.TASK_ASSIGNEES_CHANGE.toString());
    fakeSocket.emit(SocketEvents.TASK_STATUS_CHANGE.toString());
    fakeSocket.emit(SocketEvents.QUICK_TASK.toString());
    vi.advanceTimersByTime(300);

    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });
});
