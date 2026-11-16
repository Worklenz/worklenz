import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Task, TaskGroup } from '@/types/task-management.types';
import { useVirtuosoGroups } from './useVirtuosoGroups';

describe('useVirtuosoGroups', () => {
  it('preserves group order, duplicate membership, insertion position, and collapsed groups', () => {
    const tasks = [{ id: 'a' }, { id: 'b' }] as Task[];
    const groups: TaskGroup[] = [
      { id: 'one', title: 'One', taskIds: ['b', 'missing', 'a'] },
      { id: 'two', title: 'Two', taskIds: ['a'] },
      { id: 'closed', title: 'Closed', taskIds: ['b'] },
    ];
    const { result } = renderHook(() =>
      useVirtuosoGroups({
        groups,
        allTasks: tasks,
        collapsedGroups: new Set(['closed']),
        currentGrouping: 'assignee',
        urlProjectId: 'project',
        insertAnchor: { groupId: 'one', afterTaskId: 'b' },
        isBacklogMode: false,
        isSoftwareProject: false,
        phaseList: [],
      })
    );

    expect(result.current.map(group => group.startIndex)).toEqual([0, 3, 5]);
    expect(result.current[0].tasks.map(task => task.id)).toEqual(['b', 'add-task-one-0', 'a']);
    expect(result.current[0].tasks[0]).toMatchObject({ originalIndex: 1 });
    expect(result.current[1].tasks.map(task => task.id)).toEqual(['a', 'add-task-two-0']);
    expect(result.current[2]).toMatchObject({ tasks: [], count: 0, actualCount: 1 });
  });
});

describe('development category ordering with virtualized groups', () => {
  const statuses = [
    { id: 'todo', name: 'Todo', category_id: 'todo-category' },
    { id: 'doing', name: 'Doing', category_id: 'doing-category' },
    { id: 'done', name: 'Done', category_id: 'done-category' },
  ];
  const categoryOrder = ['doing-category', 'todo-category', 'done-category'];
  const task = (id: string, status: string): Task => ({
    id,
    status,
    priority: 'medium',
    created_at: '',
    updated_at: '',
  });
  const baseOptions = {
    collapsedGroups: new Set<string>(),
    urlProjectId: 'project',
    insertAnchor: null,
    isBacklogMode: false,
    isSoftwareProject: false,
    phaseList: [],
    statuses,
    statusCategoryOrder: categoryOrder,
  };

  it('orders status groups by category and keeps empty configured groups', () => {
    const groups: TaskGroup[] = [
      { id: 'todo', title: 'Todo', taskIds: ['a'] },
      { id: 'done', title: 'Done', taskIds: ['b'] },
      { id: 'empty', title: 'Empty', taskIds: [] },
      { id: 'doing', title: 'Doing', taskIds: ['c'] },
    ];
    const { result } = renderHook(() =>
      useVirtuosoGroups({
        ...baseOptions,
        groups,
        allTasks: [task('a', 'todo'), task('b', 'done'), task('c', 'doing')],
        currentGrouping: 'status',
      })
    );
    expect(result.current.map(group => group.id)).toEqual(['doing', 'todo', 'done', 'empty']);
    expect(result.current.map(group => group.startIndex)).toEqual([0, 2, 4, 6]);
    expect(result.current[0].tasks[0]).toMatchObject({ id: 'c', originalIndex: 2 });
    expect(result.current[3]).toMatchObject({ actualCount: 0, count: 1 });
  });

  it('keeps empty status groups for example rows in an empty project', () => {
    const groups: TaskGroup[] = [
      { id: 'todo', title: 'Todo', taskIds: [] },
      { id: 'doing', title: 'Doing', taskIds: [] },
    ];
    const { result } = renderHook(() =>
      useVirtuosoGroups({
        ...baseOptions,
        groups,
        allTasks: [],
        currentGrouping: 'status',
      })
    );
    expect(result.current.map(group => group.id)).toEqual(['doing', 'todo']);
    expect(result.current.every(group => group.actualCount === 0 && group.count === 1)).toBe(true);
  });

  it('sorts tasks within other groupings by status category while retaining lookup indexes', () => {
    const groups: TaskGroup[] = [{ id: 'medium', title: 'Medium', taskIds: ['a', 'b', 'c'] }];
    const { result, rerender } = renderHook(
      ({ sortOrder }: { sortOrder: 'ASC' | 'DESC' }) =>
        useVirtuosoGroups({
          ...baseOptions,
          groups,
          allTasks: [task('a', 'todo'), task('b', 'done'), task('c', 'doing')],
          currentGrouping: 'priority',
          sortField: 'status',
          sortOrder,
        }),
      { initialProps: { sortOrder: 'ASC' as 'ASC' | 'DESC' } }
    );
    expect(result.current[0].tasks.map(task => task.id)).toEqual([
      'c',
      'a',
      'b',
      'add-task-medium-0',
    ]);
    expect(result.current[0].tasks[0]).toMatchObject({ originalIndex: 2 });
    rerender({ sortOrder: 'DESC' });
    expect(result.current[0].tasks.map(task => task.id)).toEqual([
      'b',
      'a',
      'c',
      'add-task-medium-0',
    ]);
  });
});
