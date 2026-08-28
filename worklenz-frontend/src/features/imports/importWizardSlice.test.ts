import { describe, expect, it } from 'vitest';
import reducer, {
  addUsersSet,
  csvColumnsSet,
  csvTextSet,
  fieldMappingsSet,
  importWizardReset,
  pendingNewStatusesSet,
  spaceNameSet,
  statusValueMappingSet,
  stepErrorSet,
  stepErrorsCleared,
  stepSet,
  ImportWizardState,
} from './importWizardSlice';

const getInitialState = (): ImportWizardState => reducer(undefined, { type: '@@INIT' });

describe('importWizardSlice', () => {
  it('sets the current step and tracks the furthest step reached', () => {
    const afterStep2 = reducer(getInitialState(), stepSet(2));
    expect(afterStep2.step).toBe(2);
    expect(afterStep2.furthestCompletedStep).toBe(2);

    const afterBack = reducer(afterStep2, stepSet(0));
    expect(afterBack.step).toBe(0);
    expect(afterBack.furthestCompletedStep).toBe(2);
  });

  it('stores CSV text and columns independently', () => {
    let state = reducer(getInitialState(), csvTextSet('a,b\n1,2'));
    state = reducer(state, csvColumnsSet(['a', 'b']));
    expect(state.csvText).toBe('a,b\n1,2');
    expect(state.csvColumns).toEqual(['a', 'b']);
  });

  it('stores field and status value mappings as whole-object replacements', () => {
    let state = reducer(getInitialState(), fieldMappingsSet({ Title: 'key' }));
    state = reducer(state, statusValueMappingSet({ Open: 'To Do' }));
    expect(state.fieldMappings).toEqual({ Title: 'key' });
    expect(state.statusValueMapping).toEqual({ Open: 'To Do' });
  });

  it('stores pending new statuses keyed by source value', () => {
    const state = reducer(
      getInitialState(),
      pendingNewStatusesSet({ 'In Review': { name: 'In Review', categoryId: 'cat-1' } })
    );
    expect(state.pendingNewStatuses['In Review']).toEqual({
      name: 'In Review',
      categoryId: 'cat-1',
    });
  });

  it('toggles addUsers', () => {
    const state = reducer(getInitialState(), addUsersSet(false));
    expect(state.addUsers).toBe(false);
  });

  it('sets and clears per-step validation errors', () => {
    let state = reducer(getInitialState(), stepErrorSet({ step: 1, error: 'Name required' }));
    expect(state.stepErrors[1]).toBe('Name required');

    state = reducer(state, stepErrorsCleared());
    expect(state.stepErrors).toEqual({});
  });

  it('resets the wizard back to initial values except the provided space name', () => {
    let state = reducer(getInitialState(), stepSet(3));
    state = reducer(state, spaceNameSet('Old name'));
    state = reducer(state, csvColumnsSet(['a']));

    const resetState = reducer(state, importWizardReset({ spaceName: 'New import' }));

    expect(resetState.step).toBe(0);
    expect(resetState.furthestCompletedStep).toBe(0);
    expect(resetState.csvColumns).toEqual([]);
    expect(resetState.spaceName).toBe('New import');
  });
});
