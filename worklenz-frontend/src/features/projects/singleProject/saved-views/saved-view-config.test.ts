import { describe, expect, it } from 'vitest';
import {
  areSavedViewConfigsEqual,
  hasSavedViewCriteria,
  nextSavedViewName,
  parseSavedViewTabKey,
  SavedViewSourceState,
  serializeSavedViewConfig,
  toSavedViewTabKey,
} from './saved-view-config';
import { ISavedViewConfig, SAVED_VIEW_CONFIG_VERSION } from '@/types/project/project-saved-views.types';

const emptyConfig = (): ISavedViewConfig => ({
  version: SAVED_VIEW_CONFIG_VERSION,
  priorities: [],
  statuses: [],
  phases: [],
  members: [],
  labels: [],
  search: '',
  archived: false,
  group: 'status',
  sort_field: '',
  sort_order: 'ASC',
});

const sourceState = (overrides: Partial<SavedViewSourceState['taskReducer']> = {}): SavedViewSourceState => ({
  taskReducer: {
    priorities: ['p2', 'p1'],
    phases: [],
    statuses: [{ id: 's1' }, { id: undefined }],
    taskAssignees: [
      { id: 'm2', selected: true },
      { id: 'm1', selected: false },
      { id: 'm3', selected: true },
    ],
    labels: [{ id: 'l1', selected: true }],
    ...overrides,
  },
  taskManagement: { search: '  bug ', archived: true, sortField: 'end_date', sortOrder: 'DESC' },
  grouping: { currentGrouping: 'priority' },
});

describe('saved view tab keys', () => {
  it('round-trips a view id', () => {
    expect(parseSavedViewTabKey(toSavedViewTabKey('abc'))).toBe('abc');
  });

  it.each([null, undefined, '', 'tasks-list', 'view:'])('ignores %p', key => {
    expect(parseSavedViewTabKey(key)).toBeNull();
  });
});

describe('serializeSavedViewConfig', () => {
  it('captures selected filters, search, sort and grouping in a stable order', () => {
    expect(serializeSavedViewConfig(sourceState())).toEqual({
      version: SAVED_VIEW_CONFIG_VERSION,
      priorities: ['p1', 'p2'],
      statuses: ['s1'],
      phases: [],
      members: ['m2', 'm3'],
      labels: ['l1'],
      search: 'bug',
      archived: true,
      group: 'priority',
      sort_field: 'end_date',
      sort_order: 'DESC',
    });
  });

  it('defaults grouping to status', () => {
    const state = sourceState();
    state.grouping.currentGrouping = null;
    expect(serializeSavedViewConfig(state).group).toBe('status');
  });
});

describe('areSavedViewConfigsEqual', () => {
  it('ignores array order and duplicates', () => {
    expect(
      areSavedViewConfigsEqual(
        { ...emptyConfig(), members: ['b', 'a', 'a'] },
        { ...emptyConfig(), members: ['a', 'b'] }
      )
    ).toBe(true);
  });

  it('ignores sort order when nothing is sorted', () => {
    expect(areSavedViewConfigsEqual({ ...emptyConfig(), sort_order: 'DESC' }, emptyConfig())).toBe(
      true
    );
  });

  it('detects a changed filter', () => {
    expect(areSavedViewConfigsEqual({ ...emptyConfig(), labels: ['l1'] }, emptyConfig())).toBe(
      false
    );
  });
});

describe('hasSavedViewCriteria', () => {
  it('is false for an unfiltered list', () => {
    expect(hasSavedViewCriteria(emptyConfig())).toBe(false);
  });

  it.each<[string, Partial<ISavedViewConfig>]>([
    ['a status filter', { statuses: ['s1'] }],
    ['a search', { search: 'x' }],
    ['archived tasks', { archived: true }],
    ['a sort', { sort_field: 'name' }],
  ])('is true with %s', (_label, overrides) => {
    expect(hasSavedViewCriteria({ ...emptyConfig(), ...overrides })).toBe(true);
  });
});

describe('nextSavedViewName', () => {
  it('uses the base name when free', () => {
    expect(nextSavedViewName('List', ['Board'])).toBe('List');
  });

  it('numbers the name when taken, case-insensitively', () => {
    expect(nextSavedViewName('List', ['list', 'List 2'])).toBe('List 3');
  });
});
