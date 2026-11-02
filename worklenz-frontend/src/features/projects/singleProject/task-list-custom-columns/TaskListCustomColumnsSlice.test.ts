import { describe, it, expect } from 'vitest';
import reducer, {
  setCustomColumnModalAttributes,
  setCustomFieldType,
  resetCustomFieldValues,
} from './task-list-custom-columns-slice';

describe('taskListCustomColumnsSlice', () => {
  it('defaults canChangeColumnType to true in initial state', () => {
    const state = reducer(undefined, { type: 'unknown' });
    expect(state.canChangeColumnType).toBe(true);
  });

  it('allows changing column type when opening modal in edit mode by default', () => {
    const state = reducer(
      undefined,
      setCustomColumnModalAttributes({
        modalType: 'edit',
        columnId: 'col-123',
        columnData: { id: 'col-123', name: 'Priority Field' },
      })
    );
    expect(state.canChangeColumnType).toBe(true);
    expect(state.customColumnModalType).toBe('edit');
    expect(state.customColumnId).toBe('col-123');
  });

  it('respects canChangeColumnType override if explicitly passed', () => {
    const state = reducer(
      undefined,
      setCustomColumnModalAttributes({
        modalType: 'edit',
        columnId: 'col-123',
        canChangeColumnType: false,
      })
    );
    expect(state.canChangeColumnType).toBe(false);
  });

  it('updates customFieldType and resets properly', () => {
    let state = reducer(undefined, setCustomFieldType('number'));
    expect(state.customFieldType).toBe('number');

    state = reducer(state, resetCustomFieldValues());
    expect(state.customFieldType).toBe('text');
  });
});
