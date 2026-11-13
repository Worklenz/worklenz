import { describe, expect, it } from 'vitest';
import {
  DEPENDS_ON_TYPE_PREFIX,
  findParentColumn,
  findSelectionOption,
  getDependentSelectionState,
  getEligibleParentColumns,
  parseDependsOnTypeValue,
  toDependsOnTypeValue,
} from './cascading-selection';
import type { ITaskCustomColumn } from '@/types/tasks/task.types';

const parentColumn: ITaskCustomColumn = {
  id: 'parent-col',
  key: 'department',
  name: 'Department',
  custom_column_obj: {
    fieldType: 'selection',
    selectionsList: [
      {
        selection_id: 'dept-eng',
        selection_name: 'Engineering',
        selection_color: '#111',
      },
      {
        selection_id: 'dept-sales',
        selection_name: 'Sales',
        selection_color: '#222',
      },
    ],
  },
};

const childColumn: ITaskCustomColumn = {
  id: 'child-col',
  key: 'team',
  name: 'Team',
  custom_column_obj: {
    fieldType: 'selection',
    parentColumnId: 'parent-col',
    parentColumnKey: 'department',
    selectionsList: [
      {
        selection_id: 'team-fe',
        selection_name: 'Frontend',
        selection_color: '#333',
        parent_selection_id: 'dept-eng',
      },
      {
        selection_id: 'team-be',
        selection_name: 'Backend',
        selection_color: '#444',
        parent_selection_id: 'dept-eng',
      },
      {
        selection_id: 'team-ae',
        selection_name: 'Account Exec',
        selection_color: '#555',
        parent_selection_id: 'dept-sales',
      },
    ],
  },
};

const plainSelection: ITaskCustomColumn = {
  id: 'status-col',
  key: 'custom_status',
  name: 'Custom Status',
  custom_column_obj: {
    fieldType: 'selection',
    selectionsList: [
      { selection_id: 'open', selection_name: 'Open', selection_color: '#666' },
    ],
  },
};

describe('cascading-selection utils', () => {
  describe('depends-on type helpers', () => {
    it('encodes and parses depends-on type values', () => {
      expect(toDependsOnTypeValue('parent-col')).toBe(`${DEPENDS_ON_TYPE_PREFIX}parent-col`);
      expect(parseDependsOnTypeValue(`${DEPENDS_ON_TYPE_PREFIX}parent-col`)).toBe('parent-col');
      expect(parseDependsOnTypeValue('selection')).toBeNull();
      expect(parseDependsOnTypeValue(DEPENDS_ON_TYPE_PREFIX)).toBeNull();
    });
  });

  describe('findSelectionOption', () => {
    const options = parentColumn.custom_column_obj!.selectionsList!;

    it('matches by selection name or id', () => {
      expect(findSelectionOption(options, 'Engineering')?.selection_id).toBe('dept-eng');
      expect(findSelectionOption(options, 'dept-sales')?.selection_name).toBe('Sales');
    });

    it('returns null for empty or unknown values', () => {
      expect(findSelectionOption(options, '')).toBeNull();
      expect(findSelectionOption(options, undefined)).toBeNull();
      expect(findSelectionOption(options, 'Missing')).toBeNull();
    });
  });

  describe('findParentColumn', () => {
    it('resolves parent by id or key', () => {
      expect(findParentColumn(childColumn, [parentColumn, childColumn])).toEqual(parentColumn);

      const byKeyOnly: ITaskCustomColumn = {
        ...childColumn,
        custom_column_obj: {
          ...childColumn.custom_column_obj!,
          parentColumnId: null,
          parentColumnKey: 'department',
        },
      };
      expect(findParentColumn(byKeyOnly, [parentColumn])).toEqual(parentColumn);
    });

    it('returns null when the column is not dependent', () => {
      expect(findParentColumn(plainSelection, [parentColumn, plainSelection])).toBeNull();
    });
  });

  describe('getDependentSelectionState', () => {
    it('filters options to the selected parent group', () => {
      const state = getDependentSelectionState(childColumn, [parentColumn, childColumn], {
        department: 'Engineering',
        team: 'Frontend',
      });

      expect(state.isDependent).toBe(true);
      expect(state.isAwaitingParent).toBe(false);
      expect(state.isCurrentValueInvalid).toBe(false);
      expect(state.allowedOptions.map(option => option.selection_name)).toEqual([
        'Frontend',
        'Backend',
      ]);
    });

    it('marks the field as awaiting parent when parent has no value', () => {
      const state = getDependentSelectionState(childColumn, [parentColumn, childColumn], {
        team: 'Frontend',
      });

      expect(state.isAwaitingParent).toBe(true);
      expect(state.allowedOptions).toEqual([]);
      expect(state.isCurrentValueInvalid).toBe(true);
    });

    it('flags invalid child values after the parent selection changes', () => {
      const state = getDependentSelectionState(childColumn, [parentColumn, childColumn], {
        department: 'Sales',
        team: 'Frontend',
      });

      expect(state.isCurrentValueInvalid).toBe(true);
      expect(state.allowedOptions.map(option => option.selection_name)).toEqual(['Account Exec']);
    });

    it('accepts imported selection ids as task values', () => {
      const state = getDependentSelectionState(childColumn, [parentColumn, childColumn], {
        department: 'dept-eng',
        team: 'team-be',
      });

      expect(state.isCurrentValueInvalid).toBe(false);
      expect(state.parentOption?.selection_name).toBe('Engineering');
    });

    it('treats non-dependent selection columns as unrestricted', () => {
      const state = getDependentSelectionState(plainSelection, [plainSelection], {
        custom_status: 'Open',
      });

      expect(state.isDependent).toBe(false);
      expect(state.allowedOptions).toHaveLength(1);
      expect(state.isCurrentValueInvalid).toBe(false);
    });
  });

  describe('getEligibleParentColumns', () => {
    it('returns only top-level selection columns', () => {
      expect(
        getEligibleParentColumns([parentColumn, childColumn, plainSelection], 'child-col').map(
          column => column.id
        )
      ).toEqual(['parent-col', 'status-col']);
    });

    it('returns no candidates when the current column already has dependents', () => {
      expect(getEligibleParentColumns([parentColumn, childColumn], 'parent-col')).toEqual([]);
    });

    it('excludes the current column from candidates', () => {
      expect(
        getEligibleParentColumns([parentColumn, plainSelection], 'parent-col').map(
          column => column.id
        )
      ).toEqual(['status-col']);
    });
  });
});
