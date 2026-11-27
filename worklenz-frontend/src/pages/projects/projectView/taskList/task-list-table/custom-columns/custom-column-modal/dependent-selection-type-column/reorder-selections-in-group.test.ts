import { describe, expect, it } from 'vitest';
import { reorderSelectionsInGroup } from './reorder-selections-in-group';
import type { SelectionType } from '../selection-type-column/selection-type-column';

const option = (
  id: string,
  parentId: string | null,
  name = id
): SelectionType => ({
  selection_id: id,
  selection_name: name,
  selection_color: '#1890ff',
  parent_selection_id: parentId,
});

describe('reorderSelectionsInGroup', () => {
  it('reorders siblings under the same parent without changing parent links', () => {
    const selections = [
      option('a1', 'p1'),
      option('a2', 'p1'),
      option('b1', 'p2'),
      option('a3', 'p1'),
    ];

    const next = reorderSelectionsInGroup(
      selections,
      ['a1', 'a2', 'a3'],
      'a3',
      'a1'
    );

    expect(next?.map(item => item.selection_id)).toEqual(['a3', 'a1', 'a2', 'b1']);
    expect(next?.map(item => item.parent_selection_id)).toEqual(['p1', 'p1', 'p1', 'p2']);
  });

  it('returns null when active and over are the same item', () => {
    const selections = [option('a1', 'p1'), option('a2', 'p1')];
    expect(reorderSelectionsInGroup(selections, ['a1', 'a2'], 'a1', 'a1')).toBeNull();
  });

  it('returns null when an id is outside the group', () => {
    const selections = [option('a1', 'p1'), option('b1', 'p2')];
    expect(reorderSelectionsInGroup(selections, ['a1'], 'a1', 'b1')).toBeNull();
  });
});
