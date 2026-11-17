import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITaskListColumn } from '@/types/tasks/taskList.types';

vi.mock('./task-management.slice', async () => {
  const { createAsyncThunk } = await import('@reduxjs/toolkit');
  return {
    fetchTaskListColumns: createAsyncThunk('taskManagement/fetchTaskListColumns', async () => ({
      standard: [] as ITaskListColumn[],
    })),
    updateColumnVisibility: createAsyncThunk(
      'taskManagement/updateColumnVisibility',
      async () => ({})
    ),
  };
});
import reducer, { setProjectContext } from './taskListFields.slice';

beforeEach(() => localStorage.clear());

describe('initial server column visibility', () => {
  it('resolves heavy fields before task loading and persists the server settings', () => {
    let state = reducer(undefined, setProjectContext('project'));
    state = reducer(state, {
      type: 'taskManagement/fetchTaskListColumns/fulfilled',
      meta: { arg: 'project' },
      payload: {
        standard: [
          { key: 'COMMENTS', pinned: true },
          { key: 'ATTACHMENTS', pinned: true },
          { key: 'PROGRESS', pinned: false },
        ],
      },
    });
    expect(state.fields.find(field => field.key === 'COMMENTS')?.visible).toBe(true);
    expect(state.fields.find(field => field.key === 'ATTACHMENTS')?.visible).toBe(true);
    expect(state.fields.find(field => field.key === 'PROGRESS')?.visible).toBe(false);
    expect(
      JSON.parse(localStorage.getItem('worklenz.taskManagement.fields.project') || '[]')
    ).toEqual(state.fields);
  });

  it('ignores a previous project response and retains preferences for missing columns', () => {
    const state = reducer(undefined, setProjectContext('project'));
    const payload = { standard: [{ key: 'COMMENTS', pinned: true }] };
    const stale = reducer(state, {
      type: 'taskManagement/fetchTaskListColumns/fulfilled',
      meta: { arg: 'other' },
      payload,
    });
    expect(stale).toBe(state);
    const current = reducer(state, {
      type: 'taskManagement/fetchTaskListColumns/fulfilled',
      meta: { arg: 'project' },
      payload,
    });
    expect(current.fields.find(field => field.key === 'PROGRESS')?.visible).toBe(true);
  });
});
