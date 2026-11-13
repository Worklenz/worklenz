import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScheduleSocketHandlers } from './useScheduleSocketHandlers';
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
    emit: (event: string, ...args: unknown[]) => {
      listeners.get(event)?.forEach(handler => handler(...args));
    },
    listeners,
  };
};

let fakeSocket: ReturnType<typeof createFakeSocket>;
vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({ socket: fakeSocket, connected: true }),
}));

describe('useScheduleSocketHandlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dispatchMock.mockClear();
    fakeSocket = createFakeSocket();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('registers both TASK_ASSIGNEES_CHANGE and QUICK_ASSIGNEES_UPDATE listeners', () => {
    renderHook(() => useScheduleSocketHandlers());

    expect(fakeSocket.on).toHaveBeenCalledWith(
      SocketEvents.TASK_ASSIGNEES_CHANGE.toString(),
      expect.any(Function)
    );
    expect(fakeSocket.on).toHaveBeenCalledWith(
      SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(),
      expect.any(Function)
    );
  });

  test('invalidates schedule tags when QUICK_ASSIGNEES_UPDATE fires', () => {
    renderHook(() => useScheduleSocketHandlers());

    fakeSocket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), { id: 'task-1' });

    expect(dispatchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const action = dispatchMock.mock.calls[0][0];
    expect(action.payload).toEqual(
      expect.arrayContaining(['Members', 'TaskTimeline', 'MemberProjects', 'Workload'])
    );
  });

  test('invalidates schedule tags when TASK_ASSIGNEES_CHANGE fires', () => {
    renderHook(() => useScheduleSocketHandlers());

    fakeSocket.emit(SocketEvents.TASK_ASSIGNEES_CHANGE.toString(), { task_id: 'task-1' });
    vi.advanceTimersByTime(200);

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const action = dispatchMock.mock.calls[0][0];
    expect(action.payload).toEqual(
      expect.arrayContaining(['Members', 'TaskTimeline', 'MemberProjects', 'Workload'])
    );
  });

  test('coalesces rapid consecutive task events into a single debounced invalidation', () => {
    renderHook(() => useScheduleSocketHandlers());

    // Task created -> dates set -> estimation added -> member assigned
    fakeSocket.emit(SocketEvents.QUICK_TASK.toString(), { id: 'task-1' });
    fakeSocket.emit(SocketEvents.TASK_START_DATE_CHANGE.toString(), { id: 'task-1' });
    fakeSocket.emit(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), { id: 'task-1' });
    fakeSocket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), { id: 'task-1' });

    vi.advanceTimersByTime(100);
    expect(dispatchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const action = dispatchMock.mock.calls[0][0];
    expect(action.payload).toEqual(
      expect.arrayContaining(['Members', 'TaskTimeline', 'MemberProjects', 'Workload'])
    );
  });

  test('cancels pending debounced invalidation on unmount', () => {
    const { unmount } = renderHook(() => useScheduleSocketHandlers());

    fakeSocket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), { id: 'task-1' });

    unmount();
    vi.advanceTimersByTime(500);

    expect(dispatchMock).not.toHaveBeenCalled();
  });

  test('unregisters all socket listeners on unmount', () => {
    const { unmount } = renderHook(() => useScheduleSocketHandlers());

    unmount();

    expect(fakeSocket.off).toHaveBeenCalledWith(
      SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(),
      expect.any(Function)
    );
    expect(fakeSocket.off).toHaveBeenCalledWith(
      SocketEvents.TASK_ASSIGNEES_CHANGE.toString(),
      expect.any(Function)
    );
    expect(fakeSocket.off).toHaveBeenCalledWith(
      SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(),
      expect.any(Function)
    );
  });
});
