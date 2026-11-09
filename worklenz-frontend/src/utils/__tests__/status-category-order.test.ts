import { describe, expect, it } from 'vitest';
import {
  filterEmptyStatusGroups,
  getCategoryRank,
  sortStatusGroupsByCategory,
  sortTasksByStatusCategory,
} from '../status-category-order';
import type { Task, TaskGroup } from '@/types/task-management.types';
import type { ITaskStatus } from '@/types/status.types';

const statuses: ITaskStatus[] = [
  { id: 'todo-2', name: 'Ready', category_id: 'todo', order_index: 2 },
  { id: 'doing-1', name: 'In progress', category_id: 'doing', order_index: 1 },
  { id: 'todo-1', name: 'Backlog', category_id: 'todo', order_index: 1 },
];

const groups: TaskGroup[] = [
  { id: 'doing-1', title: 'In progress', taskIds: ['task-2'], category_id: 'doing' },
  { id: 'todo-2', title: 'Ready', taskIds: [], category_id: 'todo' },
  { id: 'todo-1', title: 'Backlog', taskIds: ['task-1'], category_id: 'todo' },
];

const tasks: Task[] = [
  { id: 'task-2', status: 'doing-1', priority: '', created_at: '', updated_at: '', order: 0 },
  { id: 'task-1', status: 'todo-1', priority: '', created_at: '', updated_at: '', order: 0 },
];

describe('status category order', () => {
  it('ranks known categories and puts unknown categories last', () => {
    expect(getCategoryRank({ category_id: 'doing' }, ['todo', 'doing', 'done'])).toBe(1);
    expect(getCategoryRank({ category_id: 'unknown' }, ['todo', 'doing', 'done'])).toBe(3);
  });

  it('sorts status groups by category and then status position without mutating input', () => {
    expect(
      sortStatusGroupsByCategory(groups, statuses, ['todo', 'doing', 'done']).map(g => g.id)
    ).toEqual(['todo-2', 'todo-1', 'doing-1']);
    expect(groups.map(g => g.id)).toEqual(['doing-1', 'todo-2', 'todo-1']);
  });

  it('omits empty status groups without synthesizing placeholders', () => {
    expect(filterEmptyStatusGroups(groups, new Set(['task-1', 'task-2'])).map(g => g.id)).toEqual([
      'doing-1',
      'todo-1',
    ]);
  });

  it('uses the same category rank for flat status sorting', () => {
    expect(
      sortTasksByStatusCategory(tasks, statuses, ['todo', 'doing', 'done']).map(t => t.id)
    ).toEqual(['task-1', 'task-2']);
  });
});
