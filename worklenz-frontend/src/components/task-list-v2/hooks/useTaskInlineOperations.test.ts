import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useTaskInlineOperations } from './useTaskInlineOperations';
import { Task, TaskGroup } from '@/types/task-management.types';
import { SocketEvents } from '@/shared/socket-events';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
}));

vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => mocks.dispatch,
}));

describe('useTaskInlineOperations', () => {
  const projectId = 'proj-123';
  const mockSocket = {
    emit: vi.fn(),
  };

  const sampleGroups: TaskGroup[] = [
    {
      id: 'group-1',
      title: 'To Do',
      color: '#ff0000',
      taskIds: ['task-1', 'task-2'],
    },
  ];

  const sampleTasks: Task[] = [
    { id: 'task-1', name: 'Task 1', custom_column_values: {} } as Task,
    { id: 'task-2', name: 'Task 2', custom_column_values: {} } as Task,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('activates and deactivates inline add row by group', () => {
    const { result } = renderHook(() =>
      useTaskInlineOperations({
        projectId,
        groups: sampleGroups,
        allTasks: sampleTasks,
        currentGrouping: 'status',
        socket: mockSocket,
        connected: true,
        currentSession: { team_id: 'team-1' },
        showTaskDrawer: false,
        selectedTaskId: null,
      })
    );

    act(() => {
      result.current.handleActivateAddRow('group-1');
    });
    expect(result.current.activeAddRowsByGroup['group-1']).toBe(true);

    act(() => {
      result.current.handleDeactivateAddRow('group-1');
    });
    expect(result.current.activeAddRowsByGroup['group-1']).toBe(false);
  });

  it('navigates and opens task drawer for a task', () => {
    const { result } = renderHook(() =>
      useTaskInlineOperations({
        projectId,
        groups: sampleGroups,
        allTasks: sampleTasks,
        currentGrouping: 'status',
        socket: mockSocket,
        connected: true,
        currentSession: { team_id: 'team-1' },
        showTaskDrawer: false,
        selectedTaskId: null,
      })
    );

    act(() => {
      result.current.openDrawerForTask('task-2');
    });

    expect(mocks.dispatch).toHaveBeenCalledTimes(4);
  });

  it('inserts task after anchor, dispatches reorder and emits socket sort change', () => {
    const { result } = renderHook(() =>
      useTaskInlineOperations({
        projectId,
        groups: sampleGroups,
        allTasks: sampleTasks,
        currentGrouping: 'status',
        socket: mockSocket,
        connected: true,
        currentSession: { team_id: 'team-1' },
        showTaskDrawer: false,
        selectedTaskId: null,
      })
    );

    const newTask = { id: 'task-new', name: 'New Task', status: 'To Do', priority: 'High' } as Task;

    act(() => {
      result.current.handleTaskCreated(newTask, 'group-1', false, 'task-1');
    });

    // Check reorderTasks dispatched
    expect(mocks.dispatch).toHaveBeenCalled();
    // Check socket emitted TASK_SORT_ORDER_CHANGE
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SocketEvents.TASK_SORT_ORDER_CHANGE.toString(),
      expect.objectContaining({
        project_id: projectId,
        from_group: 'group-1',
        to_group: 'group-1',
        task: expect.objectContaining({ id: 'task-new' }),
      })
    );
  });

  it('updates custom column value optimistically and emits socket event', () => {
    const { result } = renderHook(() =>
      useTaskInlineOperations({
        projectId,
        groups: sampleGroups,
        allTasks: sampleTasks,
        currentGrouping: 'status',
        socket: mockSocket,
        connected: true,
        currentSession: { team_id: 'team-1' },
        showTaskDrawer: false,
        selectedTaskId: null,
      })
    );

    act(() => {
      result.current.updateTaskCustomColumnValue('task-1', 'col-custom-1', 'Updated Value');
    });

    expect(mocks.dispatch).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(),
      JSON.stringify({
        task_id: 'task-1',
        column_key: 'col-custom-1',
        value: 'Updated Value',
        project_id: projectId,
      })
    );
  });
});
