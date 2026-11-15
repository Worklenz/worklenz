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
