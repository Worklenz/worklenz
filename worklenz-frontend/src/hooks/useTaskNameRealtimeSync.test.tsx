import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useTaskNameRealtimeSync } from './useTaskNameRealtimeSync';
import { SocketEvents } from '@/shared/socket-events';

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
    emitEvent: (event: string, data: unknown) => {
      listeners.get(event)?.forEach(handler => handler(data));
    },
  };
};

let fakeSocket: ReturnType<typeof createFakeSocket>;
vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({ socket: fakeSocket }),
}));

let mockReduxState: any = {};
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: any) => any) => selector(mockReduxState),
}));

describe('useTaskNameRealtimeSync', () => {
  const initialItems = [
    { task_id: 'task-1', task_name: 'Original Task 1' },
    { task_id: 'task-2', task_name: 'Original Task 2' },
  ];

  beforeEach(() => {
    fakeSocket = createFakeSocket();
    mockReduxState = {
      taskDrawerReducer: {
        selectedTaskId: null,
        showTaskDrawer: false,
        taskFormViewModel: null,
      },
      taskManagement: {
        entities: {},
      },
    };
  });

  test('updates task_name when TASK_NAME_CHANGE socket event is received', () => {
    const { result } = renderHook(() => {
      const [items, setItems] = useState(initialItems);
      useTaskNameRealtimeSync({ items, setItems });
      return { items, setItems };
    });

    act(() => {
      fakeSocket.emitEvent(SocketEvents.TASK_NAME_CHANGE.toString(), {
        id: 'task-1',
        name: 'Updated Task 1 via Socket',
      });
    });

    expect(result.current.items[0].task_name).toBe('Updated Task 1 via Socket');
    expect(result.current.items[1].task_name).toBe('Original Task 2');
  });

  test('decodes HTML entities in task name from socket event', () => {
    const { result } = renderHook(() => {
      const [items, setItems] = useState(initialItems);
      useTaskNameRealtimeSync({ items, setItems });
      return { items, setItems };
    });

    act(() => {
      fakeSocket.emitEvent(SocketEvents.TASK_NAME_CHANGE.toString(), {
        id: 'task-1',
        name: 'Task &amp; More &lt;Cool&gt;',
      });
    });

    expect(result.current.items[0].task_name).toBe('Task & More <Cool>');
  });

  test('updates matching task name optimistically when drawer is open and user types in drawer', () => {
    mockReduxState = {
      taskDrawerReducer: {
        selectedTaskId: 'task-2',
        showTaskDrawer: true,
        taskFormViewModel: {
          task: { id: 'task-2', name: 'Renamed Task 2 In Drawer' },
        },
      },
      taskManagement: {
        entities: {},
      },
    };

    const { result } = renderHook(() => {
      const [items, setItems] = useState(initialItems);
      useTaskNameRealtimeSync({ items, setItems });
      return { items, setItems };
    });

    expect(result.current.items[1].task_name).toBe('Renamed Task 2 In Drawer');
  });

  test('restores original name if drawer is closed with an empty name', () => {
    // 1. Drawer open with task-1
    mockReduxState = {
      taskDrawerReducer: {
        selectedTaskId: 'task-1',
        showTaskDrawer: true,
        taskFormViewModel: {
          task: { id: 'task-1', name: 'Original Task 1' },
        },
      },
      taskManagement: {
        entities: {},
      },
    };

    const { result, rerender } = renderHook(() => {
      const [items, setItems] = useState(initialItems);
      useTaskNameRealtimeSync({ items, setItems });
      return { items, setItems };
    });

    // 2. User clears task name
    mockReduxState = {
      taskDrawerReducer: {
        selectedTaskId: 'task-1',
        showTaskDrawer: true,
        taskFormViewModel: {
          task: { id: 'task-1', name: '   ' },
        },
      },
      taskManagement: {
        entities: {},
      },
    };
    rerender();
    expect(result.current.items[0].task_name).toBe('Original Task 1');

    // 3. User closes drawer while still empty
    mockReduxState = {
      taskDrawerReducer: {
        selectedTaskId: 'task-1',
        showTaskDrawer: false,
        taskFormViewModel: {
          task: { id: 'task-1', name: '' },
        },
      },
      taskManagement: {
        entities: {},
      },
    };
    rerender();
    expect(result.current.items[0].task_name).toBe('Original Task 1');
  });

  test('supports custom getTaskId and updateTaskName accessors', () => {
    interface CustomItem {
      id: string;
      title: string;
    }

    const customItems: CustomItem[] = [
      { id: 'custom-1', title: 'Custom 1' },
    ];

    const { result } = renderHook(() => {
      const [items, setItems] = useState(customItems);
      useTaskNameRealtimeSync({
        items,
        setItems,
        getTaskId: item => item.id,
        updateTaskName: (item, newName) => ({ ...item, title: newName }),
      });
      return { items, setItems };
    });

    act(() => {
      fakeSocket.emitEvent(SocketEvents.TASK_NAME_CHANGE.toString(), {
        id: 'custom-1',
        name: 'New Custom Title',
      });
    });

    expect(result.current.items[0].title).toBe('New Custom Title');
  });
});
