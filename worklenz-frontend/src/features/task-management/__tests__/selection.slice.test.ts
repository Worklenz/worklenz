import { describe, it, expect } from 'vitest';
import selectionReducer, {
  selectTask,
  deselectTask,
  toggleTaskSelection,
  selectRange,
  clearSelection,
  resetSelection,
  selectSelectedTaskIds,
  selectLastSelectedTaskId,
  selectIsTaskSelected,
} from '../selection.slice';
import { RootState } from '@/app/store';

describe('selectionSlice', () => {
  const initialSelectionState = {
    selectedTaskIds: [],
    lastSelectedTaskId: null,
  };

  it('should return initial state by default', () => {
    const state = selectionReducer(undefined, { type: 'unknown' });
    expect(state).toEqual(initialSelectionState);
  });

  describe('selectTask', () => {
    it('should add task to selectedTaskIds and set lastSelectedTaskId', () => {
      const state = selectionReducer(initialSelectionState, selectTask('task-1'));
      expect(state.selectedTaskIds).toEqual(['task-1']);
      expect(state.lastSelectedTaskId).toBe('task-1');
    });

    it('should not add duplicate taskId but still update lastSelectedTaskId', () => {
      const existingState = {
        selectedTaskIds: ['task-1', 'task-2'],
        lastSelectedTaskId: 'task-2',
      };
      const state = selectionReducer(existingState, selectTask('task-1'));
      expect(state.selectedTaskIds).toEqual(['task-1', 'task-2']);
      expect(state.lastSelectedTaskId).toBe('task-1');
    });
  });

  describe('deselectTask', () => {
    it('should remove taskId from selectedTaskIds', () => {
      const existingState = {
        selectedTaskIds: ['task-1', 'task-2', 'task-3'],
        lastSelectedTaskId: 'task-1',
      };
      const state = selectionReducer(existingState, deselectTask('task-2'));
      expect(state.selectedTaskIds).toEqual(['task-1', 'task-3']);
      expect(state.lastSelectedTaskId).toBe('task-1');
    });

    it('should update lastSelectedTaskId to preceding task if lastSelected was deselected', () => {
      const existingState = {
        selectedTaskIds: ['task-1', 'task-2'],
        lastSelectedTaskId: 'task-2',
      };
      const state = selectionReducer(existingState, deselectTask('task-2'));
      expect(state.selectedTaskIds).toEqual(['task-1']);
      expect(state.lastSelectedTaskId).toBe('task-1');
    });

    it('should set lastSelectedTaskId to null when all tasks are deselected', () => {
      const existingState = {
        selectedTaskIds: ['task-1'],
        lastSelectedTaskId: 'task-1',
      };
      const state = selectionReducer(existingState, deselectTask('task-1'));
      expect(state.selectedTaskIds).toEqual([]);
      expect(state.lastSelectedTaskId).toBeNull();
    });
  });

  describe('toggleTaskSelection', () => {
    it('should select an unselected task', () => {
      const state = selectionReducer(initialSelectionState, toggleTaskSelection('task-1'));
      expect(state.selectedTaskIds).toEqual(['task-1']);
      expect(state.lastSelectedTaskId).toBe('task-1');
    });

    it('should deselect an already selected task', () => {
      const existingState = {
        selectedTaskIds: ['task-1', 'task-2'],
        lastSelectedTaskId: 'task-2',
      };
      const state = selectionReducer(existingState, toggleTaskSelection('task-2'));
      expect(state.selectedTaskIds).toEqual(['task-1']);
      expect(state.lastSelectedTaskId).toBe('task-1');
    });
  });

  describe('selectRange', () => {
    it('should append unique task IDs and update lastSelectedTaskId', () => {
      const existingState = {
        selectedTaskIds: ['task-1'],
        lastSelectedTaskId: 'task-1',
      };
      const state = selectionReducer(
        existingState,
        selectRange(['task-1', 'task-2', 'task-3'])
      );
      expect(state.selectedTaskIds).toEqual(['task-1', 'task-2', 'task-3']);
      expect(state.lastSelectedTaskId).toBe('task-3');
    });
  });

  describe('clearSelection and resetSelection', () => {
    it('should clear selection back to empty array and null', () => {
      const existingState = {
        selectedTaskIds: ['task-1', 'task-2'],
        lastSelectedTaskId: 'task-2',
      };
      const cleared = selectionReducer(existingState, clearSelection());
      expect(cleared.selectedTaskIds).toEqual([]);
      expect(cleared.lastSelectedTaskId).toBeNull();

      const reset = selectionReducer(existingState, resetSelection());
      expect(reset.selectedTaskIds).toEqual([]);
      expect(reset.lastSelectedTaskId).toBeNull();
    });
  });

  describe('Selectors', () => {
    const mockRootState = {
      taskManagementSelection: {
        selectedTaskIds: ['task-10', 'task-20'],
        lastSelectedTaskId: 'task-20',
      },
    } as unknown as RootState;

    it('selectSelectedTaskIds should return selected IDs', () => {
      expect(selectSelectedTaskIds(mockRootState)).toEqual(['task-10', 'task-20']);
    });

    it('selectLastSelectedTaskId should return last selected ID', () => {
      expect(selectLastSelectedTaskId(mockRootState)).toBe('task-20');
    });

    it('selectIsTaskSelected should return boolean indicating presence', () => {
      expect(selectIsTaskSelected(mockRootState, 'task-10')).toBe(true);
      expect(selectIsTaskSelected(mockRootState, 'task-99')).toBe(false);
    });
  });
});
