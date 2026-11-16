import { describe, expect, it } from 'vitest';
import type { RootState } from '@/app/store';
import {
  selectHasTaskListFilters,
  selectTaskListLabelIds,
  selectTaskListMemberIds,
} from './task-management.selectors';

const makeState = () =>
  ({
    taskReducer: {
      phases: [],
      priorities: [],
      statuses: [],
      labels: [
        { id: 'label', selected: true },
        { id: 'other', selected: false },
      ],
      taskAssignees: [{ id: 'member', selected: true }],
    },
  }) as unknown as RootState;

describe('task list filter subscriptions', () => {
  it('reuses selected ids when unrelated Redux state changes', () => {
    const state = makeState();
    const labelIds = selectTaskListLabelIds(state);
    const memberIds = selectTaskListMemberIds(state);
    const next = { ...state, taskReducer: { ...state.taskReducer, loading: true } };
    expect(selectTaskListLabelIds(next)).toBe(labelIds);
    expect(selectTaskListMemberIds(next)).toBe(memberIds);
    const refreshed = { ...next, taskReducer: { ...next.taskReducer,
      labels: next.taskReducer.labels.map(label => ({ ...label, name: 'Refreshed name' })),
      taskAssignees: next.taskReducer.taskAssignees.map(member => ({ ...member })),
    } };
    expect(selectTaskListLabelIds(refreshed)).toBe(labelIds);
    expect(selectTaskListMemberIds(refreshed)).toBe(memberIds);
    expect(labelIds).toEqual(['label']);
    expect(memberIds).toEqual(['member']);
  });

  it('updates selected ids and excludes the pinned sprint only in backlog mode', () => {
    const state = makeState();
    const next = {
      ...state,
      taskReducer: {
        ...state.taskReducer,
        labels: state.taskReducer.labels.map(label => ({ ...label, selected: false })),
        taskAssignees: [],
        phases: ['sprint'],
      },
    };
    expect(selectTaskListLabelIds(next)).toEqual([]);
    expect(selectHasTaskListFilters(next, false)).toBe(false);
    expect(selectHasTaskListFilters(next, true)).toBe(true);
    expect(
      selectHasTaskListFilters(
        {
          ...next,
          taskReducer: {
            ...next.taskReducer,
            priorities: ['high'],
          },
        },
        false
      )
    ).toBe(true);
  });
});
