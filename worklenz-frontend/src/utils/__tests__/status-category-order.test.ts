import { describe, expect, it } from 'vitest';
import {
  filterEmptyStatusGroups,
  getCategoryRank,
  getCollapsedGroupIds,
  getDoneStatusGroupIds,
  sortStatusesByCategory,
  sortStatusGroupsByCategory,
  sortTasksByStatusCategory,
} from '../status-category-order';
import type { Task, TaskGroup } from '@/types/task-management.types';
import type { ITaskStatus } from '@/types/tasks/taskStatus.types';

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

  it('sorts dropdown statuses by category order and preserves order within each category', () => {
    const statusOptions = [
      { id: 'todo-1', name: 'To Do', category_id: 'todo', order_index: 1 },
      { id: 'doing-1', name: 'Doing', category_id: 'doing', order_index: 2 },
      { id: 'doing-2', name: 'QA Blocked', category_id: 'doing', order_index: 3 },
      { id: 'done-1', name: 'Done', category_id: 'done', order_index: 4 },
    ];

    expect(sortStatusesByCategory(statusOptions, ['doing', 'todo', 'done']).map(s => s.id)).toEqual([
      'doing-1',
      'doing-2',
      'todo-1',
      'done-1',
    ]);
  });

  it('omits empty status groups without synthesizing placeholders', () => {
    expect(filterEmptyStatusGroups(groups, new Set(['task-1', 'task-2'])).map(g => g.id)).toEqual([
      'doing-1',
      'todo-1',
    ]);
  });

  it('identifies all status groups in Done by category membership, independent of order', () => {
    const doneStatuses = [
      ...statuses,
      { id: 'done-1', category_id: 'done', is_done: true },
      { id: 'done-2', category_id: 'done' },
    ];
    const statusGroups: TaskGroup[] = [
      { id: 'todo-1', title: 'To Do', taskIds: [], type: 'status' },
      { id: 'done-1', title: 'Done', taskIds: [], type: 'status' },
      { id: 'done-2', title: 'Verified', taskIds: [], type: 'status' },
    ];

    expect([...getDoneStatusGroupIds(statusGroups, doneStatuses)]).toEqual(['done-1', 'done-2']);
    expect([...getDoneStatusGroupIds([...statusGroups].reverse(), doneStatuses)]).toEqual([
      'done-2',
      'done-1',
    ]);
  });

  it('covers the task-list acceptance scenarios for default and custom statuses', () => {
    const scenarioStatuses: ITaskStatus[] = [
      { id: 'todo-1', name: 'To Do', category_id: 'todo', order_index: 0 },
      { id: 'doing-1', name: 'Doing', category_id: 'doing', order_index: 1 },
      { id: 'done-1', name: 'Done', category_id: 'done', order_index: 2, is_done: true },
      { id: 'qa-blocked', name: 'QA Blocked', category_id: 'doing', order_index: 3 },
    ];
    const scenarioGroups: TaskGroup[] = [
      { id: 'todo-1', title: 'To Do', taskIds: ['todo-task'], type: 'status' },
      { id: 'doing-1', title: 'Doing', taskIds: ['doing-task'], type: 'status' },
      { id: 'done-1', title: 'Done', taskIds: ['done-task'], type: 'status' },
      { id: 'qa-blocked', title: 'QA Blocked', taskIds: ['qa-task'], type: 'status' },
    ];
    const visibleGroupsFor = (taskIds: string[]) =>
      filterEmptyStatusGroups(
        sortStatusGroupsByCategory(scenarioGroups, scenarioStatuses, ['doing', 'todo', 'done']),
        new Set(taskIds)
      ).map(group => group.id);

    expect(visibleGroupsFor(['todo-task'])).toEqual(['todo-1']);
    expect(visibleGroupsFor(['doing-task', 'todo-task'])).toEqual(['doing-1', 'todo-1']);
    expect(visibleGroupsFor(['done-task', 'todo-task'])).toEqual(['todo-1', 'done-1']);
    expect(visibleGroupsFor(['done-task'])).toEqual(['done-1']);
    expect(visibleGroupsFor(['qa-task', 'todo-task'])).toEqual(['qa-blocked', 'todo-1']);
  });

  it('sorts more than 1,000 tasks by category and status', () => {
    const largeTaskList: Task[] = Array.from({ length: 1500 }, (_, index) => ({
      id: `task-${index}`,
      status: index % 3 === 0 ? 'done-1' : index % 3 === 1 ? 'todo-1' : 'doing-1',
      priority: '',
      created_at: '',
      updated_at: '',
      order: index,
    }));

    const start = performance.now();
    const sorted = sortTasksByStatusCategory(
      largeTaskList,
      [
        { id: 'todo-1', category_id: 'todo' },
        { id: 'doing-1', category_id: 'doing' },
        { id: 'done-1', category_id: 'done' },
      ],
      ['doing', 'todo', 'done']
    );
    const elapsedMs = performance.now() - start;

    expect(sorted).toHaveLength(1500);
    expect(sorted.slice(0, 500).every(task => task.status === 'doing-1')).toBe(true);
    expect(sorted.slice(500, 1000).every(task => task.status === 'todo-1')).toBe(true);
    expect(sorted.slice(1000).every(task => task.status === 'done-1')).toBe(true);
    expect(elapsedMs).toBeLessThan(1000);
  });

  it('collapses Done groups by default but honors explicit expand and collapse overrides', () => {
    const statusGroups: TaskGroup[] = [
      { id: 'todo-1', title: 'To Do', taskIds: [], type: 'status' },
      { id: 'done-1', title: 'Done', taskIds: [], type: 'status' },
    ];
    const doneGroupIds = new Set(['done-1']);

    expect(
      [...getCollapsedGroupIds(statusGroups, doneGroupIds, new Set(), {})]
    ).toEqual(['done-1']);
    expect(
      [...getCollapsedGroupIds(statusGroups, doneGroupIds, new Set(), { 'done-1': { collapsed: false } })]
    ).toEqual([]);
    expect(
      [...getCollapsedGroupIds(statusGroups, new Set(), new Set(), { 'done-1': { collapsed: true } })]
    ).toEqual(['done-1']);
  });

  it('uses the same category rank for flat status sorting', () => {
    expect(
      sortTasksByStatusCategory(tasks, statuses, ['todo', 'doing', 'done']).map(t => t.id)
    ).toEqual(['task-1', 'task-2']);
  });
});
