import { describe, expect, it } from 'vitest';
import type { ITaskCustomColumn } from '@/types/tasks/task.types';
import { getCustomColumnTypeDependentNames } from './custom-column-type-dependencies';

const columns: ITaskCustomColumn[] = [
  { id: 'number', key: 'cost', name: 'Cost', custom_column_obj: { fieldType: 'number' } },
  { id: 'formula', key: 'total', name: 'Total cost', custom_column_obj: { fieldType: 'formula', firstNumericColumnKey: 'cost' } },
  { id: 'second', key: 'difference', name: 'Difference', custom_column_obj: { fieldType: 'formula', secondNumericColumnKey: 'cost' } },
  { id: 'parent', key: 'country', name: 'Country', custom_column_obj: { fieldType: 'selection' } },
  { id: 'child', key: 'city', name: 'City', custom_column_obj: { fieldType: 'selection', parentColumnId: 'parent' } },
];

describe('custom-column type dependencies', () => {
  it('blocks numeric type changes for either formula operand', () => {
    expect(getCustomColumnTypeDependentNames(columns, 'number')).toEqual(['Total cost', 'Difference']);
  });
  it('retains the cascading Selection dependency guard', () => {
    expect(getCustomColumnTypeDependentNames(columns, 'parent')).toEqual(['City']);
  });
  it('allows independent fields and creation', () => {
    expect(getCustomColumnTypeDependentNames(columns, 'formula')).toEqual([]);
    expect(getCustomColumnTypeDependentNames(columns, null)).toEqual([]);
  });
});
