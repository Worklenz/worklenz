import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSortableTaskIds, VirtuosoItem } from './useSortableTaskIds';
import { Task } from '@/types/task-management.types';

describe('useSortableTaskIds', () => {
  it('collects unique task IDs and excludes add-task rows', () => {
    const allTasks: Task[] = [
      { id: 'task-1', name: 'Task 1' } as Task,
      { id: 'task-2', name: 'Task 2' } as Task,
    ];

    const virtuosoItems: VirtuosoItem[] = [
      { id: 'task-1', originalIndex: 0 } as VirtuosoItem,
      {
        id: 'add-task-1',
        isAddTaskRow: true,
        groupId: 'g-1',
        groupType: 'status',
        groupValue: 'val',
        rowId: 'row-1',
      },
      { id: 'task-2', originalIndex: 1 } as VirtuosoItem,
    ];

    const { result } = renderHook(() => useSortableTaskIds(allTasks, virtuosoItems));

    expect(result.current).toEqual(['task-1', 'task-2']);
  });

  it('recursively includes expanded subtasks for dragged reordering', () => {
    const sub1 = {
      id: 'sub-1',
      name: 'Subtask 1',
      show_sub_tasks: true,
      sub_tasks: [{ id: 'sub-1-1', name: 'Nested Subtask' } as Task],
    } as Task;

    const allTasks: Task[] = [
      {
        id: 'parent-1',
        name: 'Parent 1',
        show_sub_tasks: true,
        sub_tasks: [sub1, { id: 'sub-2', name: 'Subtask 2' } as Task],
      } as Task,
      sub1,
      { id: 'task-3', name: 'Task 3' } as Task,
    ];

    const virtuosoItems: VirtuosoItem[] = [
      { id: 'parent-1', originalIndex: 0 } as VirtuosoItem,
      { id: 'task-3', originalIndex: 1 } as VirtuosoItem,
    ];

    const { result } = renderHook(() => useSortableTaskIds(allTasks, virtuosoItems));

    expect(result.current).toEqual(['parent-1', 'sub-1', 'sub-1-1', 'sub-2', 'task-3']);
  });

  it('does not include subtasks if parent show_sub_tasks is false', () => {
    const allTasks: Task[] = [
      {
        id: 'parent-1',
        name: 'Parent 1',
        show_sub_tasks: false,
        sub_tasks: [{ id: 'sub-1', name: 'Subtask 1' } as Task],
      } as Task,
    ];

    const virtuosoItems: VirtuosoItem[] = [
      { id: 'parent-1', originalIndex: 0 } as VirtuosoItem,
    ];

    const { result } = renderHook(() => useSortableTaskIds(allTasks, virtuosoItems));

    expect(result.current).toEqual(['parent-1']);
  });
});
